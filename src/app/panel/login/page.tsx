import { redirect } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { HeroVideo } from '@/components/ui/HeroVideo';
import { LoginForm } from '@/components/panel/LoginForm';
import { getCurrentUser } from '@/lib/auth';
import { isDbConfigured } from '@/lib/db';

export const metadata = { title: 'Acceso' };
export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  if (isDbConfigured() && (await getCurrentUser())) redirect('/panel');
  return (
    <main className="login" id="contenido">
      <HeroVideo variant="login" />

      <div className="login__wrap">
        <section className="login__brand">
          <h2>Tu logística,<br /><em>en un solo punto.</em></h2>
          <p>Recepción, seguimiento y entrega de paquetes en un mismo lugar, de forma ordenada y segura.</p>
          <ul className="login__feats">
            <li>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" /><path d="m3 8 9 5 9-5M12 13v8" /></svg>
              <span>Recepción de paquetes</span>
            </li>
            <li>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7" /><circle cx="7" cy="17.500" r="1.800" /><circle cx="17" cy="17.500" r="1.800" /></svg>
              <span>Seguimiento por folio</span>
            </li>
            <li>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s7-6.200 7-11.500a7 7 0 1 0-14 0C5 14.800 12 21 12 21Z" /><circle cx="12" cy="9.500" r="2.500" /></svg>
              <span>Entrega en sucursal</span>
            </li>
          </ul>
          <div className="login__route" aria-hidden="true"><i /><b /><i /><b /><i /></div>
        </section>

        <div className="login__card">
          <img src="/marca/logo-fenix-point.jpg" alt="Fénix Point · Tu logística, en un solo punto." width={120} height={120} />
          <h1>Acceso al panel</h1>
          <p className="lead">Ingrese con su usuario y contraseña.</p>
          {!isDbConfigured() && (
            <p className="alert alert--error" role="alert">
              <Icon name="alert" size={18} /> <span>El sistema no está disponible por el momento.</span>
            </p>
          )}
          <LoginForm />
          <p className="login__foot">Acceso exclusivo para personal autorizado</p>
        </div>
      </div>
    </main>
  );
}
