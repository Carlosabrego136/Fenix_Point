import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { logoutAction } from '@/app/panel/actions';
import { LogoutButton } from '@/components/panel/LoginForm';
import { Nav, type NavItem } from '@/components/panel/Nav';
import { getCurrentUser } from '@/lib/auth';
import { tabCounts, type TabCounts } from '@/lib/envios';
import { can, ROLE_LABEL } from '@/lib/permissions';
import { appTimezone } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/panel/login');

  let counts: TabCounts | null = null;
  try {
    counts = await tabCounts(await appTimezone());
  } catch {
    counts = null;
  }
  const admin = can(user.role, 'envios.manage');

  const items: NavItem[] = [
    { href: '/panel', label: 'En espera', icon: 'clock', exact: true, badge: counts?.en_espera, section: 'Mostrador' },
    { href: '/panel/recibidos', label: admin ? 'Recibidos' : 'Recibidos hoy', icon: 'box' },
  ];
  if (admin) {
    items.push({ href: '/panel/finalizados', label: 'Finalizados', icon: 'checkcircle' });
    items.push({ href: '/panel/corte', label: 'Corte del día', icon: 'calc', section: 'Administración' });
    items.push({ href: '/panel/historial', label: 'Historial', icon: 'list' });
    items.push({ href: '/panel/ajustes', label: 'Ajustes', icon: 'settings' });
    items.push({ href: '/panel/qr', label: 'Código QR', icon: 'qr' });
  }
  items.push({ href: '/panel/cuenta', label: admin ? 'Cuenta y accesos' : 'Mi cuenta', icon: 'user', section: admin ? undefined : 'Cuenta' });

  return (
    <div className="shell">
      <a className="skip-link" href="#contenido">Saltar al contenido</a>
      <aside className="side">
        <div className="side__brand">
          <img src="/marca/logo-fenix-point.jpg" alt="" width={52} height={52} />
          <div>
            <strong>FÉNIX POINT</strong>
            <span>Panel del mostrador</span>
          </div>
        </div>
        <Nav items={items} />
        <div className="side__user">
          <div>
            <strong>{user.name}</strong>
            <span>{ROLE_LABEL[user.role]}</span>
          </div>
          <LogoutButton action={logoutAction} />
        </div>
      </aside>
      <main id="contenido" className="main">
        {children}
      </main>
    </div>
  );
}
