'use client';

import { useState, type InputHTMLAttributes } from 'react';
import { Icon } from '@/components/Icon';

/** Campo de contraseña con botón de ojo para mostrarla u ocultarla. */
export function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [visible, setVisible] = useState(false);
  const { className, ...rest } = props;
  return (
    <div className="pwd">
      <input {...rest} className={`input pwd__input${className ? ` ${className}` : ''}`} type={visible ? 'text' : 'password'} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
      <button
        type="button"
        className="pwd__toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        aria-pressed={visible}
        title={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      >
        <Icon name={visible ? 'eyeoff' : 'eye'} size={20} />
      </button>
    </div>
  );
}
