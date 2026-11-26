import { ChangePasswordForm, ResetOperatorForm } from '@/components/panel/SettingsForms';
import { requirePageUser } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import { can, ROLE_LABEL } from '@/lib/permissions';
import { appTimezone } from '@/lib/settings';
import { listOperators, type OperatorRow } from '@/lib/users';

export const metadata = { title: 'Cuenta' };
export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const user = await requirePageUser('envios.operate');
  const admin = can(user.role, 'users.manage');
  let operators: OperatorRow[] = [];
  let tz = 'America/Tijuana';
  if (admin) {
    try {
      [operators, tz] = await Promise.all([listOperators(), appTimezone()]);
    } catch {
      operators = [];
    }
  }

  return (
    <>
      <header className="page-head">
        <div>
          <h1>{admin ? 'Cuenta y accesos' : 'Mi cuenta'}</h1>
          <p>Usted ingresó como <b>{user.name}</b> ({ROLE_LABEL[user.role]}), usuario «{user.username}».</p>
        </div>
      </header>

      <section className="card stack" aria-labelledby="h-pass">
        <h2 id="h-pass">Cambiar mi contraseña</h2>
        <ChangePasswordForm />
      </section>

      {admin && (
        <section className="card stack" aria-labelledby="h-op">
          <div>
            <h2 id="h-op">Acceso del mostrador</h2>
            <p className="muted">Si su ayudante olvida su contraseña o quiere cambiarla, restablézcala aquí. Se cerrará su sesión abierta.</p>
          </div>
          {operators.length === 0 ? (
            <p className="muted">No hay un usuario de mostrador creado todavía.</p>
          ) : (
            operators.map((o) => (
              <div key={o.id} style={{ borderTop: '1px solid var(--line)', paddingTop: 16, display: 'grid', gap: 12 }}>
                <p><b>{o.name}</b> · usuario «{o.username}» · {o.is_active ? 'activo' : 'desactivado'} · último acceso: {o.last_login_at ? formatDateTime(o.last_login_at, tz) : 'nunca'}</p>
                <ResetOperatorForm operatorId={o.id} username={o.username} />
              </div>
            ))
          )}
        </section>
      )}
    </>
  );
}
