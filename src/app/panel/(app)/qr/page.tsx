import { headers } from 'next/headers';
import { PrintNow } from '@/components/ui/Bits';
import { PosterDownloads } from '@/components/panel/PosterDownloads';
import { requirePageUser } from '@/lib/auth';
import { buildPosterSvg, buildQrOnlySvg } from '@/lib/poster';

export const metadata = { title: 'Código QR' };
export const dynamic = 'force-dynamic';

async function publicUrl(): Promise<string> {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '');
  if (env) return env;
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export default async function QrPage() {
  await requirePageUser('settings.write');
  const url = await publicUrl();
  const posterSvg = buildPosterSvg(url);
  const qrSvg = buildQrOnlySvg(url);

  return (
    <>
      <header className="page-head no-print">
        <div>
          <h1>Código QR del cliente</h1>
          <p>Imprímalo y colóquelo en el mostrador. El cliente lo escanea con la cámara de su celular y llena el formulario sin crear cuenta.</p>
        </div>
        <div className="page-head__actions">
          <PrintNow auto={false} label="Imprimir cartel" />
          <PosterDownloads posterId="poster-art" qrSvg={qrSvg} />
        </div>
      </header>

      <section id="poster-art" className="poster-art" aria-label="Cartel con código QR" dangerouslySetInnerHTML={{ __html: posterSvg }} />

      <p className="alert alert--warn no-print" style={{ maxWidth: 560, marginInline: 'auto' }}>
        <span>Este QR apunta a <b>{url}</b>. Si algún día cambia el nombre del proyecto o la dirección, los QR ya impresos dejarían de funcionar.</span>
      </p>
    </>
  );
}
