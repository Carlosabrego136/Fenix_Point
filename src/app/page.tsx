import { randomUUID } from 'node:crypto';
import { Icon } from '@/components/Icon';
import { HeroVideo } from '@/components/ui/HeroVideo';
import { PublicForm } from '@/components/PublicForm';
import { listBranches, listSizes } from '@/lib/catalog';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Registre su envío' };

export default async function PublicPage() {
  let branches: { id: number; name: string }[] = [];
  let sizes: { id: number; name: string; description: string }[] = [];
  let failed = false;
  try {
    const [b, s] = await Promise.all([listBranches(true), listSizes({ onlyPublic: true })]);
    branches = b.map((x) => ({ id: x.id, name: x.name }));
    sizes = s.map((x) => ({ id: x.id, name: x.name, description: x.description }));
  } catch (err) {
    failed = true;
    logger.error('public.page_failed', err);
  }

  return (
    <main className="pub" id="contenido">
      <HeroVideo variant="pub" />
      <div className="pub__wrap">
        <header className="pub__brand">
          <img className="pub__logo" src="/marca/logo-fenix-point.jpg" alt="Fénix Point · Tu logística, en un solo punto." width={112} height={112} />
          <h1>Registre su envío</h1>
          <p className="pub__lead">Capture los datos en un minuto y lleve su paquete al mostrador. Nosotros nos encargamos del resto.</p>
        </header>

        <ol className="pub__steps" style={{ listStyle: 'none', margin: 0, padding: 0 }} aria-label="Cómo funciona">
          <li className="pub__step"><b>1</b>Llene sus datos</li>
          <li className="pub__step"><b>2</b>Lleve su paquete al mostrador</li>
          <li className="pub__step"><b>3</b>Reciba su folio y etiqueta</li>
        </ol>

        <section className="pub-card" aria-label="Formulario de envío">
          {failed || branches.length === 0 ? (
            <div className="pub-unavailable">
              <Icon name="alert" size={34} style={{ color: 'var(--warn)' }} />
              <h2>El registro en línea no está disponible</h2>
              <p style={{ color: 'var(--muted)' }}>Por el momento acuda al mostrador y con gusto lo atendemos.</p>
            </div>
          ) : (
            <PublicForm requestId={randomUUID()} branches={branches} sizes={sizes} />
          )}
        </section>

        <footer className="pub__foot">
          <span>Fénix Point · Tu logística, en un solo punto.</span>
          <span>Envíos Ayora · Tijuana y Ensenada</span>
        </footer>
      </div>
    </main>
  );
}
