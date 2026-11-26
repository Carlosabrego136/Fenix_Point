'use client';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="login" id="contenido">
      <div className="login__card" style={{ textAlign: 'center' }}>
        <h1>Algo salió mal</h1>
        <p className="lead" style={{ marginTop: 0 }}>No pudimos completar la solicitud. Inténtelo de nuevo en un momento.{error.digest ? ` (ref. ${error.digest})` : ''}</p>
        <button type="button" className="btn btn--primary" onClick={reset}>Reintentar</button>
      </div>
    </main>
  );
}
