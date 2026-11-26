// Aplica las migraciones pendientes durante el despliegue (Vercel) para que la base de datos
// siempre quede al día con el código. Es seguro repetirlo: solo corre las que faltan.
// Si la base de datos no está disponible durante el build, no se detiene el despliegue.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

if (!process.env.DATABASE_URL && !existsSync('.env.local') && !existsSync('.env')) {
  console.log('• Sin DATABASE_URL: se omiten las migraciones del build.');
  process.exit(0);
}
const result = spawnSync(process.execPath, ['scripts/migrate.mjs'], { stdio: 'inherit' });
if (result.status !== 0) {
  console.warn('\n⚠ No se pudieron aplicar las migraciones durante el build. Ejecute "npm run db:migrate" manualmente.');
}
process.exit(0);
