'use client';

import { useActionState, useEffect, useRef } from 'react';
import { changePasswordAction, resetOperatorPasswordAction, saveBranchAction, saveSettingsAction, saveSizeAction } from '@/app/panel/actions';
import { FieldError, FormAlert, SubmitButton } from '@/components/ui/Bits';
import { PasswordInput } from '@/components/ui/PasswordInput';
import type { ActionState } from '@/lib/errors';
import type { Branch, Size } from '@/lib/catalog';
import type { Settings } from '@/lib/settings';

const INITIAL: ActionState = {};

function useResetOnOk(state: ActionState, enabled: boolean) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (enabled && state.ok) ref.current?.reset();
  }, [state, enabled]);
  return ref;
}

export function BranchForm({ branch }: { branch: Branch | null }) {
  const [state, action] = useActionState(saveBranchAction.bind(null, branch?.id ?? null), INITIAL);
  const ref = useResetOnOk(state, branch === null);
  const v = (k: string, d: string) => state.values?.[k] ?? d;
  return (
    <form ref={ref} action={action} className="form-grid" noValidate style={{ gap: 10 }}>
      <FormAlert state={state} />
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(180px,1fr) 90px auto auto', alignItems: 'end' }} className="inline-form">
        <div className="field">
          <label htmlFor={`bn-${branch?.id ?? 'new'}`}>{branch ? 'Nombre del punto' : 'Nuevo punto'}</label>
          <input id={`bn-${branch?.id ?? 'new'}`} name="name" className="input input--sm" type="text" maxLength={80} placeholder="Ej. Cucapá" defaultValue={v('name', branch?.name ?? '')} aria-invalid={Boolean(state.fieldErrors?.name)} required />
        </div>
        <div className="field">
          <label htmlFor={`bo-${branch?.id ?? 'new'}`}>Orden</label>
          <input id={`bo-${branch?.id ?? 'new'}`} name="sort_order" className="input input--sm" type="text" inputMode="numeric" maxLength={4} defaultValue={v('sort_order', String(branch?.sort_order ?? 0))} />
        </div>
        <label className="choice" style={{ paddingBottom: 6, display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
          <input type="checkbox" name="is_active" defaultChecked={branch ? branch.is_active : true} /> <span style={{ fontWeight: 600, fontSize: 14 }}>Activo</span>
        </label>
        <SubmitButton className="btn btn--soft btn--sm" pendingLabel="…">{branch ? 'Guardar' : 'Agregar'}</SubmitButton>
      </div>
      <FieldError state={state} name="name" />
    </form>
  );
}

export function SizeForm({ size }: { size: Size | null }) {
  const [state, action] = useActionState(saveSizeAction.bind(null, size?.id ?? null), INITIAL);
  const ref = useResetOnOk(state, size === null);
  const v = (k: string, d: string) => state.values?.[k] ?? d;
  const k = size?.id ?? 'new';
  return (
    <form ref={ref} action={action} className="form-grid" noValidate style={{ gap: 10 }}>
      <FormAlert state={state} />
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(150px,1.1fr) minmax(150px,1.3fr) 110px 80px', alignItems: 'end' }} className="inline-form">
        <div className="field">
          <label htmlFor={`sn-${k}`}>{size ? 'Nombre' : 'Nuevo tamaño'}</label>
          <input id={`sn-${k}`} name="name" className="input input--sm" type="text" maxLength={60} placeholder="Ej. Tamaño D" defaultValue={v('name', size?.name ?? '')} aria-invalid={Boolean(state.fieldErrors?.name)} required />
        </div>
        <div className="field">
          <label htmlFor={`sd-${k}`}>Descripción <span className="field__hint">(opc.)</span></label>
          <input id={`sd-${k}`} name="description" className="input input--sm" type="text" maxLength={120} placeholder="Ej. Caja chica" defaultValue={v('description', size?.description ?? '')} />
        </div>
        <div className="field">
          <label htmlFor={`sp-${k}`}>Precio (MXN)</label>
          <input id={`sp-${k}`} name="price" className="input input--sm" type="text" inputMode="decimal" maxLength={10} defaultValue={v('price', size ? String(Number(size.price)) : '')} aria-invalid={Boolean(state.fieldErrors?.price)} required />
        </div>
        <div className="field">
          <label htmlFor={`so-${k}`}>Orden</label>
          <input id={`so-${k}`} name="sort_order" className="input input--sm" type="text" inputMode="numeric" maxLength={4} defaultValue={v('sort_order', String(size?.sort_order ?? 0))} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
          <input type="checkbox" name="is_active" defaultChecked={size ? size.is_active : true} /> Activo
        </label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
          <input type="checkbox" name="show_public" defaultChecked={size ? size.show_public : true} /> Visible para el cliente en el formulario
        </label>
        <SubmitButton className="btn btn--soft btn--sm" pendingLabel="…">{size ? 'Guardar' : 'Agregar'}</SubmitButton>
      </div>
      <FieldError state={state} name="name" />
      <FieldError state={state} name="price" />
    </form>
  );
}

export function SettingsForm({ settings }: { settings: Settings }) {
  const [state, action] = useActionState(saveSettingsAction, INITIAL);
  const v = (k: keyof Settings) => state.values?.[k] ?? settings[k];
  return (
    <form action={action} className="form-grid" noValidate>
      <FormAlert state={state} />
      <div className="form-grid form-grid--2">
        <div className="field">
          <label htmlFor="label_branch_title">Encabezado del punto en la etiqueta</label>
          <input id="label_branch_title" name="label_branch_title" className="input" type="text" maxLength={30} defaultValue={v('label_branch_title')} aria-invalid={Boolean(state.fieldErrors?.label_branch_title)} />
          <span className="field__hint">Ej. «Entrega en». Aparece sobre el nombre del punto.</span>
          <FieldError state={state} name="label_branch_title" />
        </div>
        <div className="field">
          <label htmlFor="label_note">Nota al pie de la etiqueta <span className="field__hint">(opcional)</span></label>
          <input id="label_note" name="label_note" className="input" type="text" maxLength={80} defaultValue={v('label_note')} />
          <span className="field__hint">Ej. teléfono o «Frágil».</span>
        </div>
      </div>
      <div className="field">
        <label htmlFor="wa_message">Mensaje del comprobante por WhatsApp</label>
        <textarea id="wa_message" name="wa_message" className="textarea" rows={6} maxLength={500} defaultValue={v('wa_message')} aria-invalid={Boolean(state.fieldErrors?.wa_message)} />
        <span className="field__hint">Puede usar: {'{folio} {remitente} {destinatario} {tamano} {precio} {sucursal} {estado_pago}'}</span>
        <FieldError state={state} name="wa_message" />
      </div>
      <div className="field" style={{ maxWidth: 320 }}>
        <label htmlFor="timezone">Zona horaria</label>
        <input id="timezone" name="timezone" className="input" type="text" maxLength={60} defaultValue={v('timezone')} aria-invalid={Boolean(state.fieldErrors?.timezone)} />
        <span className="field__hint">Define el «día» del corte. Ej. America/Tijuana</span>
        <FieldError state={state} name="timezone" />
      </div>
      <div><SubmitButton pendingLabel="Guardando…">Guardar ajustes</SubmitButton></div>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, action] = useActionState(changePasswordAction, INITIAL);
  const ref = useResetOnOk(state, true);
  return (
    <form ref={ref} action={action} className="form-grid" noValidate style={{ maxWidth: 420 }}>
      <FormAlert state={state} />
      <div className="field">
        <label htmlFor="current">Contraseña actual</label>
        <PasswordInput id="current" name="current" autoComplete="current-password" maxLength={200} aria-invalid={Boolean(state.fieldErrors?.current)} required />
        <FieldError state={state} name="current" />
      </div>
      <div className="field">
        <label htmlFor="next">Contraseña nueva</label>
        <PasswordInput id="next" name="next" autoComplete="new-password" maxLength={128} aria-invalid={Boolean(state.fieldErrors?.next)} required />
        <span className="field__hint">Mínimo 8 caracteres, con letras y números.</span>
        <FieldError state={state} name="next" />
      </div>
      <div className="field">
        <label htmlFor="confirm">Repita la contraseña nueva</label>
        <PasswordInput id="confirm" name="confirm" autoComplete="new-password" maxLength={128} aria-invalid={Boolean(state.fieldErrors?.confirm)} required />
        <FieldError state={state} name="confirm" />
      </div>
      <div><SubmitButton pendingLabel="Guardando…">Cambiar mi contraseña</SubmitButton></div>
    </form>
  );
}

export function ResetOperatorForm({ operatorId, username }: { operatorId: number; username: string }) {
  const [state, action] = useActionState(resetOperatorPasswordAction.bind(null, operatorId), INITIAL);
  const ref = useResetOnOk(state, true);
  return (
    <form ref={ref} action={action} className="form-grid" noValidate style={{ maxWidth: 420 }}>
      <FormAlert state={state} />
      <div className="field">
        <label htmlFor={`rn-${operatorId}`}>Nueva contraseña para «{username}»</label>
        <PasswordInput id={`rn-${operatorId}`} name="next" autoComplete="new-password" maxLength={128} aria-invalid={Boolean(state.fieldErrors?.next)} required />
        <span className="field__hint">Mínimo 8 caracteres, con letras y números.</span>
        <FieldError state={state} name="next" />
      </div>
      <div className="field">
        <label htmlFor={`rc-${operatorId}`}>Repita la contraseña</label>
        <PasswordInput id={`rc-${operatorId}`} name="confirm" autoComplete="new-password" maxLength={128} aria-invalid={Boolean(state.fieldErrors?.confirm)} required />
        <FieldError state={state} name="confirm" />
      </div>
      <div><SubmitButton className="btn btn--soft" pendingLabel="Guardando…" confirm={`¿Cambiar la contraseña de «${username}»? Se cerrará su sesión abierta.`}>Restablecer contraseña</SubmitButton></div>
    </form>
  );
}
