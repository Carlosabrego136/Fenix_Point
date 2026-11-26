'use client';

import { useActionState } from 'react';
import { loginAction } from '@/app/panel/actions';
import { FormAlert, SubmitButton } from '@/components/ui/Bits';
import type { ActionState } from '@/lib/errors';

const INITIAL: ActionState = {};

export function LoginForm() {
  const [state, action] = useActionState(loginAction, INITIAL);
  return (
    <form action={action} className="form-grid" noValidate>
      <FormAlert state={state} />
      <div className="field">
        <label htmlFor="username">Usuario</label>
        <input id="username" name="username" className="input" type="text" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={40} defaultValue={state.values?.username ?? ''} required autoFocus />
      </div>
      <div className="field">
        <label htmlFor="password">Contraseña</label>
        <input id="password" name="password" className="input" type="password" autoComplete="current-password" maxLength={200} required />
      </div>
      <SubmitButton className="btn btn--primary btn--lg btn--block" pendingLabel="Entrando…">Entrar</SubmitButton>
    </form>
  );
}

export function LogoutButton({ action }: { action: () => Promise<void> }) {
  return (
    <form action={action}>
      <button type="submit" className="btn btn--ghost btn--sm" style={{ background: 'rgba(255,255,255,.08)', color: '#e6eeff', borderColor: 'rgba(255,255,255,.18)' }}>
        Cerrar sesión
      </button>
    </form>
  );
}
