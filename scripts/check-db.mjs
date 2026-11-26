// Verifica la conexión a la base y que el esquema esté aplicado. Uso: npm run db:check
import { createClient, fail } from './_db.mjs';

async function main() {
  const client = createClient();
  await client.connect();
  const { rows } = await client.query('SELECT version() AS v');
  console.log(`✔ Conexión correcta · ${rows[0].v.split(',')[0]}`);
  const { rows: tables } = await client.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
  );
  const names = new Set(tables.map((t) => t.table_name));
  const required = ['users', 'audit_log', 'settings', 'branches', 'sizes', 'folio_counter', 'envios'];
  const missing = required.filter((t) => !names.has(t));
  console.log(missing.length ? `⚠ Faltan tablas: ${missing.join(', ')} → ejecute: npm run db:migrate` : '✔ Esquema completo.');
  if (!missing.includes('users')) {
    const u = await client.query(`SELECT role, count(*)::int AS n FROM users GROUP BY role`);
    console.log(u.rows.length ? `✔ Usuarios: ${u.rows.map((r) => `${r.role}=${r.n}`).join(', ')}` : '⚠ Sin usuarios → ejecute: npm run db:seed');
  }
  await client.end();
}

main().catch((err) => fail(`No se pudo conectar: ${err.message}`));
