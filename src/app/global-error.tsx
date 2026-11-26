'use client';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es-MX">
      <body style={{ fontFamily: 'system-ui, sans-serif', display: 'grid', placeItems: 'center', minHeight: '100vh', margin: 0, background: '#071634', color: '#fff', textAlign: 'center' }}>
        <div style={{ padding: 24 }}>
          <h1>Algo salió mal</h1>
          <p>Inténtelo de nuevo en un momento.</p>
          <button type="button" onClick={reset} style={{ padding: '12px 22px', borderRadius: 12, border: 0, fontWeight: 700 }}>Reintentar</button>
        </div>
      </body>
    </html>
  );
}
