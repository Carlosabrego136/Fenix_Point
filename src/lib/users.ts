import 'server-only';
import { writeAudit, type Actor } from './audit';
import { assertStrongPassword, createSession, destroySession, hashPassword, verifyPassword, type SessionUser } from './auth';
import { query, withTransaction } from './db';
import { AuthError, ForbiddenError, NotFoundError, RateLimitError, ValidationError } from './errors';
import { logger } from './logger';
import { assertLoginAllowed, recordLoginAttempt } from './rate-limit';
import type { Role } from './permissions';
import { cleanLine, type RequestContext } from './security';

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

interface LoginRow {
  id: number;
  username: string;
  name: string;
  role: Role;
  password_hash: string;
  is_active: boolean;
  failed_attempts: number;
  locked_until: Date | null;
  token_version: number;
}

export const actorOf = (u: SessionUser): Actor => ({ id: u.id, username: u.username, name: u.name, role: u.role });

export async function authenticate(rawUsername: unknown, rawPassword: unknown, ctx: RequestContext): Promise<void> {
  const username = cleanLine(rawUsername, 40).toLowerCase();
  const password = typeof rawPassword === 'string' ? rawPassword.slice(0, 200) : '';
  if (!username || !password) throw new AuthError();

  await assertLoginAllowed(username, ctx.ipHash);

  const rows = await query<LoginRow>(
    `SELECT id, username, name, role, password_hash, is_active, failed_attempts, locked_until, token_version
       FROM users WHERE lower(username) = lower($1)`,
    [username],
  );
  const user = rows[0];

  if (user?.locked_until && user.locked_until.getTime() > Date.now()) {
    await recordLoginAttempt(username, ctx.ipHash, false);
    throw new RateLimitError(`Cuenta bloqueada temporalmente por intentos fallidos. Inténtelo en ${LOCK_MINUTES} minutos.`);
  }

  const passwordOk = await verifyPassword(password, user?.password_hash ?? null);

  if (!user || !user.is_active || !passwordOk) {
    await recordLoginAttempt(username, ctx.ipHash, false);
    if (user) {
      await withTransaction(async (client) => {
        const { rows: updated } = await client.query<{ failed_attempts: number }>(
          `UPDATE users
              SET failed_attempts = failed_attempts + 1,
                  locked_until = CASE WHEN failed_attempts + 1 >= $2 THEN now() + make_interval(mins => $3) ELSE locked_until END
            WHERE id = $1 RETURNING failed_attempts`,
          [user.id, MAX_FAILED, LOCK_MINUTES],
        );
        await writeAudit(client, {
          actor: { id: user.id, username: user.username, name: user.name, role: user.role },
          action: 'auth.login_failed',
          entity: 'users',
          entityId: user.id,
          summary: `Intento de acceso fallido (${updated[0]?.failed_attempts ?? '?'} seguido/s)`,
          ctx,
        });
      }).catch((err) => logger.error('auth.failed_login_bookkeeping', err));
    }
    throw new AuthError();
  }

  await withTransaction(async (client) => {
    await client.query('UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login_at = now() WHERE id = $1', [user.id]);
    await writeAudit(client, {
      actor: { id: user.id, username: user.username, name: user.name, role: user.role },
      action: 'auth.login',
      entity: 'users',
      entityId: user.id,
      summary: 'Inicio de sesión',
      ctx,
    });
  });
  await recordLoginAttempt(username, ctx.ipHash, true).catch((err) => logger.warn('auth.attempt_log_failed', { error: String(err) }));
  await createSession({ id: user.id, username: user.username, name: user.name, role: user.role, token_version: user.token_version });
}

export async function logout(user: SessionUser | null, ctx: RequestContext): Promise<void> {
  try {
    if (user) {
      await withTransaction((client) =>
        writeAudit(client, { actor: actorOf(user), action: 'auth.logout', entity: 'users', entityId: user.id, summary: 'Cierre de sesión', ctx }),
      );
    }
  } catch (err) {
    logger.warn('auth.logout_audit_failed', { error: String(err) });
  } finally {
    await destroySession().catch(() => undefined);
  }
}

// ── Contraseñas ────────────────────────────────────────────────

/** Cada usuario cambia la suya (pide la actual). Cierra las demás sesiones y deja la actual abierta. */
export async function changeOwnPassword(user: SessionUser, input: { current: unknown; next: unknown; confirm: unknown }, ctx: RequestContext): Promise<void> {
  const current = typeof input.current === 'string' ? input.current : '';
  const next = typeof input.next === 'string' ? input.next : '';
  const confirm = typeof input.confirm === 'string' ? input.confirm : '';
  if (!current) throw new ValidationError({ current: 'Escriba su contraseña actual.' });
  assertStrongPassword(next, 'next');
  if (next !== confirm) throw new ValidationError({ confirm: 'Las contraseñas no coinciden.' });
  if (next === current) throw new ValidationError({ next: 'La nueva contraseña debe ser diferente.' });

  const rows = await query<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = $1', [user.id]);
  if (!(await verifyPassword(current, rows[0]?.password_hash ?? null))) {
    throw new ValidationError({ current: 'La contraseña actual no es correcta.' });
  }
  const hash = await hashPassword(next);
  const version = await withTransaction(async (client) => {
    const { rows: upd } = await client.query<{ token_version: number }>(
      'UPDATE users SET password_hash = $2, token_version = token_version + 1 WHERE id = $1 RETURNING token_version',
      [user.id, hash],
    );
    await writeAudit(client, { actor: actorOf(user), action: 'users.password_change', entity: 'users', entityId: user.id, summary: 'Cambió su contraseña', ctx });
    return upd[0].token_version;
  });
  await createSession({ ...user, token_version: version });
}

export interface OperatorRow {
  id: number;
  username: string;
  name: string;
  is_active: boolean;
  last_login_at: Date | null;
}

export async function listOperators(): Promise<OperatorRow[]> {
  return query<OperatorRow>(`SELECT id, username, name, is_active, last_login_at FROM users WHERE role = 'operador' ORDER BY id`);
}

/** El admin restablece la contraseña de un operador (cierra sus sesiones y lo desbloquea). */
export async function resetOperatorPassword(admin: SessionUser, operatorId: number, input: { next: unknown; confirm: unknown }, ctx: RequestContext): Promise<void> {
  if (admin.role !== 'admin') throw new ForbiddenError();
  const next = typeof input.next === 'string' ? input.next : '';
  const confirm = typeof input.confirm === 'string' ? input.confirm : '';
  assertStrongPassword(next, 'next');
  if (next !== confirm) throw new ValidationError({ confirm: 'Las contraseñas no coinciden.' });
  const hash = await hashPassword(next);
  await withTransaction(async (client) => {
    const { rows } = await client.query<{ username: string }>(
      `UPDATE users SET password_hash = $2, token_version = token_version + 1, failed_attempts = 0, locked_until = NULL
        WHERE id = $1 AND role = 'operador' RETURNING username`,
      [operatorId, hash],
    );
    if (!rows[0]) throw new NotFoundError('El operador no existe.');
    await writeAudit(client, {
      actor: actorOf(admin),
      action: 'users.password_reset',
      entity: 'users',
      entityId: operatorId,
      summary: `Restableció la contraseña del operador "${rows[0].username}"`,
      ctx,
    });
  });
}
