import Link from 'next/link';
import { Icon } from '@/components/Icon';
import type { Envio, EnvioStatus, TabCounts } from '@/lib/envios';
import { STATUS_LABEL } from '@/lib/envios';
import { formatTime, moneyMx, padFolio } from '@/lib/format';
import { can, type Role } from '@/lib/permissions';

const TAG_CLASS: Record<EnvioStatus, string> = {
  en_espera: 'tag tag--wait',
  recibido: 'tag tag--recv',
  finalizado: 'tag tag--done',
  cancelado: 'tag tag--bad',
};

export function StatusTag({ status }: { status: EnvioStatus }) {
  return <span className={TAG_CLASS[status]}>{STATUS_LABEL[status]}</span>;
}

export function PayTag({ e }: { e: Envio }) {
  if (e.status === 'cancelado') return <span className="tag tag--neutral">Sin cobro</span>;
  return e.paid ? <span className="tag tag--done">Cobrado</span> : <span className="tag tag--wait">Por cobrar</span>;
}

export function EnvioTabs({ active, counts, role }: { active: 'espera' | 'recibidos' | 'finalizados'; counts: TabCounts | null; role: Role }) {
  const admin = can(role, 'envios.manage');
  return (
    <div className="tabs" role="tablist" aria-label="Estados">
      <Link href="/panel" aria-current={active === 'espera' ? 'page' : undefined}>
        En espera {counts ? <span className="count">{counts.en_espera}</span> : null}
      </Link>
      <Link href="/panel/recibidos" aria-current={active === 'recibidos' ? 'page' : undefined}>
        {admin ? 'Recibidos' : 'Recibidos hoy'} {counts ? <span className="count">{admin ? counts.recibido : counts.recibido_hoy}</span> : null}
      </Link>
      {admin && (
        <Link href="/panel/finalizados" aria-current={active === 'finalizados' ? 'page' : undefined}>
          Finalizados {counts ? <span className="count">{counts.finalizado}</span> : null}
        </Link>
      )}
    </div>
  );
}

export function Flash({ ok, error, aviso }: { ok?: string; error?: string; aviso?: string }) {
  const OK: Record<string, string> = {
    descartado: 'El envío se descartó y quedó registrado.',
    cancelado: 'El folio quedó cancelado y registrado en la bitácora.',
    cobrado: 'Listo: el envío quedó marcado como cobrado.',
    'por-cobrar': 'Listo: el envío quedó como por cobrar.',
    finalizado: 'El envío quedó finalizado.',
  };
  const AVISO: Record<string, string> = {
    'sin-permiso': 'No tiene permiso para entrar a esa sección.',
    'ya-recibido': 'Este envío ya había sido recibido: no se generó otro folio.',
  };
  if (error) {
    return (
      <p className="alert alert--error flash" role="alert">
        <Icon name="alert" size={18} /> <span>No se pudo completar la acción. Revise el estado del envío e inténtelo de nuevo.</span>
      </p>
    );
  }
  if (aviso && AVISO[aviso]) {
    return (
      <p className={`alert flash ${aviso === 'sin-permiso' ? 'alert--warn' : 'alert--info'}`} role="status">
        <Icon name="alert" size={18} /> <span>{AVISO[aviso]}</span>
      </p>
    );
  }
  if (ok && OK[ok]) {
    return (
      <p className="alert alert--ok flash" role="status">
        <Icon name="checkcircle" size={18} /> <span>{OK[ok]}</span>
      </p>
    );
  }
  return null;
}

/** Tabla de envíos con folio (recibidos / finalizados / historial). */
export function EnvioTable({ rows, tz, showStatus = false, showTime = true }: { rows: Envio[]; tz: string; showStatus?: boolean; showTime?: boolean }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th scope="col">Folio</th>
            {showStatus && <th scope="col">Estado</th>}
            <th scope="col">Envía → Recibe</th>
            <th scope="col">Punto</th>
            <th scope="col">Tamaño</th>
            <th scope="col" className="num">Total</th>
            <th scope="col">Cobro</th>
            {showTime && <th scope="col">Recibido</th>}
            <th scope="col"><span className="sr-only">Acciones</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id} className={e.status === 'cancelado' ? 'is-cancelled' : undefined}>
              <td><span className="folio-num">{e.folio_number ? padFolio(e.folio_number) : `· ${e.short_code}`}</span></td>
              {showStatus && <td className="keep"><StatusTag status={e.status} /></td>}
              <td>
                <strong>{e.sender_name}</strong> <span className="muted">→</span> {e.recipient_name}
              </td>
              <td>{e.branch}</td>
              <td>{e.size_name || (e.size_hint ? `${e.size_hint} (sug.)` : '—')}</td>
              <td className="num">{e.price !== null ? moneyMx(e.price) : '—'}</td>
              <td className="keep">{e.received_at ? <PayTag e={e} /> : <span className="muted">—</span>}</td>
              {showTime && <td className="muted">{e.received_at ? formatTime(e.received_at, tz) : '—'}</td>}
              <td className="keep" style={{ textAlign: 'right' }}>
                <Link className="btn btn--ghost btn--sm" href={e.status === 'en_espera' ? `/panel/recibir/${e.id}` : `/panel/envio/${e.id}`}>
                  {e.status === 'en_espera' ? 'Recibir' : 'Abrir'}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Empty({ icon, title, text }: { icon: 'inbox' | 'search' | 'box' | 'checkcircle'; title: string; text?: string }) {
  return (
    <div className="card empty">
      <Icon name={icon} size={44} strokeWidth={1.5} />
      <strong>{title}</strong>
      {text && <p>{text}</p>}
    </div>
  );
}
