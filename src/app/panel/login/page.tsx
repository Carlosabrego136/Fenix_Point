import { redirect } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { LoginForm } from '@/components/panel/LoginForm';
import { getCurrentUser } from '@/lib/auth';
import { isDbConfigured } from '@/lib/db';

export const metadata = { title: 'Acceso' };
export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  if (isDbConfigured() && (await getCurrentUser())) redirect('/panel');
  return (
    <main className="login" id="contenido">
      <div className="login__card" style={{ marginTop: 70 }}>
        <img src="/marca/logo-fenix-point.jpg" alt="Fénix Point · Tu logística, en un solo punto." width={150} height={150} />
        <h1>Acceso al panel</h1>
        <p className="lead">Ingrese con su usuario y contraseña.</p>
        {!isDbConfigured() && (
          <p className="alert alert--error" role="alert"><Icon name="alert" size={18} /> <span>El sistema no está disponible por el momento.</span></p>
        )}
        <LoginForm />
      </div>
    </main>
  );
}
