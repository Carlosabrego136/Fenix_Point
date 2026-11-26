'use server';

import { revalidatePath } from 'next/cache';
import { redirect, unstable_rethrow } from 'next/navigation';
import { getCurrentUser, requireUser } from '@/lib/auth';
import { saveBranch, saveSize } from '@/lib/catalog';
import { echoValues, toActionState, ValidationError, type ActionState } from '@/lib/errors';
import { cancelEnvio, finalizeEnvio, receiveEnvio, setPaid, updateEnvio } from '@/lib/envios';
import { getRequestContext } from '@/lib/security';
import { updateSettings } from '@/lib/settings';
import { actorOf, authenticate, changeOwnPassword, logout, resetOperatorPassword } from '@/lib/users';

function failure(err: unknown, context: string, formData: FormData): ActionState {
  unstable_rethrow(err); // deja pasar las redirecciones internas de Next.js
  return { ...toActionState(err, context), values: echoValues(formData) };
}

function validId(id: number): number {
  if (!Number.isSafeInteger(id) || id <= 0) throw new ValidationError({}, 'Registro inválido.');
  return id;
}

function readEnvioInput(fd: FormData) {
  return {
    sender_name: fd.get('sender_name'),
    sender_phone: fd.get('sender_phone'),
    recipient_name: fd.get('recipient_name'),
    branch_id: fd.get('branch_id'),
    size_id: fd.get('size_id'),
    weight_kg: fd.get('weight_kg'),
    notes: fd.get('notes'),
    paid: fd.get('paid') === '1',
  };
}

// ── Acceso ─────────────────────────────────────────────────────────────────
export async function loginAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await authenticate(fd.get('username'), fd.get('password'), await getRequestContext());
  } catch (err) {
    unstable_rethrow(err);
    return { ...toActionState(err, 'panel.login'), values: echoValues(fd, ['password']) };
  }
  redirect('/panel');
}

export async function logoutAction(): Promise<void> {
  try {
    await logout(await getCurrentUser(), await getRequestContext());
  } catch (err) {
    unstable_rethrow(err);
  }
  redirect('/panel/login');
}

// ── Recibir (genera el folio) ──────────────────────────────────────────────
export async function receiveAction(id: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  let destination: string;
  try {
    const user = await requireUser('envios.operate');
    validId(id);
    const { duplicate } = await receiveEnvio(id, readEnvioInput(fd), actorOf(user), await getRequestContext());
    revalidatePath('/panel', 'layout');
    destination = duplicate ? `/panel/envio/${id}?aviso=ya-recibido` : `/panel/etiqueta/${id}?auto=1`;
  } catch (err) {
    return failure(err, 'envios.receive', fd);
  }
  redirect(destination);
}

export async function updateEnvioAction(id: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser('envios.manage');
    validId(id);
    await updateEnvio(id, readEnvioInput(fd), actorOf(user), await getRequestContext());
    revalidatePath('/panel', 'layout');
    return { ok: true, message: 'Cambios guardados.' };
  } catch (err) {
    return failure(err, 'envios.update', fd);
  }
}

export async function togglePaidAction(id: number, paid: boolean): Promise<void> {
  let destination: string;
  try {
    const user = await requireUser('envios.operate');
    validId(id);
    await setPaid(id, paid === true, actorOf(user), await getRequestContext());
    revalidatePath('/panel', 'layout');
    destination = `/panel/envio/${id}?ok=${paid ? 'cobrado' : 'por-cobrar'}`;
  } catch (err) {
    unstable_rethrow(err);
    destination = `/panel/envio/${id}?error=no-se-pudo`;
  }
  redirect(destination);
}

export async function finalizeAction(id: number): Promise<void> {
  let destination: string;
  try {
    const user = await requireUser('envios.manage');
    validId(id);
    await finalizeEnvio(id, actorOf(user), await getRequestContext());
    revalidatePath('/panel', 'layout');
    destination = `/panel/envio/${id}?ok=finalizado`;
  } catch (err) {
    unstable_rethrow(err);
    destination = `/panel/envio/${id}?error=no-se-pudo`;
  }
  redirect(destination);
}

/** Descartar (en espera, sin folio) o cancelar (con folio, solo admin): siempre con motivo y con registro. */
export async function cancelAction(id: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  let destination: string;
  try {
    const user = await requireUser('envios.operate');
    validId(id);
    const { discarded } = await cancelEnvio(id, { reason: fd.get('reason') }, actorOf(user), await getRequestContext());
    revalidatePath('/panel', 'layout');
    destination = discarded ? '/panel?ok=descartado' : `/panel/envio/${id}?ok=cancelado`;
  } catch (err) {
    return failure(err, 'envios.cancel', fd);
  }
  redirect(destination);
}

// ── Ajustes (solo admin) ───────────────────────────────────────────────────
export async function saveBranchAction(id: number | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser('settings.write');
    await saveBranch(id, { name: fd.get('name'), sort_order: fd.get('sort_order'), is_active: fd.get('is_active') === 'on' }, actorOf(user), await getRequestContext());
    revalidatePath('/panel', 'layout');
    revalidatePath('/');
    return { ok: true, message: id === null ? 'Punto agregado.' : 'Punto guardado.', values: id === null ? {} : undefined };
  } catch (err) {
    return failure(err, 'branches.save', fd);
  }
}

export async function saveSizeAction(id: number | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser('settings.write');
    await saveSize(
      id,
      {
        name: fd.get('name'),
        description: fd.get('description'),
        price: fd.get('price'),
        sort_order: fd.get('sort_order'),
        show_public: fd.get('show_public') === 'on',
        is_active: fd.get('is_active') === 'on',
      },
      actorOf(user),
      await getRequestContext(),
    );
    revalidatePath('/panel', 'layout');
    revalidatePath('/');
    return { ok: true, message: id === null ? 'Tamaño agregado.' : 'Tamaño guardado.', values: id === null ? {} : undefined };
  } catch (err) {
    return failure(err, 'sizes.save', fd);
  }
}

export async function saveSettingsAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser('settings.write');
    await updateSettings(
      { label_branch_title: fd.get('label_branch_title'), label_note: fd.get('label_note'), wa_message: fd.get('wa_message'), timezone: fd.get('timezone') },
      actorOf(user),
      await getRequestContext(),
    );
    revalidatePath('/panel', 'layout');
    return { ok: true, message: 'Ajustes guardados.' };
  } catch (err) {
    return failure(err, 'settings.save', fd);
  }
}

// ── Contraseñas ────────────────────────────────────────────────────────────
export async function changePasswordAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await getCurrentUser();
    if (!user) redirect('/panel/login');
    await changeOwnPassword(user, { current: fd.get('current'), next: fd.get('next'), confirm: fd.get('confirm') }, await getRequestContext());
    return { ok: true, message: 'Su contraseña se cambió correctamente.' };
  } catch (err) {
    unstable_rethrow(err);
    return toActionState(err, 'users.password');
  }
}

export async function resetOperatorPasswordAction(operatorId: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser('users.manage');
    await resetOperatorPassword(user, validId(operatorId), { next: fd.get('next'), confirm: fd.get('confirm') }, await getRequestContext());
    return { ok: true, message: 'Contraseña del operador actualizada. Su sesión abierta se cerró.' };
  } catch (err) {
    unstable_rethrow(err);
    return toActionState(err, 'users.reset');
  }
}
