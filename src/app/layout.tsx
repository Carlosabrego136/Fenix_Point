import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import '@fontsource/cinzel/600.css';
import '@fontsource/cinzel/700.css';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Fénix Point', template: '%s · Fénix Point' },
  description: 'Registre su envío en Fénix Point.',
  // Sitio privado: no debe aparecer en buscadores.
  robots: { index: false, follow: false, nocache: true, noarchive: true, nosnippet: true, noimageindex: true },
  icons: { icon: '/marca/logo-fenix-point.jpg' },
};

export const viewport: Viewport = { themeColor: '#071634', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-MX">
      <body>{children}</body>
    </html>
  );
}
