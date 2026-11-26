import 'server-only';
import { cache } from 'react';
import { z } from 'zod';
import { writeAudit, type Actor } from './audit';
import { query, withTransaction } from './db';
import { ValidationError } from './errors';
import { cleanLine, cleanMultiline, type RequestContext } from './security';

export interface Settings {
  timezone: string;
  label_branch_title: string;
  label_note: string;
  wa_message: string;
}

const DEFAULTS: Settings = {
  timezone: 'America/Tijuana',
  label_branch_title: 'Entrega en',
  label_note: '',
  wa_message:
    'Hola {remitente}, su paquete quedó registrado con el folio {folio}.\nRecibe: {destinatario}\nPunto de entrega: {sucursal}\nTamaño: {tamano}\nCosto: {precio} ({estado_pago})\nGracias por su preferencia.',
};

export function safeTimezone(tz: string): string {
  try {
    new Intl.DateTimeFormat('es-MX', { timeZone: tz });
    return tz;
  } catch {
    return DEFAULTS.timezone;
  }
}

export const loadSettings = cache(async (): Promise<Settings> => {
  const rows = await query<{ key: string; value: string }>('SELECT key, value FROM settings');
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    timezone: safeTimezone(map.get('timezone') || DEFAULTS.timezone),
    label_branch_title: map.get('label_branch_title') ?? DEFAULTS.label_branch_title,
    label_note: map.get('label_note') ?? DEFAULTS.label_note,
    wa_message: map.get('wa_message') || DEFAULTS.wa_message,
  };
});

export const appTimezone = cache(async (): Promise<string> => (await loadSettings()).timezone);

const settingsSchema = z.object({
  label_branch_title: z
    .unknown()
    .transform((v) => cleanLine(v, 30))
    .refine((v) => v.length >= 2, { message: 'Escriba el encabezado (ej. Entrega en).' }),
  label_note: z.unknown().transform((v) => cleanLine(v, 80)),
  wa_message: z
    .unknown()
    .transform((v) => cleanMultiline(v, 500))
    .refine((v) => v.length >= 10, { message: 'El mensaje es muy corto.' }),
  timezone: z
    .unknown()
    .transform((v) => cleanLine(v, 60))
    .refine(
      (v) => {
        try {
          new Intl.DateTimeFormat('es-MX', { timeZone: v });
          return true;
        } catch {
          return false;
        }
      },
      { message: 'Zona horaria no válida. Ejemplo: America/Tijuana' },
    ),
});

export async function updateSettings(input: unknown, actor: Actor, ctx: RequestContext): Promise<void> {
  const r = settingsSchema.safeParse(input);
  if (!r.success) {
    const fe: Record<string, string> = {};
    for (const i of r.error.issues) fe[String(i.path[0] ?? 'form')] ??= i.message;
    throw new ValidationError(fe);
  }
  const data = r.data;
  await withTransaction(async (client) => {
    for (const [key, value] of Object.entries(data)) {
      await client.query(
        `INSERT INTO settings (key, value, updated_by) VALUES ($1, $2, $3)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by`,
        [key, value, actor.id],
      );
    }
    await writeAudit(client, {
      actor,
      action: 'settings.update',
      entity: 'settings',
      entityId: '*',
      summary: 'Ajustes de etiqueta y mensajes actualizados',
      after: data,
      ctx,
    });
  });
}
