// BORRA todos los envíos y reinicia el contador de folios en 00001.
// Solo para limpiar las pruebas ANTES de empezar a operar. Los usuarios, puntos, tamaños y la bitácora no se tocan.
// Uso: npm run db:reset-pruebas
import { createClient, fail } from './_db.mjs';
import { ask } from './_prompt.mjs';

async function main() {
  const client = createClient();
  await client.connect();
  try {
    const { rows } = await client.query(
      `SELECT count(*)::int AS total, max(folio_number) AS ultimo FROM envios`,
    );
    const { total, ultimo } = rows[0];
    console.log(`\nHay ${total} envío(s) registrados; el último folio es ${ultimo ?? '—'}.`);
    console.log('Esto los BORRARÁ DEFINITIVAMENTE y el próximo folio será 00001.');
    const answer = (await ask('\nPara continuar escriba exactamente BORRAR PRUEBAS: ')).trim();
    if (answer !== 'BORRAR PRUEBAS') {
      console.log('Cancelado. No se cambió nada.');
      return;
    }
    await client.query('BEGIN');
    try {
      await client.query('ALTER TABLE envios DISABLE TRIGGER USER');
      await client.query('DELETE FROM envios');
      await client.query('ALTER TABLE envios ENABLE TRIGGER USER');
      await client.query('UPDATE folio_counter SET last_number = 0 WHERE id = 1');
      await client.query(
        `INSERT INTO audit_log (actor_username, actor_name, actor_role, action, entity, entity_id, summary)
         VALUES ('sistema', 'Sistema', 'system', 'sistema.reset_pruebas', 'envios', '*', $1)`,
        [`Se borraron ${total} envío(s) de prueba y se reinició el contador de folios`],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    }
    console.log(`✔ Listo: ${total} envío(s) borrados. El próximo folio será 00001.`);
  } finally {
    await client.end().catch(() => {});
  }
}

main().then(() => process.exit(0)).catch((err) => fail(err.message));
