// Cambia la contraseña de un usuario desde la terminal (por ejemplo si se bloquea o se olvida).
// Cierra sus sesiones abiertas y lo desbloquea. Uso: npm run db:password
import bcrypt from 'bcryptjs';
import { createClient, fail } from './_db.mjs';
import { ask, askNewPassword } from './_prompt.mjs';

async function main() {
  const client = createClient();
  await client.connect();
  try {
    const { rows } = await client.query('SELECT username, name, role FROM users ORDER BY role, username');
    if (rows.length === 0) fail('No hay usuarios. Ejecute primero: npm run db:seed');
    console.log('Usuarios:');
    for (const r of rows) console.log(`  • ${r.username} (${r.role}) — ${r.name}`);
    const username = (await ask('\nUsuario a modificar: ')).trim().toLowerCase();
    if (!rows.some((r) => r.username === username)) fail('Ese usuario no existe.');
    const password = await askNewPassword('Nueva contraseña');
    const hash = await bcrypt.hash(password, 12);
    await client.query(
      `UPDATE users SET password_hash = $2, token_version = token_version + 1, failed_attempts = 0, locked_until = NULL
        WHERE lower(username) = lower($1)`,
      [username, hash],
    );
    await client.query(
      `INSERT INTO audit_log (actor_username, actor_name, actor_role, action, entity, entity_id, summary)
       VALUES ('sistema', 'Sistema', 'system', 'users.password_reset_cli', 'users', $1, $2)`,
      [username, `Contraseña de "${username}" cambiada desde la terminal`],
    );
    console.log(`✔ Contraseña de "${username}" actualizada. Sus sesiones abiertas se cerraron.`);
  } finally {
    await client.end().catch(() => {});
  }
}

main().then(() => process.exit(0)).catch((err) => fail(err.message));
