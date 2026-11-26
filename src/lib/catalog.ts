import 'server-only';
import { z } from 'zod';
import { writeAudit, type Actor } from './audit';
import { query, withTransaction } from './db';
import { ConflictError, ValidationError } from './errors';
import { cleanLine, type RequestContext } from './security';

export interface Branch {
  id: number;
  name: string;
  sort_order: number;
  is_active: boolean;
}

export interface Size {
  id: number;
  name: string;
  description: string;
  price: string;
  show_public: boolean;
  sort_order: number;
  is_active: boolean;
}

export async function listBranches(onlyActive = false): Promise<Branch[]> {
  return query<Branch>(`SELECT id, name, sort_order, is_active FROM branches ${onlyActive ? 'WHERE is_active' : ''} ORDER BY sort_order, id`);
}

export async function listSizes(opts: { onlyActive?: boolean; onlyPublic?: boolean } = {}): Promise<Size[]> {
  const conds: string[] = [];
  if (opts.onlyActive || opts.onlyPublic) conds.push('is_active');
  if (opts.onlyPublic) conds.push('show_public');
  return query<Size>(
    `SELECT id, name, description, price::text, show_public, sort_order, is_active
       FROM sizes ${conds.length ? `WHERE ${conds.join(' AND ')}` : ''} ORDER BY sort_order, id`,
  );
}

function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) out[String(issue.path[0] ?? 'form')] ??= issue.message;
  return out;
}

const orderField = z.unknown().transform((v, ctx) => {
  const t = cleanLine(v, 6);
  if (t === '') return 0;
  const n = Number(t);
  if (!Number.isInteger(n) || n < 0 || n > 9999) {
    ctx.addIssue({ code: 'custom', message: 'Orden inválido (0 a 9999).' });
    return z.NEVER;
  }
  return n;
});

const flag = z.unknown().transform((v) => v === 'on' || v === 'true' || v === true);

const branchSchema = z.object({
  name: z
    .unknown()
    .transform((v) => cleanLine(v, 80))
    .refine((v) => v.length >= 2, { message: 'Escriba el nombre del punto (mínimo 2 letras).' }),
  sort_order: orderField,
  is_active: flag,
});

const sizeSchema = z.object({
  name: z
    .unknown()
    .transform((v) => cleanLine(v, 60))
    .refine((v) => v.length >= 1, { message: 'Escriba el nombre del tamaño.' }),
  description: z.unknown().transform((v) => cleanLine(v, 120)),
  price: z.unknown().transform((v, ctx) => {
    const t = cleanLine(v, 12).replace(/[$,\s]/g, '');
    if (!/^\d{1,7}(\.\d{1,2})?$/.test(t)) {
      ctx.addIssue({ code: 'custom', message: 'Precio inválido. Ejemplo: 45 o 45.50' });
      return z.NEVER;
    }
    return Number(t);
  }),
  sort_order: orderField,
  show_public: flag,
  is_active: flag,
});

function parse<T extends z.ZodTypeAny>(schema: T, input: unknown): z.infer<T> {
  const r = schema.safeParse(input);
  if (!r.success) throw new ValidationError(fieldErrors(r.error));
  return r.data;
}

export async function saveBranch(id: number | null, input: unknown, actor: Actor, ctx: RequestContext): Promise<void> {
  const d = parse(branchSchema, input);
  try {
    await withTransaction(async (client) => {
      if (id === null) {
        const { rows } = await client.query<{ id: number }>('INSERT INTO branches (name, sort_order, is_active) VALUES ($1,$2,$3) RETURNING id', [d.name, d.sort_order, d.is_active]);
        await writeAudit(client, { actor, action: 'branches.create', entity: 'branches', entityId: rows[0].id, summary: `Punto "${d.name}" agregado`, after: d, ctx });
      } else {
        const { rows: before } = await client.query('SELECT name, sort_order, is_active FROM branches WHERE id = $1 FOR UPDATE', [id]);
        if (!before[0]) throw new ValidationError({ name: 'El punto no existe.' });
        await client.query('UPDATE branches SET name=$2, sort_order=$3, is_active=$4 WHERE id=$1', [id, d.name, d.sort_order, d.is_active]);
        await writeAudit(client, { actor, action: 'branches.update', entity: 'branches', entityId: id, summary: `Punto "${d.name}" actualizado`, before: before[0], after: d, ctx });
      }
    });
  } catch (err) {
    if (err instanceof ConflictError) throw new ValidationError({ name: 'Ya existe un punto con ese nombre.' });
    throw err;
  }
}

export async function saveSize(id: number | null, input: unknown, actor: Actor, ctx: RequestContext): Promise<void> {
  const d = parse(sizeSchema, input);
  try {
    await withTransaction(async (client) => {
      if (id === null) {
        const { rows } = await client.query<{ id: number }>(
          'INSERT INTO sizes (name, description, price, show_public, sort_order, is_active) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
          [d.name, d.description, d.price, d.show_public, d.sort_order, d.is_active],
        );
        await writeAudit(client, { actor, action: 'sizes.create', entity: 'sizes', entityId: rows[0].id, summary: `Tamaño "${d.name}" agregado ($${d.price})`, after: d, ctx });
      } else {
        const { rows: before } = await client.query('SELECT name, description, price::text, show_public, sort_order, is_active FROM sizes WHERE id = $1 FOR UPDATE', [id]);
        if (!before[0]) throw new ValidationError({ name: 'El tamaño no existe.' });
        await client.query('UPDATE sizes SET name=$2, description=$3, price=$4, show_public=$5, sort_order=$6, is_active=$7 WHERE id=$1', [
          id, d.name, d.description, d.price, d.show_public, d.sort_order, d.is_active,
        ]);
        await writeAudit(client, { actor, action: 'sizes.update', entity: 'sizes', entityId: id, summary: `Tamaño "${d.name}" actualizado ($${d.price})`, before: before[0], after: d, ctx });
      }
    });
  } catch (err) {
    if (err instanceof ConflictError) throw new ValidationError({ name: 'Ya existe un tamaño con ese nombre.' });
    throw err;
  }
}
