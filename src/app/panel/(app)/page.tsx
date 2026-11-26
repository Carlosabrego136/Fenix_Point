import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AutoRefresh } from '@/components/ui/Bits';
import { Icon } from '@/components/Icon';
import { SearchBox } from '@/components/panel/SearchBox';
import { Empty, EnvioTabs, Flash } from '@/components/panel/Shared';
import { requirePageUser } from '@/lib/auth';
import { listEnvios, summarize, tabCounts, type Envio, type EnvioSummary, type TabCounts } from '@/lib/envios';
import { formatTime, moneyMx, waitingLabel } from '@/lib/format';
import { logger } from '@/lib/logger';
import { can } from '@/lib/permissions';
import { appTimezone } from '@/lib/settings';

export const metadata = { title: 'En espera' };
export const dynamic = 'force-dynamic';

export default async function WaitingPage({ searchParams }: { searchParams: Promise<{ q?: string; ok?: string; error?: string; aviso?: string }> }) {
  const user = await requirePageUser('envios.operate');
  const sp = await searchParams;
  const tz = await appTimezone();
  const q = (sp.q ?? '').trim().slice(0, 80);
  const admin = can(user.role, 'envios.manage');

  let rows: Envio[] = [];
  let counts: TabCounts | null = null;
  let today: EnvioSummary | null = null;
  let failed = false;
  try {
    [rows, counts, today] = await Promise.all([
      listEnvios({ statuses: ['en_espera'], q }, tz, { order: 'oldest', limit: 200 }),
      tabCounts(tz),
      admin ? summarize({ today: true }, tz) : Promise.resolve(null),
    ]);
  } catch (err) {
    failed = true;
    logger.error('waiting.page_failed', err, { user: user.id });
  }

  // Atajo del mostrador: si escriben un código de 4 dígitos y hay UN solo envío, se abre directo para recibirlo.
  if (!failed && /^\d{4}$/.test(q) && rows.length === 1) redirect(`/panel/recibir/${rows[0].id}`);

  return (
    <>
      {!q && <AutoRefresh seconds={20} />}
      <header className="page-head">
        <div>
          <h1>Envíos en espera</h1>
          <p>Capturas de los clientes que aún no llegan al mostrador. Al recibir el paquete se genera su folio y su etiqueta.</p>
        </div>
      </header>

      <Flash ok={sp.ok} error={sp.error} aviso={sp.aviso} />
      <EnvioTabs active="espera" counts={counts} role={user.role} />

      <div className="stats">
        <div className="stat stat--warn"><strong>{counts?.en_espera ?? '—'}</strong><span>En espera de llegar</span></div>
        <div className="stat"><strong>{counts?.recibido_hoy ?? '—'}</strong><span>Recibidos hoy</span></div>
        {admin && today && (
          <>
            <div className="stat stat--ok"><strong>{moneyMx(today.paid_amount)}</strong><span>Cobrado hoy ({today.paid_count})</span></div>
            <div className="stat stat--warn"><strong>{moneyMx(today.pending_amount)}</strong><span>Por cobrar hoy ({today.pending_count})</span></div>
          </>
        )}
      </div>

      <form className="searchbar" action="/panel" role="search">
        <SearchBox defaultValue={q} />
        <button type="submit" className="btn btn--primary"><Icon name="search" size={18} /> Buscar</button>
        {q && <Link className="btn btn--ghost" href="/panel">Ver todos</Link>}
      </form>

      {failed ? (
        <p className="alert alert--error" role="alert"><Icon name="alert" size={18} /> <span>No pudimos cargar la lista. Revise la conexión e inténtelo de nuevo en un momento.</span></p>
      ) : rows.length === 0 ? (
        <Empty icon={q ? 'search' : 'inbox'} title={q ? 'No hay envíos en espera con esa búsqueda' : 'No hay envíos en espera'} text={q ? 'Revise el código o el nombre.' : 'Cuando un cliente registre un envío por el QR, aparecerá aquí en unos segundos.'} />
      ) : (
        <div className="queue" aria-label="Envíos en espera">
          {rows.map((e) => (
            <article className="queue__item" key={e.id}>
              <div className="codebadge"><small>Código</small><strong>{e.short_code}</strong></div>
              <div className="queue__main">
                <div className="queue__names">
                  {e.sender_name} <Icon name="arrow" size={16} /> {e.recipient_name}
                </div>
                <div className="queue__meta">
                  <span><Icon name="pin" size={15} /> {e.branch}</span>
                  {e.size_hint && <span><Icon name="tag" size={15} /> Sugiere {e.size_hint}</span>}
                  {e.sender_phone && <span><Icon name="phone" size={15} /> {e.sender_phone}</span>}
                  <span><Icon name="clock" size={15} /> {formatTime(e.created_at, tz)} · {waitingLabel(e.created_at)}</span>
                </div>
              </div>
              <div className="queue__act">
                <Link className="btn btn--primary" href={`/panel/recibir/${e.id}`}>Recibir <Icon name="arrow" size={17} /></Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
