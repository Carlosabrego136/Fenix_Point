import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="login" id="contenido">
      <div className="login__card" style={{ textAlign: 'center' }}>
        <h1>No encontramos esa página</h1>
        <p className="lead" style={{ marginTop: 0 }}>Puede que el enlace esté incompleto o que el registro ya no exista.</p>
        <Link className="btn btn--primary" href="/panel">Ir al panel</Link>
        <Link className="btn btn--ghost" href="/">Ir al formulario</Link>
      </div>
    </main>
  );
}
