'use server';

import { randomInt } from 'node:crypto';
import { unstable_rethrow } from 'next/navigation';
import { echoValues, toActionState, type ActionState } from '@/lib/errors';
import { captureEnvio } from '@/lib/envios';
import { getRequestContext } from '@/lib/security';

export interface CaptureState extends ActionState {
  code?: string;
  branch?: string;
  sender?: string;
  recipient?: string;
}

const MIN_FILL_MS = 1500;

/** Captura pública por QR. No requiere sesión: valida todo en el servidor y deja el envío EN ESPERA. */
export async function captureAction(_prev: CaptureState, formData: FormData): Promise<CaptureState> {
  try {
    // Campo trampa (honeypot): una persona nunca lo ve ni lo llena. Si viene lleno es un bot: se simula éxito sin guardar nada.
    const trap = formData.get('website');
    if (typeof trap === 'string' && trap.trim() !== '') {
      return { ok: true, code: String(randomInt(0, 10000)).padStart(4, '0'), branch: '', sender: '', recipient: '' };
    }
    // Trampa de tiempo: llenar el formulario toma más de un par de segundos.
    const t = Number(formData.get('_t'));
    if (!Number.isFinite(t) || Date.now() - t < MIN_FILL_MS) {
      return { ok: false, error: 'Un momento, por favor. Revise sus datos y vuelva a presionar el botón.', values: echoValues(formData) };
    }

    const ctx = await getRequestContext();
    const result = await captureEnvio(
      {
        request_id: formData.get('request_id'),
        sender_name: formData.get('sender_name'),
        sender_phone: formData.get('sender_phone'),
        recipient_name: formData.get('recipient_name'),
        branch_id: formData.get('branch_id'),
        size_id: formData.get('size_id'),
      },
      ctx,
    );
    return {
      ok: true,
      code: result.code,
      branch: result.branch,
      sender: String(formData.get('sender_name') ?? '').trim().slice(0, 100),
      recipient: String(formData.get('recipient_name') ?? '').trim().slice(0, 100),
    };
  } catch (err) {
    unstable_rethrow(err);
    return { ...toActionState(err, 'envios.capture'), values: echoValues(formData) };
  }
}
