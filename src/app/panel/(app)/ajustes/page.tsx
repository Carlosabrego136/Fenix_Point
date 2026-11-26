import { Icon } from '@/components/Icon';
import { BranchForm, SettingsForm, SizeForm } from '@/components/panel/SettingsForms';
import { requirePageUser } from '@/lib/auth';
import { listBranches, listSizes, type Branch, type Size } from '@/lib/catalog';
import { logger } from '@/lib/logger';
import { loadSettings, type Settings } from '@/lib/settings';

export const metadata = { title: 'Ajustes' };
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  await requirePageUser('settings.write');
  let branches: Branch[] = [];
  let sizes: Size[] = [];
  let settings: Settings | null = null;
  let failed = false;
  try {
    [branches, sizes, settings] = await Promise.all([listBranches(false), listSizes(), loadSettings()]);
  } catch (err) {
    failed = true;
    logger.error('settings.page_failed', err);
  }

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Ajustes</h1>
          <p>Puntos de recolección, tamaños y precios, y los textos de la etiqueta. Nada se borra: lo que ya no se use se desactiva.</p>
        </div>
      </header>

      {failed || !settings ? (
        <p className="alert alert--error" role="alert"><Icon name="alert" size={18} /> <span>No pudimos cargar los ajustes. Inténtelo de nuevo en un momento.</span></p>
      ) : (
        <>
          <section className="card stack" aria-labelledby="h-puntos">
            <div>
              <h2 id="h-puntos">Puntos de recolección</h2>
              <p className="muted">Son las opciones que ve el cliente al registrar su envío y que se imprimen en la etiqueta. Para sumar «Cucapá» u otro punto, agréguelo aquí.</p>
            </div>
            {branches.map((b) => (
              <div key={b.id} style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}><BranchForm branch={b} /></div>
            ))}
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}><BranchForm branch={null} /></div>
            <p className="mini">Un punto desactivado deja de aparecer para los clientes, pero los envíos anteriores conservan su punto.</p>
          </section>

          <section className="card stack" aria-labelledby="h-tamanos">
            <div>
              <h2 id="h-tamanos">Tamaños y precios</h2>
              <p className="muted">El mostrador elige el tamaño al recibir el paquete y el precio queda guardado en ese momento: cambiar un precio aquí <b>no</b> modifica los folios ya creados.</p>
            </div>
            {sizes.map((s) => (
              <div key={s.id} style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}><SizeForm size={s} /></div>
            ))}
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}><SizeForm size={null} /></div>
          </section>

          <section className="card stack" aria-labelledby="h-etiqueta">
            <div>
              <h2 id="h-etiqueta">Etiqueta, mensaje y zona horaria</h2>
            </div>
            <SettingsForm settings={settings} />
          </section>
        </>
      )}
    </>
  );
}
