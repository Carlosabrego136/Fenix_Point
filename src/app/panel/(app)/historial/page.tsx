import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { Empty, EnvioTable } from '@/components/panel/Shared';
import { requirePageUser } from '@/lib/auth';
import { listBranches } from '@/lib/catalog';
import { listEnvios, LIST_LIMIT, summarize, type Envio, type EnvioFilters, type EnvioStatus, type EnvioSummary } from '@/lib/envios';
import { moneyMx } from '@/lib/format';
import { logger } from '@/lib/logger';
import { appTimezone } from '@/lib/settings';

export const metadata = { title: 'Historial' };
export const dynamic = 'force-dynamic';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES: EnvioStatus[] = ['en_espera', 'recibido', 'finalizado', 'cancelado'];

type SP = { q?: string; estado?: string; from?: string; to?: string; cobro?: string; punto?: string };

function filtersFrom(sp: SP): EnvioFilters {
  return {
    q: (sp.q ?? '').slice(0, 80),
    statuses: STATUSES.includes(sp.estado as EnvioStatus) ? [sp.estado as EnvioStatus] : undefined,
    from: sp.from && DATE_RE.test(sp.from) ? sp.from : undefined,
    to: sp.to && DATE_RE.test(sp.to) ? sp.to : undefined,
    paid: sp.cobro === 'si' || sp.cobro === 'no' ? sp.cobro : '',
    branch_id: Number(sp.punto) > 0 ? Number(sp.punto) : undefined,
  };
}

export default async function HistoryPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requirePageUser('envios.manage');
  const sp = await searchParams;
  const tz = await appTimezone();
  const filters = filtersFrom(sp);

  let rows: Envio[] = [];
  let summary: EnvioSummary | null = null;
  let branches: { id: number; name: string }[] = [];
  let failed = false;
  try {
    const [r, s, b] = await Promise.all([listEnvios(filters, tz, { limit: LIST_LIMIT }), summarize(filters, tz), listBranches(false)]);
    rows = r;
    summary = s;
    branches = b;
  } catch (err) {
    failed = true;
    logger.error('history.failed', err, { user: user.id });
  }
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === 'string' && v !== '') as [string, string][]).toString();

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Historial de envíos</h1>
          <p>Todos los envíos: en espera, recibidos, finalizados, cancelados y descartados.</p>
        </div>
        <div className="page-head__actions">
          <a className="btn btn--ghost" href={`/panel/exportar${qs ? `?${qs}` : ''}`}><Icon name="download" size={18} /> Exportar a Excel (CSV)</a>
        </div>
      </header>

      <form className="card" action="/panel/historial" style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', alignItems: 'end' }}>
        <div className="field span-2">
          <label htmlFor="q">Buscar</label>
          <input id="q" name="q" className="input input--sm" type="search" defaultValue={filters.q} placeholder="Folio, código, nombre o teléfono" maxLength={80} />
        </div>
        <div className="field">
          <label htmlFor="estado">Estado</label>
          <select id="estado" name="estado" className="select input--sm" defaultValue={sp.estado ?? ''}>
            <option value="">Todos</option>
            <option value="en_espera">En espera</option>
            <option value="recibido">Recibido</option>
            <option value="finalizado">Finalizado</option>
            <option value="cancelado">Cancelado / descartado</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="punto">Punto</label>
          <select id="punto" name="punto" className="select input--sm" defaultValue={sp.punto ?? ''}>
            <option value="">Todos</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="cobro">Cobro</label>
          <select id="cobro" name="cobro" className="select input--sm" defaultValue={sp.cobro ?? ''}>
            <option value="">Todos</option>
            <option value="si">Cobrado</option>
            <option value="no">Por cobrar</option>
          </select>
        </div>
        <div className="field"><label htmlFor="from">Desde</label><input id="from" name="from" className="input input--sm" type="date" defaultValue={filters.from} /></div>
        <div className="field"><label htmlFor="to">Hasta</label><input id="to" name="to" className="input input--sm" type="date" defaultValue={filters.to} /></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" className="btn btn--primary btn--sm">Filtrar</button>
          <Link className="btn btn--ghost btn--sm" href="/panel/historial">Limpiar</Link>
        </div>
      </form>

      {summary && !failed && (
        <div className="stats">
          <div className="stat"><strong>{summary.active}</strong><span>Envíos con folio</span></div>
          <div className="stat stat--ok"><strong>{moneyMx(summary.paid_amount)}</strong><span>Cobrado ({summary.paid_count})</span></div>
          <div className="stat stat--warn"><strong>{moneyMx(summary.pending_amount)}</strong><span>Por cobrar ({summary.pending_count})</span></div>
          <div className="stat stat--bad"><strong>{summary.cancelled}</strong><span>Cancelados</span></div>
        </div>
      )}

      {failed ? (
        <p className="alert alert--error" role="alert"><Icon name="alert" size={18} /> <span>No pudimos cargar el historial. Inténtelo de nuevo en un momento.</span></p>
      ) : rows.length === 0 ? (
        <Empty icon="search" title="No hay envíos con esos filtros" />
      ) : (
        <>
          <div className="card card--flush"><EnvioTable rows={rows} tz={tz} showStatus /></div>
          {rows.length >= LIST_LIMIT && <p className="mini">Se muestran los {LIST_LIMIT} más recientes. Use los filtros o exporte para ver más.</p>}
        </>
      )}
    </>
  );
}
