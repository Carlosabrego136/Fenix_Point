'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/Icon';
import type { ActionState } from '@/lib/errors';

/** Botón de envío: se deshabilita y muestra "…" mientras el servidor trabaja (evita dobles toques). */
export function SubmitButton({ children, pendingLabel = 'Procesando…', className = 'btn btn--primary', confirm }: { children: ReactNode; pendingLabel?: string; className?: string; confirm?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      aria-busy={pending}
      onClick={(e) => {
        if (confirm && !pending && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

export function FormAlert({ state }: { state: ActionState }) {
  if (state.error) {
    return (
      <p className="alert alert--error" role="alert">
        <Icon name="alert" size={18} /> <span>{state.error}</span>
      </p>
    );
  }
  if (state.ok && state.message) {
    return (
      <p className="alert alert--ok" role="status">
        <Icon name="checkcircle" size={18} /> <span>{state.message}</span>
      </p>
    );
  }
  return null;
}

export function FieldError({ state, name }: { state: ActionState; name: string }) {
  const msg = state.fieldErrors?.[name];
  return msg ? (
    <p className="field__err" id={`${name}-err`} role="alert">
      {msg}
    </p>
  ) : null;
}

/** Imprime al abrir la página (si auto) y ofrece el botón de imprimir. */
export function PrintNow({ auto, label = 'Imprimir etiqueta' }: { auto: boolean; label?: string }) {
  useEffect(() => {
    if (!auto) return;
    const t = setTimeout(() => window.print(), 450);
    return () => clearTimeout(t);
  }, [auto]);
  return (
    <button type="button" className="btn btn--primary" onClick={() => window.print()}>
      <Icon name="printer" size={18} /> {label}
    </button>
  );
}

/** Actualiza la lista sola cada cierto tiempo (solo con la pestaña visible), para ver las capturas nuevas sin recargar. */
export function AutoRefresh({ seconds = 20 }: { seconds?: number }) {
  const router = useRouter();
  const ref = useRef(router);
  ref.current = router;
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') ref.current.refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [seconds]);
  return null;
}
