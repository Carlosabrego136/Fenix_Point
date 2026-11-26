export type Role = 'admin' | 'operador';

export type Permission =
  | 'envios.operate' // ver en espera, recibir, descartar, imprimir etiqueta, marcar cobro
  | 'envios.manage' // historial, corte, exportar, corregir, finalizar, cancelar recibidos
  | 'settings.write' // puntos, tamaños y precios, etiqueta, mensajes
  | 'users.manage'; // cambiar la contraseña del operador

const MATRIX: Record<Role, ReadonlySet<Permission>> = {
  admin: new Set<Permission>(['envios.operate', 'envios.manage', 'settings.write', 'users.manage']),
  // El ayudante del mostrador: solo ve lo que está en espera, recibe e imprime. Sin corte, historial, exportar ni ajustes.
  operador: new Set<Permission>(['envios.operate']),
};

export function can(role: Role, permission: Permission): boolean {
  return MATRIX[role]?.has(permission) ?? false;
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administradora',
  operador: 'Mostrador',
};
