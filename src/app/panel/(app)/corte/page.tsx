import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { PrintNow } from '@/components/ui/Bits';
import { requirePageUser } from '@/lib/auth';
import { corteDelDia, type Corte } from '@/lib/envios';
import { moneyMx, todayISO } from '@/lib/format';
import { logger } from '@/lib/logger';
import { appTimezone } from '@/lib/settings';

export const metadata = { title: 'Corte del día' };
export const dynamic = 'force-dynamic';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function CortePage({ searchParams }: { searchParams: Promise<{ fecha?: string }> }) {
  await requirePageUser('envios.manage');
  const sp = await searchParams;
  const tz = await appTimezone();
  const today = todayISO(tz);
  const date = sp.fecha && DATE_RE.test(sp.fecha) ? sp.fecha : today;

  let corte: Corte | null = null;
  try {
    corte = await corteDelDia(date, tz);
  } catch (err) {
    logger.error('corte.failed', err, { date });
  }
  const dateLabel = new Intl.DateTimeFormat('es-MX', { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Corte del día</h1>
          <p style={{ textTransform: 'capitalize' }}>{dateLabel}</p>
        </div>
        <div className="page-head__actions no-print"><PrintNow auto={false} label="Imprimir corte" /></div>
      </header>

      <form className="card no-print" action="/panel/corte" style={{ display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap' }}>
        <div className="field">
          <label htmlFor="fecha">Día</label>
          <input id="fecha" name="fecha" className="input input--sm" type="date" defaultValue={date} max={today} />
        </div>
        <button type="submit" className="btn btn--primary btn--sm">Ver corte</button>
        <Link className="btn btn--ghost btn--sm" href="/panel/corte">Hoy</Link>
        <span className="mini" style={{ marginLeft: 'auto' }}>El día se cuenta por la fecha en que se <b>recibió</b> el paquete.</span>
      </form>

      {!corte ? (
        <p className="alert alert--error" role="alert"><Icon name="alert" size={18} /> <span>No pudimos calcular el corte. Inténtelo de nuevo en un momento.</span></p>
      ) : (
        <>
          <section className="stats" aria-label="Totales del día">
            <div className="stat stat--ok"><strong>{moneyMx(corte.summary.paid_amount)}</strong><span>Cobrado ({corte.summary.paid_count} envíos) — dinero a entregar</span></div>
            <div className="stat stat--warn"><strong>{moneyMx(corte.summary.pending_amount)}</strong><span>Por cobrar ({corte.summary.pending_count} envíos)</span></div>
            <div className="stat"><strong>{corte.summary.active}</strong><span>Envíos con folio</span></div>
            <div className="stat stat--bad"><strong>{corte.summary.cancelled}</strong><span>Cancelados (no suman)</span></div>
          </section>

          {corte.summary.total === 0 ? (
            <div className="card empty"><Icon name="calc" size={44} strokeWidth={1.5} /><strong>No se recibieron paquetes este día</strong></div>
          ) : (
            <>
              <div className="card card--flush">
                <div style={{ padding: '16px 20px 0' }}><h2>Por operador</h2></div>
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th scope="col">Operador</th><th scope="col" className="num">Envíos</th><th scope="col" className="num">Cobrado</th><th scope="col" className="num">Por cobrar</th><th scope="col" className="num">Cancelados</th></tr></thead>
                    <tbody>
                      {corte.byOperator.map((r) => (
                        <tr key={r.operator}><td>{r.operator || '—'}</td><td className="num">{r.active}</td><td className="num">{moneyMx(r.paid_amount)}</td><td className="num">{moneyMx(r.pending_amount)}</td><td className="num">{r.cancelled}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card card--flush">
                <div style={{ padding: '16px 20px 0' }}><h2>Por tamaño</h2></div>
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th scope="col">Tamaño</th><th scope="col" className="num">Envíos</th><th scope="col" className="num">Importe</th></tr></thead>
                    <tbody>
                      {corte.bySize.map((r) => (
                        <tr key={r.size_name}><td>{r.size_name}</td><td className="num">{r.active}</td><td className="num">{moneyMx(r.amount)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <p className="mini no-print">El detalle envío por envío está en el <Link href={`/panel/historial?from=${date}&to=${date}`}>historial</Link>.</p>
            </>
          )}
        </>
      )}
    </>
  );
}
