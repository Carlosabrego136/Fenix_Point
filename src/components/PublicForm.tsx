'use client';

import { useActionState, useEffect, useState } from 'react';
import { captureAction, type CaptureState } from '@/app/actions';
import { Icon } from '@/components/Icon';
import { FieldError, FormAlert, SubmitButton } from '@/components/ui/Bits';

export interface PubBranch { id: number; name: string }
export interface PubSize { id: number; name: string; description: string }

const INITIAL: CaptureState = {};

export function PublicForm({ requestId, branches, sizes }: { requestId: string; branches: PubBranch[]; sizes: PubSize[] }) {
  const [state, action] = useActionState(captureAction, INITIAL);
  const [startedAt, setStartedAt] = useState('0');
  const v = state.values ?? {};

  useEffect(() => setStartedAt(String(Date.now())), []);

  if (state.ok && state.code) {
    return (
      <div className="pub-success" role="status" aria-live="polite">
        <div className="pub-success__icon"><Icon name="check" size={34} strokeWidth={2.6} /></div>
        <div>
          <h2>¡Listo! Su envío quedó registrado</h2>
          <p style={{ color: 'var(--muted)', marginTop: 4 }}>Está <b>en espera</b>. Lleve su paquete al mostrador y muestre este código.</p>
        </div>
        <div className="pub-code">
          <small>Su código</small>
          <strong aria-label={`Código ${state.code.split('').join(' ')}`}>{state.code}</strong>
        </div>
        {(state.sender || state.branch) && (
          <dl className="pub-summary">
            {state.sender && <div><dt>Envía</dt><dd>{state.sender}</dd></div>}
            {state.recipient && <div><dt>Recibe</dt><dd>{state.recipient}</dd></div>}
            {state.branch && <div><dt>Punto de recolección</dt><dd>{state.branch}</dd></div>}
          </dl>
        )}
        <p className="field__hint" style={{ maxWidth: 360 }}>
          Su folio y etiqueta se generan cuando recibimos el paquete. Si pierde este código, el mostrador puede buscarlo por su nombre.
        </p>
        <button type="button" className="btn btn--ghost btn--block" onClick={() => window.location.reload()}>
          Registrar otro envío
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="form-grid" noValidate>
      <input type="hidden" name="request_id" value={requestId} />
      <input type="hidden" name="_t" value={startedAt} />
      <div className="hp" aria-hidden="true">
        <label htmlFor="website">No llenar este campo</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <FormAlert state={state} />

      <div className="section-title">Quién envía</div>
      <div className="field">
        <label htmlFor="sender_name">Su nombre <span className="req">*</span></label>
        <input id="sender_name" name="sender_name" className="input" type="text" autoComplete="name" maxLength={100} placeholder="Nombre y apellido" defaultValue={v.sender_name ?? ''} aria-invalid={Boolean(state.fieldErrors?.sender_name)} aria-describedby="sender_name-err" required />
        <FieldError state={state} name="sender_name" />
      </div>
      <div className="field">
        <label htmlFor="sender_phone">WhatsApp o teléfono <span className="field__hint">(opcional)</span></label>
        <input id="sender_phone" name="sender_phone" className="input" type="tel" inputMode="tel" autoComplete="tel" maxLength={20} placeholder="10 dígitos" defaultValue={v.sender_phone ?? ''} aria-invalid={Boolean(state.fieldErrors?.sender_phone)} aria-describedby="sender_phone-err" />
        <span className="field__hint">Para enviarle su comprobante por WhatsApp.</span>
        <FieldError state={state} name="sender_phone" />
      </div>

      <div className="section-title">Quién recibe</div>
      <div className="field">
        <label htmlFor="recipient_name">Nombre de quien recibe <span className="req">*</span></label>
        <input id="recipient_name" name="recipient_name" className="input" type="text" autoComplete="off" maxLength={100} placeholder="Nombre y apellido" defaultValue={v.recipient_name ?? ''} aria-invalid={Boolean(state.fieldErrors?.recipient_name)} aria-describedby="recipient_name-err" required />
        <FieldError state={state} name="recipient_name" />
      </div>

      <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="field__label" style={{ marginBottom: 6 }}>Punto de recolección <span className="req">*</span></legend>
        <div className="choices">
          {branches.map((b) => (
            <label className="choice" key={b.id}>
              <input type="radio" name="branch_id" value={b.id} defaultChecked={v.branch_id === String(b.id)} required />
              <span className="choice__box"><strong>{b.name}</strong><span><Icon name="pin" size={13} style={{ verticalAlign: '-2px' }} /> Aquí se entrega</span></span>
            </label>
          ))}
        </div>
        <FieldError state={state} name="branch_id" />
      </fieldset>

      {sizes.length > 0 && (
        <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="field__label" style={{ marginBottom: 6 }}>Tamaño del paquete <span className="field__hint">(opcional)</span></legend>
          <div className="choices">
            <label className="choice">
              <input type="radio" name="size_id" value="" defaultChecked={!v.size_id} />
              <span className="choice__box"><strong>No estoy seguro</strong><span>El mostrador lo define</span></span>
            </label>
            {sizes.map((s) => (
              <label className="choice" key={s.id}>
                <input type="radio" name="size_id" value={s.id} defaultChecked={v.size_id === String(s.id)} />
                <span className="choice__box"><strong>{s.name}</strong>{s.description && <span>{s.description}</span>}</span>
              </label>
            ))}
          </div>
          <span className="field__hint">Solo es una sugerencia: el tamaño final lo confirma el mostrador al ver su paquete.</span>
        </fieldset>
      )}

      <SubmitButton className="btn btn--primary btn--lg btn--block" pendingLabel="Enviando…">
        Registrar mi envío <Icon name="arrow" size={18} />
      </SubmitButton>
    </form>
  );
}
