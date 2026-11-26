import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { Empty, EnvioTable, EnvioTabs } from '@/components/panel/Shared';
import { requirePageUser } from '@/lib/auth';
import { listEnvios, tabCounts, type Envio, type TabCounts } from '@/lib/envios';
import { logger } from '@/lib/logger';
import { appTimezone } from '@/lib/settings';

export const metadata = { title: 'Finalizados' };
export const dynamic = 'force-dynamic';

export default async function FinalizedPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requirePageUser('envios.manage');
  const q = ((await searchParams).q ?? '').trim().slice(0, 80);
  const tz = await appTimezone();

  let rows: Envio[] = [];
  let counts: TabCounts | null = null;
  let failed = false;
  try {
    [rows, counts] = await Promise.all([listEnvios({ statuses: ['finalizado'], q }, tz, { limit: 200 }), tabCounts(tz)]);
  } catch (err) {
    failed = true;
    logger.error('finalized.page_failed', err, { user: user.id });
  }

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Envíos finalizados</h1>
          <p>Paquetes ya entregados y cerrados. Quedan como consulta: no se pueden modificar.</p>
        </div>
      </header>
      <EnvioTabs active="finalizados" counts={counts} role={user.role} />
      <form className="searchbar" action="/panel/finalizados" role="search">
        <input className="input" type="search" name="q" defaultValue={q} placeholder="Buscar por folio, nombre o teléfono…" aria-label="Buscar finalizados" maxLength={80} autoComplete="off" />
        <button type="submit" className="btn btn--primary"><Icon name="search" size={18} /> Buscar</button>
        {q && <Link className="btn btn--ghost" href="/panel/finalizados">Limpiar</Link>}
      </form>
      {failed ? (
        <p className="alert alert--error" role="alert"><Icon name="alert" size={18} /> <span>No pudimos cargar la lista. Inténtelo de nuevo en un momento.</span></p>
      ) : rows.length === 0 ? (
        <Empty icon={q ? 'search' : 'checkcircle'} title={q ? 'Sin resultados' : 'Todavía no hay envíos finalizados'} />
      ) : (
        <div className="card card--flush"><EnvioTable rows={rows} tz={tz} /></div>
      )}
    </>
  );
}
