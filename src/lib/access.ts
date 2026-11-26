import 'server-only';
import type { Envio } from './envios';
import type { Role } from './permissions';
import { todayISO } from './format';

function dayOf(date: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

/** El operador solo ve lo que está en espera y lo que recibió HOY. La administradora ve todo. */
export function canViewEnvio(role: Role, e: Envio, tz: string): boolean {
  if (role === 'admin') return true;
  if (e.status === 'en_espera') return true;
  if (e.status === 'cancelado' && !e.received_at) return false;
  return Boolean(e.received_at) && dayOf(e.received_at as Date, tz) === todayISO(tz);
}
