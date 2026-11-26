import 'server-only';
import { query } from './db';
import { RateLimitError } from './errors';

const LOGIN_WINDOW_MIN = 15;
const LOGIN_MAX_PER_IP = 12;
const LOGIN_MAX_PER_USER = 6;

/** Bloquea si hay demasiados intentos fallidos recientes por IP o por usuario. */
export async function assertLoginAllowed(username: string, ipHash: string): Promise<void> {
  const rows = await query<{ by_ip: number; by_user: number }>(
    `SELECT
       count(*) FILTER (WHERE ip_hash = $1)::int AS by_ip,
       count(*) FILTER (WHERE lower(username) = lower($2))::int AS by_user
     FROM login_attempts
     WHERE success = FALSE AND created_at > now() - make_interval(mins => $3)`,
    [ipHash, username, LOGIN_WINDOW_MIN],
  );
  const r = rows[0];
  if (r && (r.by_ip >= LOGIN_MAX_PER_IP || r.by_user >= LOGIN_MAX_PER_USER)) {
    throw new RateLimitError(`Demasiados intentos fallidos. Espere ${LOGIN_WINDOW_MIN} minutos e inténtelo de nuevo.`);
  }
}

export async function recordLoginAttempt(username: string, ipHash: string, success: boolean): Promise<void> {
  await query('INSERT INTO login_attempts (username, ip_hash, success) VALUES ($1, $2, $3)', [username.slice(0, 80), ipHash, success]);
  if (Math.random() < 0.02) {
    await query(`DELETE FROM login_attempts WHERE created_at < now() - interval '7 days'`).catch(() => undefined);
  }
}
