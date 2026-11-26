// Crea los dos usuarios del sistema: el administrador (la dueña) y el operador (el ayudante del mostrador).
// Las contraseñas se piden por terminal (ocultas). No sobrescribe usuarios que ya existen.
// Uso: npm run db:seed
import bcrypt from 'bcryptjs';
import { createClient, fail } from './_db.mjs';
import { ask, askNewPassword, USERNAME_RE } from './_prompt.mjs';

async function askUser(label, defaultUsername, defaultName) {
  console.log(`\n── ${label} ──`);
  let username = '';
  for (;;) {
    username = (await ask(`  Usuario [${defaultUsername}]: `)).trim().toLowerCase() || defaultUsername;
    if (USERNAME_RE.test(username)) break;
    console.log('  Use de 3 a 30 caracteres: letras minúsculas, números, punto, guion o guion bajo.');
  }
  const name = (await ask(`  Nombre para mostrar [${defaultName}]: `)).trim() || defaultName;
  const password = await askNewPassword('  Contraseña');
  return { username, name, password };
}

async function main() {
  const client = createClient();
  await client.connect();
  try {
    const { rows } = await client.query('SELECT username, role FROM users');
    const hasAdmin = rows.some((r) => r.role === 'admin');
    const hasOperador = rows.some((r) => r.role === 'operador');
    if (hasAdmin && hasOperador) {
      console.log('✔ Ya existen el administrador y el operador. No se cambió nada.');
      console.log('  Para cambiar una contraseña use: npm run db:password');
      return;
    }
    const wanted = [];
    if (!hasAdmin) wanted.push({ role: 'admin', ...(await askUser('Administrador (la dueña)', 'admin', 'Administradora')) });
    if (!hasOperador) wanted.push({ role: 'operador', ...(await askUser('Operador (ayudante del mostrador)', 'mostrador', 'Mostrador')) });

    for (const u of wanted) {
      const hash = await bcrypt.hash(u.password, 12);
      const r = await client.query(
        `INSERT INTO users (username, name, role, password_hash) VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING RETURNING id`,
        [u.username, u.name, u.role, hash],
      );
      console.log(r.rowCount ? `✔ Usuario "${u.username}" (${u.role}) creado.` : `• "${u.username}" ya existía: no se cambió.`);
    }
  } finally {
    await client.end().catch(() => {});
  }
}

main().then(() => process.exit(0)).catch((err) => fail(err.message));
