export function todayISO(timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function formatDateTime(value: Date | string | null, timeZone = 'America/Tijuana'): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(date);
}

export function formatTime(value: Date | string | null, timeZone = 'America/Tijuana'): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-MX', { timeStyle: 'short', timeZone }).format(date);
}

export const padFolio = (n: number) => String(n).padStart(5, '0');

export function moneyMx(value: string | number | null): string {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(Number.isFinite(n) ? n : 0);
}

/** "hace 5 min", "hace 2 h", "hace 3 d" */
export function waitingLabel(since: Date | string, now = Date.now()): string {
  const t = (typeof since === 'string' ? new Date(since) : since).getTime();
  const min = Math.max(0, Math.round((now - t) / 60000));
  if (min < 1) return 'justo ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}
