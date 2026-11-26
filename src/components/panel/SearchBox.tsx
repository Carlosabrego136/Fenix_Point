'use client';

import { useEffect, useRef } from 'react';

/** Campo de búsqueda: se enfoca solo en equipos con mouse (en celular no abre el teclado ni mueve la pantalla). */
export function SearchBox({ defaultValue }: { defaultValue: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (window.matchMedia('(pointer: fine)').matches) ref.current?.focus({ preventScroll: true });
  }, []);
  return (
    <input ref={ref} className="input" type="search" name="q" defaultValue={defaultValue} placeholder="Código de 4 dígitos o nombre…" aria-label="Buscar envío en espera" maxLength={80} autoComplete="off" inputMode="search" />
  );
}
