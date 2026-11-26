import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { Empty, EnvioTable, EnvioTabs } from '@/components/panel/Shared';
import { requirePageUser } from '@/lib/auth';
import { listEnvios, tabCounts, type Envio, type TabCounts } from '@/lib/envios';
import { logger } from '@/lib/logger';
import { can } from '@/lib/permissions';
import { appTimezone } from '@/lib/settings';

export const metadata = { title: 'Recibidos' };
export const dynamic = 'force-dynamic';

export default async function ReceivedPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requirePageUser('envios.operate');
  const q = ((await searchParams).q ?? '').trim().slice(0, 80);
  const tz = await appTimezone();
  const admin = can(user.role, 'envios.manage');

  let rows: Envio[] = [];
  let counts: TabCounts | null = null;
  let failed = false;
  try {
    // El mostrador solo ve lo que recibió hoy (para reimprimir una etiqueta); la administradora ve todo lo recibido sin finalizar.
    [rows, counts] = await Promise.all([
      listEnvios(admin ? { statuses: ['recibido'], q } : { statuses: ['recibido', 'finalizado'], today: true, q }, tz, { limit: 200 }),
      tabCounts(tz),
    ]);
  } catch (err) {
    failed = true;
    logger.error('received.page_failed', err, { user: user.id });
  }

  return (
    <>
      <header className="page-head">
        <div>
          <h1>{admin ? 'Paquetes recibidos' : 'Recibidos hoy'}</h1>
          <p>{admin ? 'Paquetes que ya tienen folio y siguen su camino. Cuando se entregan, márquelos como finalizados.' : 'Los paquetes que recibió hoy. Desde aquí puede reimprimir una etiqueta.'}</p>
        </div>
      </header>
      <EnvioTabs active="recibidos" counts={counts} role={user.role} />
      <form className="searchbar" action="/panel/recibidos" role="search">
        <input className="input" type="search" name="q" defaultValue={q} placeholder="Buscar por folio, nombre o teléfono…" aria-label="Buscar recibidos" maxLength={80} autoComplete="off" />
        <button type="submit" className="btn btn--primary"><Icon name="search" size={18} /> Buscar</button>
        {q && <Link className="btn btn--ghost" href="/panel/recibidos">Limpiar</Link>}
      </form>
      {failed ? (
        <p className="alert alert--error" role="alert"><Icon name="alert" size={18} /> <span>No pudimos cargar la lista. Inténtelo de nuevo en un momento.</span></p>
      ) : rows.length === 0 ? (
        <Empty icon={q ? 'search' : 'box'} title={q ? 'Sin resultados' : admin ? 'No hay paquetes recibidos pendientes' : 'Todavía no recibe paquetes hoy'} />
      ) : (
        <div className="card card--flush"><EnvioTable rows={rows} tz={tz} showStatus={!admin} /></div>
      )}
    </>
  );
}
