import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { cancelAction, receiveAction } from '@/app/panel/actions';
import { Icon } from '@/components/Icon';
import { EnvioForm, ReasonForm, type BranchOption, type SizeOption } from '@/components/panel/EnvioForms';
import { requirePageUser } from '@/lib/auth';
import { listBranches, listSizes } from '@/lib/catalog';
import { getEnvio } from '@/lib/envios';
import { formatDateTime, waitingLabel } from '@/lib/format';
import { logger } from '@/lib/logger';
import { appTimezone } from '@/lib/settings';

export const metadata = { title: 'Recibir paquete' };
export const dynamic = 'force-dynamic';

export default async function ReceivePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageUser('envios.operate');
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();

  let data;
  try {
    const [envio, branches, sizes, tz] = await Promise.all([getEnvio(id), listBranches(true), listSizes({ onlyActive: true }), appTimezone()]);
    data = { envio, branches, sizes, tz };
  } catch (err) {
    logger.error('receive.page_failed', err, { id });
    return <p className="alert alert--error" role="alert"><Icon name="alert" size={18} /> <span>No pudimos cargar el envío. Inténtelo de nuevo en un momento.</span></p>;
  }
  const { envio, tz } = data;
  if (!envio) notFound();
  if (envio.status !== 'en_espera') redirect(`/panel/envio/${id}`);

  // El punto del cliente siempre aparece, aunque ya se haya desactivado.
  const branches: BranchOption[] = data.branches.map((b) => ({ id: b.id, name: b.name }));
  if (envio.branch_id && !branches.some((b) => b.id === envio.branch_id)) branches.unshift({ id: envio.branch_id, name: envio.branch });
  const sizes: SizeOption[] = data.sizes.map((s) => ({ id: s.id, name: s.name, price: Number(s.price), description: s.description }));
  const hintMatch = sizes.find((s) => s.name === envio.size_hint);

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Recibir paquete</h1>
          <p>Confirme los datos con el paquete en la mano, elija el tamaño y genere el folio. La etiqueta se abre lista para imprimir.</p>
        </div>
        <div className="page-head__actions">
          <Link className="btn btn--ghost" href="/panel"><Icon name="arrowleft" size={17} /> Volver a en espera</Link>
        </div>
      </header>

      <div className="split">
        <section className="card" aria-labelledby="rec-title">
          <div className="card__head"><h2 id="rec-title">Datos del envío</h2><span className="mini">Puede corregir cualquier dato antes de recibir.</span></div>
          <EnvioForm
            action={receiveAction.bind(null, envio.id)}
            mode="receive"
            sizeHint={envio.size_hint || undefined}
            branches={branches}
            sizes={sizes}
            initial={{
              sender_name: envio.sender_name,
              sender_phone: envio.sender_phone,
              recipient_name: envio.recipient_name,
              branch_id: envio.branch_id ? String(envio.branch_id) : '',
              size_id: '',
              weight_kg: '',
              notes: '',
              paid: false,
            }}
          />
        </section>

        <aside className="card capture-card" aria-label="Captura del cliente">
          <div className="codebig"><small>Código del cliente</small><strong>{envio.short_code}</strong></div>
          <dl>
            <div><dt>Envía</dt><dd>{envio.sender_name}</dd></div>
            <div><dt>Recibe</dt><dd>{envio.recipient_name}</dd></div>
            <div><dt>Punto</dt><dd>{envio.branch}</dd></div>
            <div><dt>Tamaño sugerido</dt><dd>{envio.size_hint || 'No indicó'}{envio.size_hint && !hintMatch ? ' (ya no existe)' : ''}</dd></div>
            {envio.sender_phone && <div><dt>WhatsApp</dt><dd>{envio.sender_phone}</dd></div>}
            <div><dt>Capturado</dt><dd>{formatDateTime(envio.created_at, tz)}<br /><span style={{ color: '#93a9d8', fontWeight: 500 }}>{waitingLabel(envio.created_at)}</span></dd></div>
          </dl>
        </aside>
      </div>

      <details className="fold">
        <summary>Descartar este envío (no llegó o es un registro equivocado)</summary>
        <div>
          <p className="muted">No se genera folio. El envío queda en el historial como descartado, con su motivo y quién lo descartó.</p>
          <ReasonForm action={cancelAction.bind(null, envio.id)} label="Motivo" placeholder="Ej. El cliente ya no lo envió / registro duplicado" button="Descartar envío" confirm="¿Descartar este envío? No se genera folio y no se puede deshacer." />
        </div>
      </details>
    </>
  );
}
