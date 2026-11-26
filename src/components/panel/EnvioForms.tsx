'use client';

import { useActionState, useMemo, useState } from 'react';
import { Icon } from '@/components/Icon';
import { FieldError, FormAlert, SubmitButton } from '@/components/ui/Bits';
import type { ActionState } from '@/lib/errors';
import { moneyMx } from '@/lib/format';

export interface BranchOption { id: number; name: string }
export interface SizeOption { id: number; name: string; price: number; description?: string }
export interface EnvioValues {
  sender_name: string;
  sender_phone: string;
  recipient_name: string;
  branch_id: string;
  size_id: string;
  weight_kg: string;
  notes: string;
  paid: boolean;
}

const INITIAL: ActionState = {};

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

/** Formulario para RECIBIR (genera el folio) o para CORREGIR un envío ya recibido. */
export function EnvioForm({ action, mode, initial, branches, sizes, sizeHint }: {
  action: Action;
  mode: 'receive' | 'edit';
  initial: EnvioValues;
  branches: BranchOption[];
  sizes: SizeOption[];
  sizeHint?: string;
}) {
  const [state, formAction] = useActionState(action, INITIAL);
  const v = (k: keyof EnvioValues) => state.values?.[k] ?? (typeof initial[k] === 'boolean' ? (initial[k] ? '1' : '0') : (initial[k] as string));
  const [sizeId, setSizeId] = useState(initial.size_id);
  const chosen = useMemo(() => sizes.find((s) => String(s.id) === sizeId), [sizes, sizeId]);
  const paid = v('paid') === '1';
  const receiving = mode === 'receive';

  return (
    <form action={formAction} className="form-grid" noValidate>
      <FormAlert state={state} />

      <div className="form-grid form-grid--2">
        <div className="field">
          <label htmlFor="sender_name">Quién envía <span className="req">*</span></label>
          <input id="sender_name" name="sender_name" className="input" type="text" maxLength={100} autoComplete="off" defaultValue={v('sender_name')} aria-invalid={Boolean(state.fieldErrors?.sender_name)} required />
          <FieldError state={state} name="sender_name" />
        </div>
        <div className="field">
          <label htmlFor="recipient_name">Quién recibe <span className="req">*</span></label>
          <input id="recipient_name" name="recipient_name" className="input" type="text" maxLength={100} autoComplete="off" defaultValue={v('recipient_name')} aria-invalid={Boolean(state.fieldErrors?.recipient_name)} required />
          <FieldError state={state} name="recipient_name" />
        </div>
      </div>
      <div className="field" style={{ maxWidth: 360 }}>
        <label htmlFor="sender_phone">WhatsApp de quien envía <span className="field__hint">(opcional)</span></label>
        <input id="sender_phone" name="sender_phone" className="input" type="tel" inputMode="tel" maxLength={20} autoComplete="off" placeholder="10 dígitos" defaultValue={v('sender_phone')} aria-invalid={Boolean(state.fieldErrors?.sender_phone)} />
        <FieldError state={state} name="sender_phone" />
      </div>

      <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="field__label" style={{ marginBottom: 6 }}>Punto de entrega <span className="req">*</span></legend>
        <div className="choices">
          {branches.map((b) => (
            <label className="choice" key={b.id}>
              <input type="radio" name="branch_id" value={b.id} defaultChecked={v('branch_id') === String(b.id)} required />
              <span className="choice__box"><strong>{b.name}</strong></span>
            </label>
          ))}
        </div>
        <FieldError state={state} name="branch_id" />
      </fieldset>

      <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="field__label" style={{ marginBottom: 6 }}>
          Tamaño del paquete <span className="req">*</span>
          {sizeHint && receiving && <span className="tag tag--wait" style={{ marginLeft: 10 }}>El cliente sugirió: {sizeHint}</span>}
        </legend>
        <div className="choices">
          {sizes.map((s) => (
            <label className="choice" key={s.id}>
              <input type="radio" name="size_id" value={s.id} checked={String(s.id) === sizeId} onChange={() => setSizeId(String(s.id))} required />
              <span className="choice__box">
                <strong>{s.name}</strong>
                <span>{moneyMx(s.price)}{s.description ? ` · ${s.description}` : ''}</span>
              </span>
            </label>
          ))}
        </div>
        <FieldError state={state} name="size_id" />
      </fieldset>

      <div className="form-grid form-grid--2">
        <div className="field">
          <label htmlFor="weight_kg">Peso en kg <span className="field__hint">(opcional)</span></label>
          <input id="weight_kg" name="weight_kg" className="input" type="text" inputMode="decimal" maxLength={8} autoComplete="off" placeholder="Ej. 1.5" defaultValue={v('weight_kg')} aria-invalid={Boolean(state.fieldErrors?.weight_kg)} />
          <FieldError state={state} name="weight_kg" />
        </div>
        <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="field__label" style={{ marginBottom: 6 }}>Cobro</legend>
          <div className="choices choice--pay" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <label className="choice choice--pay">
              <input type="radio" name="paid" value="1" defaultChecked={paid} />
              <span className="choice__box is-ok"><strong>Cobrado</strong></span>
            </label>
            <label className="choice choice--pay">
              <input type="radio" name="paid" value="0" defaultChecked={!paid} />
              <span className="choice__box is-warn"><strong>Por cobrar</strong></span>
            </label>
          </div>
        </fieldset>
      </div>

      <div className="field">
        <label htmlFor="notes">Notas <span className="field__hint">(opcional)</span></label>
        <textarea id="notes" name="notes" className="textarea" maxLength={300} defaultValue={v('notes')} placeholder="Ej. frágil, contenido, indicaciones…" />
      </div>

      <div className="actionbar">
        <div className="total">
          <small>Total del envío</small>
          <strong>{chosen ? moneyMx(chosen.price) : '—'}</strong>
        </div>
        <SubmitButton className={`btn btn--lg ${receiving ? 'btn--ember' : 'btn--primary'}`} pendingLabel={receiving ? 'Generando folio…' : 'Guardando…'}>
          {receiving ? <><Icon name="printer" size={19} /> Recibir y generar folio</> : <><Icon name="check" size={19} /> Guardar cambios</>}
        </SubmitButton>
      </div>
    </form>
  );
}

/** Motivo obligatorio para descartar (en espera) o cancelar (con folio). */
export function ReasonForm({ action, label, placeholder, button, confirm }: { action: Action; label: string; placeholder: string; button: string; confirm: string }) {
  const [state, formAction] = useActionState(action, INITIAL);
  return (
    <form action={formAction} className="form-grid" noValidate>
      <FormAlert state={state} />
      <div className="field">
        <label htmlFor="reason">{label} <span className="req">*</span></label>
        <input id="reason" name="reason" className="input" type="text" maxLength={200} autoComplete="off" placeholder={placeholder} defaultValue={state.values?.reason ?? ''} aria-invalid={Boolean(state.fieldErrors?.reason)} required />
        <FieldError state={state} name="reason" />
      </div>
      <div><SubmitButton className="btn btn--danger" pendingLabel="Guardando…" confirm={confirm}>{button}</SubmitButton></div>
    </form>
  );
}
