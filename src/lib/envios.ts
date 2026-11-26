import 'server-only';
import { randomInt } from 'node:crypto';
import { z } from 'zod';
import type { PoolClient } from 'pg';
import { PUBLIC_ACTOR, writeAudit, type Actor } from './audit';
import { query, withTransaction } from './db';
import { AppError, DatabaseError, ForbiddenError, NotFoundError, RateLimitError, ValidationError } from './errors';
import { moneyMx, padFolio } from './format';
import { logger } from './logger';
import { can } from './permissions';
import { cleanLine, cleanMultiline, type RequestContext } from './security';

// ── Constantes operativas (todo tiene tope) ────────────────────────────────
export const FOLIO_MAX = 99999;
const RECEIVE_MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [150, 400];
const LOCK_TIMEOUT = '4s';
export const LIST_LIMIT = 300;
export const EXPORT_LIMIT = 20000;
const CAPTURE_MAX_PER_IP_HOUR = 15;
const CAPTURE_MAX_TOTAL_HOUR = 400;
const MAX_WAITING = 3000;

export type EnvioStatus = 'en_espera' | 'recibido' | 'finalizado' | 'cancelado';

const COLS = `id, request_id, short_code, status, sender_name, sender_phone, recipient_name, branch_id, branch, size_hint,
  weight_kg::text, size_id, size_name, price::text, paid, paid_at, notes, folio_number, created_at, received_at, received_by,
  received_by_name, finalized_at, finalized_by_name, cancel_reason, cancelled_at, cancelled_by`;

export interface Envio {
  id: number;
  request_id: string;
  short_code: string;
  status: EnvioStatus;
  sender_name: string;
  sender_phone: string;
  recipient_name: string;
  branch_id: number | null;
  branch: string;
  size_hint: string;
  weight_kg: string | null;
  size_id: number | null;
  size_name: string;
  price: string | null;
  paid: boolean;
  paid_at: Date | null;
  notes: string;
  folio_number: number | null;
  created_at: Date;
  received_at: Date | null;
  received_by: number | null;
  received_by_name: string;
  finalized_at: Date | null;
  finalized_by_name: string;
  cancel_reason: string;
  cancelled_at: Date | null;
  cancelled_by: string;
}

export const STATUS_LABEL: Record<EnvioStatus, string> = {
  en_espera: 'En espera',
  recibido: 'Recibido',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado',
};

// ── Validación ─────────────────────────────────────────────────────────────
const line = (label: string, max: number, required: boolean) =>
  z
    .unknown()
    .transform((v) => cleanLine(v, max))
    .refine((v) => !required || v.length >= 2, { message: `${label} es obligatorio (mínimo 2 letras).` });

export function normalizePhone(raw: unknown): string {
  return cleanLine(raw, 40).replace(/\D/g, '').slice(-15);
}

const phoneField = z
  .unknown()
  .transform((v) => normalizePhone(v))
  .refine((v) => v === '' || (v.length >= 10 && v.length <= 15), { message: 'Escriba un teléfono de 10 dígitos (o déjelo vacío).' });

const idField = (message: string) =>
  z.unknown().transform((v, ctx) => {
    const n = Number(typeof v === 'string' ? v.trim() : v);
    if (!Number.isSafeInteger(n) || n <= 0) {
      ctx.addIssue({ code: 'custom', message });
      return z.NEVER;
    }
    return n;
  });

const optionalId = z.unknown().transform((v) => {
  const n = Number(typeof v === 'string' ? v.trim() : v);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
});

/** Peso opcional: vacío → null. */
const optionalWeight = z.unknown().transform((v, ctx) => {
  const text = cleanLine(v, 12).replace(',', '.');
  if (!text) return null;
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(text) || Number(text) <= 0 || Number(text) > 1000) {
    ctx.addIssue({ code: 'custom', message: 'Peso inválido. Ejemplo: 1.5 (o déjelo vacío).' });
    return z.NEVER;
  }
  return Math.round(Number(text) * 100) / 100;
});

export const captureSchema = z.object({
  request_id: z.string().uuid('Solicitud inválida. Recargue la página e inténtelo de nuevo.'),
  sender_name: line('Su nombre', 100, true),
  sender_phone: phoneField,
  recipient_name: line('El nombre de quien recibe', 100, true),
  branch_id: idField('Seleccione el punto de recolección.'),
  size_id: optionalId,
});

export const receiveSchema = z.object({
  sender_name: line('El nombre de quien envía', 100, true),
  sender_phone: phoneField,
  recipient_name: line('El nombre de quien recibe', 100, true),
  branch_id: idField('Seleccione el punto de entrega.'),
  size_id: idField('Seleccione el tamaño del paquete.'),
  weight_kg: optionalWeight,
  notes: z.unknown().transform((v) => cleanMultiline(v, 300)),
  paid: z.boolean(),
});

export const reasonSchema = z.object({
  reason: line('El motivo', 200, false).refine((v) => v.length >= 4, { message: 'Explique el motivo con al menos 4 letras.' }),
});

function fieldErrorsOf(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) out[String(issue.path[0] ?? 'form')] ??= issue.message;
  return out;
}

export function parseOrThrow<T extends z.ZodTypeAny>(schema: T, input: unknown): z.infer<T> {
  const r = schema.safeParse(input);
  if (!r.success) throw new ValidationError(fieldErrorsOf(r.error));
  return r.data;
}

// ── Lectura ────────────────────────────────────────────────────────────────
export async function getEnvio(id: number): Promise<Envio | null> {
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const rows = await query<Envio>(`SELECT ${COLS} FROM envios WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export interface EnvioFilters {
  q?: string;
  statuses?: EnvioStatus[];
  from?: string; // YYYY-MM-DD (zona horaria del negocio)
  to?: string;
  today?: boolean;
  paid?: 'si' | 'no' | '';
  branch_id?: number;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EVENT_AT = 'COALESCE(received_at, created_at)';

function buildWhere(f: EnvioFilters, tz: string): { where: string; params: unknown[] } {
  const conds: string[] = [];
  const params: unknown[] = [];
  const add = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };
  const q = cleanLine(f.q, 80);
  if (q) {
    const digits = q.replace(/\D/g, '');
    const like = add(`%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
    const parts = [`sender_name ILIKE ${like}`, `recipient_name ILIKE ${like}`];
    if (digits && digits.length <= 5) parts.push(`folio_number = ${add(Number(digits))}`);
    if (digits.length === 4) parts.push(`(status = 'en_espera' AND short_code = ${add(digits)})`);
    if (digits.length >= 4) parts.push(`sender_phone LIKE ${add(`%${digits}%`)}`);
    conds.push(`(${parts.join(' OR ')})`);
  }
  if (f.statuses && f.statuses.length) conds.push(`status = ANY(${add(f.statuses)}::text[])`);
  let tzp = '';
  const tzRef = () => (tzp ||= add(tz));
  if (f.today) conds.push(`(${EVENT_AT} AT TIME ZONE ${tzRef()})::date = (now() AT TIME ZONE ${tzRef()})::date`);
  if (f.from && DATE_RE.test(f.from)) conds.push(`(${EVENT_AT} AT TIME ZONE ${tzRef()})::date >= ${add(f.from)}::date`);
  if (f.to && DATE_RE.test(f.to)) conds.push(`(${EVENT_AT} AT TIME ZONE ${tzRef()})::date <= ${add(f.to)}::date`);
  if (f.branch_id && Number.isSafeInteger(f.branch_id)) conds.push(`branch_id = ${add(f.branch_id)}`);
  if (f.paid === 'si') conds.push(`paid AND status IN ('recibido','finalizado')`);
  if (f.paid === 'no') conds.push(`NOT paid AND status IN ('recibido','finalizado')`);
  return { where: conds.length ? `WHERE ${conds.join(' AND ')}` : '', params };
}

export async function listEnvios(
  f: EnvioFilters,
  tz: string,
  opts: { limit?: number; order?: 'oldest' | 'newest' } = {},
): Promise<Envio[]> {
  const { where, params } = buildWhere(f, tz);
  const max = Math.min(Math.max(1, Math.trunc(opts.limit ?? LIST_LIMIT) || LIST_LIMIT), EXPORT_LIMIT);
  const order = opts.order === 'oldest' ? `created_at ASC, id ASC` : `${EVENT_AT} DESC, id DESC`;
  return query<Envio>(`SELECT ${COLS} FROM envios ${where} ORDER BY ${order} LIMIT ${max}`, params);
}

export interface TabCounts {
  en_espera: number;
  recibido: number;
  recibido_hoy: number;
  finalizado: number;
}

export async function tabCounts(tz: string): Promise<TabCounts> {
  const rows = await query<TabCounts>(
    `SELECT count(*) FILTER (WHERE status = 'en_espera')::int AS en_espera,
            count(*) FILTER (WHERE status = 'recibido')::int AS recibido,
            count(*) FILTER (WHERE status IN ('recibido','finalizado') AND (received_at AT TIME ZONE $1)::date = (now() AT TIME ZONE $1)::date)::int AS recibido_hoy,
            count(*) FILTER (WHERE status = 'finalizado')::int AS finalizado
       FROM envios`,
    [tz],
  );
  return rows[0];
}

export interface EnvioSummary {
  total: number;
  active: number;
  cancelled: number;
  paid_count: number;
  pending_count: number;
  paid_amount: string;
  pending_amount: string;
}

/** Totales de envíos con folio. Solo los activos (recibido/finalizado) suman dinero. */
export async function summarize(f: EnvioFilters, tz: string): Promise<EnvioSummary> {
  const { where, params } = buildWhere(f, tz);
  const rows = await query<EnvioSummary>(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE status IN ('recibido','finalizado'))::int AS active,
            count(*) FILTER (WHERE status = 'cancelado')::int AS cancelled,
            count(*) FILTER (WHERE status IN ('recibido','finalizado') AND paid)::int AS paid_count,
            count(*) FILTER (WHERE status IN ('recibido','finalizado') AND NOT paid)::int AS pending_count,
            coalesce(sum(price) FILTER (WHERE status IN ('recibido','finalizado') AND paid), 0)::text AS paid_amount,
            coalesce(sum(price) FILTER (WHERE status IN ('recibido','finalizado') AND NOT paid), 0)::text AS pending_amount
       FROM envios ${where ? `${where} AND` : 'WHERE'} received_at IS NOT NULL`,
    params,
  );
  return rows[0];
}

export interface CorteRow {
  operator: string;
  active: number;
  paid_amount: string;
  pending_amount: string;
  cancelled: number;
}

export interface Corte {
  date: string;
  summary: EnvioSummary;
  byOperator: CorteRow[];
  bySize: { size_name: string; active: number; amount: string }[];
}

/** Corte de un día (zona horaria del negocio), según el día en que se RECIBIÓ el paquete. */
export async function corteDelDia(date: string, tz: string): Promise<Corte> {
  if (!DATE_RE.test(date)) throw new ValidationError({ fecha: 'Fecha inválida.' });
  const filters: EnvioFilters = { from: date, to: date };
  const { where, params } = buildWhere(filters, tz);
  const base = `${where} AND received_at IS NOT NULL`;
  const [summary, byOperator, bySize] = await Promise.all([
    summarize(filters, tz),
    query<CorteRow>(
      `SELECT received_by_name AS operator,
              count(*) FILTER (WHERE status IN ('recibido','finalizado'))::int AS active,
              coalesce(sum(price) FILTER (WHERE status IN ('recibido','finalizado') AND paid), 0)::text AS paid_amount,
              coalesce(sum(price) FILTER (WHERE status IN ('recibido','finalizado') AND NOT paid), 0)::text AS pending_amount,
              count(*) FILTER (WHERE status = 'cancelado')::int AS cancelled
         FROM envios ${base} GROUP BY received_by_name ORDER BY lower(received_by_name)`,
      params,
    ),
    query<{ size_name: string; active: number; amount: string }>(
      `SELECT size_name, count(*)::int AS active, coalesce(sum(price), 0)::text AS amount
         FROM envios ${base} AND status IN ('recibido','finalizado') GROUP BY size_name ORDER BY min(price), size_name`,
      params,
    ),
  ]);
  return { date, summary, byOperator, bySize };
}

// ── Utilidades de escritura ────────────────────────────────────────────────
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function pgCodeOf(err: unknown): string | undefined {
  const direct = (err as { code?: unknown } | null)?.code;
  if (typeof direct === 'string') return direct;
  const cause = (err as { cause?: { code?: unknown } } | null)?.cause?.code;
  return typeof cause === 'string' ? cause : undefined;
}

/** Bloqueo no obtenido a tiempo (55P03), deadlock (40P01) o fallo de serialización (40001): se puede reintentar. */
function isRetryable(err: unknown): boolean {
  const code = pgCodeOf(err);
  return code === '55P03' || code === '40P01' || code === '40001';
}

async function lockEnvio(client: PoolClient, id: number): Promise<Envio> {
  await client.query(`SET LOCAL lock_timeout = '${LOCK_TIMEOUT}'`);
  const { rows } = await client.query<Envio>(`SELECT ${COLS} FROM envios WHERE id = $1 FOR UPDATE`, [id]);
  if (!rows[0]) throw new NotFoundError('El envío no existe.');
  return rows[0];
}

async function resolveSize(client: PoolClient, sizeId: number) {
  const { rows } = await client.query<{ id: number; name: string; price: string }>(
    'SELECT id, name, price::text FROM sizes WHERE id = $1 AND is_active',
    [sizeId],
  );
  if (!rows[0]) throw new ValidationError({ size_id: 'Ese tamaño ya no está disponible. Elija otro.' });
  return rows[0];
}

async function resolveBranch(client: PoolClient, branchId: number) {
  const { rows } = await client.query<{ id: number; name: string }>('SELECT id, name FROM branches WHERE id = $1 AND is_active', [branchId]);
  if (!rows[0]) throw new ValidationError({ branch_id: 'Ese punto ya no está disponible. Elija otro.' });
  return rows[0];
}

// ── 1) Captura pública por QR (sin sesión): queda EN ESPERA, sin folio ─────
export interface CaptureResult {
  code: string;
  duplicate: boolean;
  branch: string;
}

export async function captureEnvio(input: unknown, ctx: RequestContext): Promise<CaptureResult> {
  const data = parseOrThrow(captureSchema, input);

  // Idempotencia: el mismo envío (doble toque / reintento) devuelve el mismo código y no se duplica.
  const same = await query<{ short_code: string; branch: string }>('SELECT short_code, branch FROM envios WHERE request_id = $1', [data.request_id]);
  if (same[0]) return { code: same[0].short_code, duplicate: true, branch: same[0].branch };

  // Límites contra abuso: por IP (hash), global por hora y tope de envíos esperando.
  const lim = await query<{ by_ip: number; total: number; waiting: number }>(
    `SELECT count(*) FILTER (WHERE ip_hash = $1)::int AS by_ip,
            count(*)::int AS total,
            (SELECT count(*)::int FROM envios WHERE status = 'en_espera') AS waiting
       FROM envios WHERE created_at > now() - interval '1 hour'`,
    [ctx.ipHash],
  );
  const l = lim[0];
  if (l && (l.by_ip >= CAPTURE_MAX_PER_IP_HOUR || l.total >= CAPTURE_MAX_TOTAL_HOUR)) {
    throw new RateLimitError('Recibimos muchas solicitudes desde su conexión. Inténtelo de nuevo en un rato o acuda al mostrador.');
  }
  if (l && l.waiting >= MAX_WAITING) {
    throw new AppError('BUSY', 'El servicio está saturado por el momento. Acuda al mostrador, por favor.', 503);
  }

  const branch = (await query<{ id: number; name: string }>('SELECT id, name FROM branches WHERE id = $1 AND is_active', [data.branch_id]))[0];
  if (!branch) throw new ValidationError({ branch_id: 'Ese punto ya no está disponible. Elija otro.' });
  let sizeHint = '';
  if (data.size_id) {
    const s = await query<{ name: string }>('SELECT name FROM sizes WHERE id = $1 AND is_active AND show_public', [data.size_id]);
    sizeHint = s[0]?.name ?? '';
  }

  for (let attempt = 0; attempt < 12; attempt++) {
    const code = String(randomInt(0, 10000)).padStart(4, '0');
    const insertedId = await withTransaction(async (client) => {
      const { rows } = await client.query<{ id: number }>(
        `INSERT INTO envios (request_id, short_code, sender_name, sender_phone, recipient_name, branch_id, branch, size_hint, ip_hash)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT DO NOTHING RETURNING id`,
        [data.request_id, code, data.sender_name, data.sender_phone, data.recipient_name, branch.id, branch.name, sizeHint, ctx.ipHash],
      );
      if (!rows[0]) return null; // código repetido entre los que están en espera, o solicitud ya registrada
      await writeAudit(client, {
        actor: PUBLIC_ACTOR,
        action: 'envios.capture',
        entity: 'envios',
        entityId: rows[0].id,
        summary: `Captura por QR · código ${code} · ${branch.name}`,
        after: { short_code: code, branch: branch.name, size_hint: sizeHint },
        ctx,
      });
      return rows[0].id;
    });
    if (insertedId !== null) return { code, duplicate: false, branch: branch.name };
    const again = await query<{ short_code: string; branch: string }>('SELECT short_code, branch FROM envios WHERE request_id = $1', [data.request_id]);
    if (again[0]) return { code: again[0].short_code, duplicate: true, branch: again[0].branch };
  }
  throw new AppError('BUSY', 'No pudimos generar su código. Inténtelo de nuevo en un momento.', 503);
}

// ── 2) Recibir: asigna el folio (contador sin huecos) y deja el envío listo para etiquetar ──
export interface ReceiveResult {
  envio: Envio;
  /** true si ya estaba recibido (doble clic o dos personas): no se duplicó el folio. */
  duplicate: boolean;
}

export async function receiveEnvio(id: number, input: unknown, actor: Actor, ctx: RequestContext): Promise<ReceiveResult> {
  const data = parseOrThrow(receiveSchema, input);
  let lastError: unknown;
  for (let attempt = 1; attempt <= RECEIVE_MAX_ATTEMPTS; attempt++) {
    try {
      const duplicate = await withTransaction(async (client) => {
        const before = await lockEnvio(client, id);
        if (before.status === 'recibido' || before.status === 'finalizado') return true;
        if (before.status === 'cancelado') throw new ForbiddenError('Este envío fue descartado y ya no se puede recibir.');

        const size = await resolveSize(client, data.size_id);
        const branch = before.branch_id === data.branch_id ? { id: before.branch_id, name: before.branch } : await resolveBranch(client, data.branch_id);

        // El UPDATE bloquea la fila del contador: los folios se numeran uno por uno, sin saltos ni repetidos.
        const { rows: counter } = await client.query<{ last_number: number }>(
          'UPDATE folio_counter SET last_number = last_number + 1 WHERE id = 1 AND last_number < $1 RETURNING last_number',
          [FOLIO_MAX],
        );
        if (counter.length === 0) {
          throw new AppError('FOLIO_LIMIT', 'Se alcanzó el folio 99999. Avise a la administradora para reiniciar la numeración.', 409);
        }
        const number = counter[0].last_number;
        await client.query(
          `UPDATE envios SET status = 'recibido', folio_number = $2, sender_name = $3, sender_phone = $4, recipient_name = $5,
                  branch_id = $6, branch = $7, size_id = $8, size_name = $9, price = $10, weight_kg = $11, notes = $12,
                  paid = $13, paid_at = CASE WHEN $13 THEN now() END,
                  received_at = now(), received_by = $14, received_by_name = $15
            WHERE id = $1`,
          [id, number, data.sender_name, data.sender_phone, data.recipient_name, branch.id, branch.name, size.id, size.name,
            size.price, data.weight_kg, data.notes, data.paid, actor.id, actor.name],
        );
        await writeAudit(client, {
          actor,
          action: 'envios.receive',
          entity: 'envios',
          entityId: id,
          summary: `Recibido · folio ${padFolio(number)} · ${size.name} · $${size.price} · ${branch.name}`,
          before: { status: before.status, branch: before.branch, size_hint: before.size_hint },
          after: { status: 'recibido', folio_number: number, branch: branch.name, size: size.name, price: size.price, paid: data.paid },
          ctx,
        });
        return false;
      });
      const envio = await getEnvio(id);
      if (!envio) throw new NotFoundError();
      return { envio, duplicate };
    } catch (err) {
      lastError = err;
      if (attempt < RECEIVE_MAX_ATTEMPTS && isRetryable(err)) {
        logger.warn('envios.receive_retry', { attempt, code: pgCodeOf(err) });
        await sleep(RETRY_DELAYS_MS[attempt - 1] ?? 400);
        continue;
      }
      throw err;
    }
  }
  logger.error('envios.receive_exhausted', lastError);
  throw new DatabaseError(lastError);
}

// ── 3) Correcciones (solo admin) ───────────────────────────────────────────
export async function updateEnvio(id: number, input: unknown, actor: Actor, ctx: RequestContext): Promise<Envio> {
  if (!can(actor.role as 'admin' | 'operador', 'envios.manage')) throw new ForbiddenError();
  const data = parseOrThrow(receiveSchema, input);
  await withTransaction(async (client) => {
    const before = await lockEnvio(client, id);
    if (before.status !== 'recibido') throw new ForbiddenError('Solo se pueden corregir envíos recibidos que no estén finalizados ni cancelados.');
    // Si el tamaño no cambió se conserva el precio original; si cambió se toma el precio vigente.
    let sizeId = before.size_id;
    let sizeName = before.size_name;
    let price = before.price;
    if (before.size_id !== data.size_id) {
      const s = await resolveSize(client, data.size_id);
      sizeId = s.id;
      sizeName = s.name;
      price = s.price;
    }
    const branch = before.branch_id === data.branch_id ? { id: before.branch_id, name: before.branch } : await resolveBranch(client, data.branch_id);
    const paidAt = data.paid ? (before.paid ? before.paid_at : new Date()) : null;
    await client.query(
      `UPDATE envios SET sender_name=$2, sender_phone=$3, recipient_name=$4, branch_id=$5, branch=$6, size_id=$7, size_name=$8,
              price=$9, weight_kg=$10, notes=$11, paid=$12, paid_at=$13
        WHERE id=$1`,
      [id, data.sender_name, data.sender_phone, data.recipient_name, branch.id, branch.name, sizeId, sizeName, price, data.weight_kg, data.notes, data.paid, paidAt],
    );
    await writeAudit(client, {
      actor,
      action: 'envios.update',
      entity: 'envios',
      entityId: id,
      summary: `Corrección del folio ${padFolio(before.folio_number ?? 0)}`,
      before: { sender: before.sender_name, recipient: before.recipient_name, branch: before.branch, size: before.size_name, price: before.price, weight_kg: before.weight_kg, paid: before.paid },
      after: { sender: data.sender_name, recipient: data.recipient_name, branch: branch.name, size: sizeName, price, weight_kg: data.weight_kg, paid: data.paid },
      ctx,
    });
  });
  const envio = await getEnvio(id);
  if (!envio) throw new NotFoundError();
  return envio;
}

export async function setPaid(id: number, paid: boolean, actor: Actor, ctx: RequestContext): Promise<void> {
  await withTransaction(async (client) => {
    const before = await lockEnvio(client, id);
    if (before.status !== 'recibido') throw new ForbiddenError('El cobro solo se cambia en envíos recibidos (no finalizados ni cancelados).');
    if (before.paid === paid) return;
    await client.query('UPDATE envios SET paid = $2, paid_at = CASE WHEN $2 THEN now() END WHERE id = $1', [id, paid]);
    await writeAudit(client, {
      actor,
      action: paid ? 'envios.paid' : 'envios.unpaid',
      entity: 'envios',
      entityId: id,
      summary: `Folio ${padFolio(before.folio_number ?? 0)} marcado como ${paid ? 'cobrado' : 'por cobrar'}`,
      before: { paid: before.paid },
      after: { paid },
      ctx,
    });
  });
}

/** Finalizado = entregado/cerrado. Solo la administradora. */
export async function finalizeEnvio(id: number, actor: Actor, ctx: RequestContext): Promise<void> {
  if (!can(actor.role as 'admin' | 'operador', 'envios.manage')) throw new ForbiddenError();
  await withTransaction(async (client) => {
    const before = await lockEnvio(client, id);
    if (before.status === 'finalizado') return;
    if (before.status !== 'recibido') throw new ForbiddenError('Solo se puede finalizar un envío que ya fue recibido.');
    await client.query(`UPDATE envios SET status = 'finalizado', finalized_at = now(), finalized_by_name = $2 WHERE id = $1`, [id, actor.name]);
    await writeAudit(client, {
      actor,
      action: 'envios.finalize',
      entity: 'envios',
      entityId: id,
      summary: `Folio ${padFolio(before.folio_number ?? 0)} finalizado`,
      before: { status: before.status },
      after: { status: 'finalizado' },
      ctx,
    });
  });
}

/**
 * Un envío NUNCA se borra. En espera → se descarta con motivo (operador o admin, sin folio).
 * Recibido (ya tiene folio) → se cancela con motivo (solo admin).
 */
export async function cancelEnvio(id: number, input: unknown, actor: Actor, ctx: RequestContext): Promise<{ discarded: boolean }> {
  const { reason } = parseOrThrow(reasonSchema, input);
  return withTransaction(async (client) => {
    const before = await lockEnvio(client, id);
    if (before.status === 'cancelado') throw new ForbiddenError('Este envío ya estaba cancelado.');
    if (before.status === 'finalizado') throw new ForbiddenError('Un envío finalizado ya no se puede cancelar.');
    const discarded = before.status === 'en_espera';
    if (!discarded && !can(actor.role as 'admin' | 'operador', 'envios.manage')) {
      throw new ForbiddenError('Solo la administradora puede cancelar un envío que ya tiene folio.');
    }
    await client.query(`UPDATE envios SET status = 'cancelado', cancel_reason = $2, cancelled_at = now(), cancelled_by = $3 WHERE id = $1`, [id, reason, actor.name]);
    await writeAudit(client, {
      actor,
      action: discarded ? 'envios.discard' : 'envios.cancel',
      entity: 'envios',
      entityId: id,
      summary: `${discarded ? `Envío en espera (código ${before.short_code}) descartado` : `Folio ${padFolio(before.folio_number ?? 0)} cancelado`}: ${reason}`.slice(0, 480),
      before: { status: before.status },
      after: { status: 'cancelado', reason },
      ctx,
    });
    return { discarded };
  });
}

// ── Presentación ───────────────────────────────────────────────────────────
/** Enlace wa.me con el comprobante ya redactado. Devuelve null si no hay teléfono utilizable. */
export function whatsappLink(e: Envio, template: string): string | null {
  const digits = e.sender_phone.replace(/\D/g, '');
  if (digits.length < 10 || e.folio_number === null) return null;
  const phone = digits.length === 10 ? `52${digits}` : digits;
  const values: Record<string, string> = {
    folio: padFolio(e.folio_number),
    remitente: e.sender_name,
    destinatario: e.recipient_name,
    tamano: e.size_name,
    precio: moneyMx(e.price),
    sucursal: e.branch,
    estado_pago: e.paid ? 'pagado' : 'por cobrar',
  };
  const text = template.replace(/\{(\w+)\}/g, (m, k: string) => (k in values ? values[k] : m));
  return `https://wa.me/${phone}?text=${encodeURIComponent(text.slice(0, 900))}`;
}

function csvCell(v: unknown): string {
  let t = v == null ? '' : v instanceof Date ? v.toISOString() : String(v);
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`; // evita inyección de fórmulas al abrir en Excel
  return `"${t.replace(/"/g, '""')}"`;
}

export function enviosToCsv(rows: Envio[], tz: string): string {
  const fmt = new Intl.DateTimeFormat('es-MX', { timeZone: tz, dateStyle: 'short', timeStyle: 'short' });
  const d = (v: Date | null) => (v ? fmt.format(v) : '');
  const head = ['Folio', 'Estado', 'Capturado', 'Recibido', 'Recibido por', 'Remitente', 'Teléfono', 'Quien recibe', 'Punto de entrega',
    'Peso kg', 'Tamaño', 'Tamaño sugerido por el cliente', 'Precio', 'Pago', 'Finalizado', 'Notas', 'Motivo cancelación'];
  const lines = [head.map(csvCell).join(',')];
  for (const r of rows) {
    lines.push([
      r.folio_number ? padFolio(r.folio_number) : '', STATUS_LABEL[r.status], d(r.created_at), d(r.received_at), r.received_by_name,
      r.sender_name, r.sender_phone, r.recipient_name, r.branch, r.weight_kg ?? '', r.size_name, r.size_hint, r.price ?? '',
      r.received_at ? (r.paid ? 'Cobrado' : 'Por cobrar') : '', d(r.finalized_at), r.notes, r.cancel_reason,
    ].map(csvCell).join(','));
  }
  return `﻿${lines.join('\r\n')}\r\n`;
}
