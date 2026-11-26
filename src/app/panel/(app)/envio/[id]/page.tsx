import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { cancelAction, finalizeAction, togglePaidAction, updateEnvioAction } from '@/app/panel/actions';
import { Icon } from '@/components/Icon';
import { EnvioForm, ReasonForm, type BranchOption, type SizeOption } from '@/components/panel/EnvioForms';
import { Flash, PayTag, StatusTag } from '@/components/panel/Shared';
import { SubmitButton } from '@/components/ui/Bits';
import { canViewEnvio } from '@/lib/access';
import { requirePageUser } from '@/lib/auth';
import { listBranches, listSizes } from '@/lib/catalog';
import { getEnvio, whatsappLink } from '@/lib/envios';
import { formatDateTime, moneyMx, padFolio } from '@/lib/format';
import { logger } from '@/lib/logger';
import { can } from '@/lib/permissions';
import { appTimezone, loadSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  return { title: `Envío ${(await params).id}` };
}

export default async function EnvioPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string; aviso?: string }> }) {
  const user = await requirePageUser('envios.operate');
  const id = Number((await params).id);
  const sp = await searchParams;
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const admin = can(user.role, 'envios.manage');

  let data;
  try {
    const [envio, tz, settings] = await Promise.all([getEnvio(id), appTimezone(), loadSettings()]);
    data = { envio, tz, settings };
  } catch (err) {
    logger.error('envio.page_failed', err, { id });
    return <p className="alert alert--error" role="alert"><Icon name="alert" size={18} /> <span>No pudimos cargar el envío. Inténtelo de nuevo en un momento.</span></p>;
  }
  const { envio, tz, settings } = data;
  if (!envio) notFound();
  if (envio.status === 'en_espera') redirect(`/panel/recibir/${id}`);
  if (!canViewEnvio(user.role, envio, tz)) redirect('/panel?aviso=sin-permiso');

  const cancelled = envio.status === 'cancelado';
  const received = envio.status === 'recibido';
  const hasFolio = envio.folio_number !== null;
  const wa = !cancelled ? whatsappLink(envio, settings.wa_message) : null;

  let branches: BranchOption[] = [];
  let sizes: SizeOption[] = [];
  if (admin && received) {
    const [b, s] = await Promise.all([listBranches(true), listSizes({ onlyActive: true })]);
    branches = b.map((x) => ({ id: x.id, name: x.name }));
    if (envio.branch_id && !branches.some((x) => x.id === envio.branch_id)) branches.unshift({ id: envio.branch_id, name: envio.branch });
    sizes = s.map((x) => ({ id: x.id, name: x.name, price: Number(x.price), description: x.description }));
    // El tamaño actual siempre aparece aunque se haya desactivado.
    if (envio.size_id && !sizes.some((x) => x.id === envio.size_id)) sizes.unshift({ id: envio.size_id, name: envio.size_name, price: Number(envio.price ?? 0) });
  }

  return (
    <>
      <header className="page-head">
        <div>
          <h1>
            {hasFolio ? <>Folio <span className="folio-num">{padFolio(envio.folio_number as number)}</span></> : <>Envío descartado · código {envio.short_code}</>}{' '}
            <StatusTag status={envio.status} />
          </h1>
          <p>
            Capturado {formatDateTime(envio.created_at, tz)}
            {envio.received_at ? ` · recibido ${formatDateTime(envio.received_at, tz)} por ${envio.received_by_name || '—'}` : ''}
          </p>
        </div>
        <div className="page-head__actions">
          <Link className="btn btn--ghost" href={received || cancelled ? '/panel/recibidos' : '/panel/finalizados'}><Icon name="arrowleft" size={17} /> Volver</Link>
        </div>
      </header>

      <Flash ok={sp.ok} error={sp.error} aviso={sp.aviso} />

      <section className="card" aria-label="Datos del envío">
        <dl className="dl">
          <div><dt>Quién envía</dt><dd>{envio.sender_name}{envio.sender_phone ? ` · ${envio.sender_phone}` : ''}</dd></div>
          <div><dt>Quién recibe</dt><dd>{envio.recipient_name}</dd></div>
          <div><dt>Punto de entrega</dt><dd>{envio.branch}</dd></div>
          {hasFolio && <div><dt>Tamaño</dt><dd>{envio.size_name}{envio.weight_kg ? ` · ${Number(envio.weight_kg)} kg` : ''}</dd></div>}
          {!hasFolio && envio.size_hint && <div><dt>Tamaño sugerido</dt><dd>{envio.size_hint}</dd></div>}
          {hasFolio && (
            <div><dt>Total</dt><dd>{moneyMx(envio.price)} · <PayTag e={envio} />{envio.paid && envio.paid_at ? ` ${formatDateTime(envio.paid_at, tz)}` : ''}</dd></div>
          )}
          {envio.notes && <div><dt>Notas</dt><dd>{envio.notes}</dd></div>}
          {envio.finalized_at && <div><dt>Finalizado</dt><dd>{formatDateTime(envio.finalized_at, tz)} · {envio.finalized_by_name}</dd></div>}
          {cancelled && <div><dt>{hasFolio ? 'Cancelación' : 'Descarte'}</dt><dd>{envio.cancel_reason} · {envio.cancelled_by} · {formatDateTime(envio.cancelled_at, tz)}</dd></div>}
        </dl>

        {hasFolio && !cancelled && (
          <div className="row-actions" style={{ marginTop: 18 }}>
            <a className="btn btn--primary" href={`/panel/etiqueta/${envio.id}?auto=1`} target="_blank" rel="noopener"><Icon name="printer" size={18} /> Imprimir etiqueta</a>
            {wa ? (
              <a className="btn btn--ghost" href={wa} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp" size={18} /> Enviar comprobante por WhatsApp</a>
            ) : (
              <span className="mini">Sin WhatsApp del remitente: no hay comprobante para enviar.</span>
            )}
            {received && (
              <form action={togglePaidAction.bind(null, envio.id, !envio.paid)}>
                <SubmitButton className="btn btn--ghost" pendingLabel="Guardando…">{envio.paid ? 'Marcar como por cobrar' : 'Marcar como cobrado'}</SubmitButton>
              </form>
            )}
            {admin && received && (
              <form action={finalizeAction.bind(null, envio.id)}>
                <SubmitButton className="btn btn--ok" pendingLabel="Finalizando…" confirm={envio.paid ? '¿Marcar este envío como finalizado (entregado)?' : 'Este envío aún está POR COBRAR. ¿Marcarlo como finalizado de todos modos?'}>
                  <Icon name="checkcircle" size={18} /> Finalizar envío
                </SubmitButton>
              </form>
            )}
          </div>
        )}
      </section>

      {admin && received && (
        <>
          <details className="fold">
            <summary>Corregir datos del envío</summary>
            <div>
              <p className="muted">El folio y las fechas no cambian. Si cambia el tamaño, el precio se toma del precio vigente; si no, se conserva el original.</p>
              <EnvioForm
                action={updateEnvioAction.bind(null, envio.id)}
                mode="edit"
                branches={branches}
                sizes={sizes}
                initial={{
                  sender_name: envio.sender_name,
                  sender_phone: envio.sender_phone,
                  recipient_name: envio.recipient_name,
                  branch_id: envio.branch_id ? String(envio.branch_id) : '',
                  size_id: envio.size_id ? String(envio.size_id) : '',
                  weight_kg: envio.weight_kg ? String(Number(envio.weight_kg)) : '',
                  notes: envio.notes,
                  paid: envio.paid,
                }}
              />
            </div>
          </details>
          <details className="fold">
            <summary>Cancelar folio</summary>
            <div>
              <p className="muted">El folio no se borra: queda como cancelado, con su motivo, y deja de sumar en el corte.</p>
              <ReasonForm action={cancelAction.bind(null, envio.id)} label="Motivo de la cancelación" placeholder="Ej. Se capturó mal el tamaño" button="Cancelar folio" confirm="¿Cancelar este folio? No se puede deshacer." />
            </div>
          </details>
        </>
      )}
    </>
  );
}
