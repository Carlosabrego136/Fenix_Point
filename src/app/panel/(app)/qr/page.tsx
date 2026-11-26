import bwipjs from 'bwip-js/node';
import { headers } from 'next/headers';
import { PrintNow } from '@/components/ui/Bits';
import { requirePageUser } from '@/lib/auth';

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
  const svg = bwipjs.toSVG({ bcid: 'qrcode', text: url, scale: 4, paddingwidth: 0, paddingheight: 0, eclevel: 'Q' } as Parameters<typeof bwipjs.toSVG>[0]);
  const download = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

  return (
    <>
      <header className="page-head no-print">
        <div>
          <h1>Código QR del cliente</h1>
          <p>Imprímalo y colóquelo en el mostrador. El cliente lo escanea con la cámara de su celular y llena el formulario sin crear cuenta.</p>
        </div>
        <div className="page-head__actions">
          <PrintNow auto={false} label="Imprimir cartel" />
          <a className="btn btn--ghost" href={download} download="fenix-point-qr.svg">Descargar QR (SVG)</a>
        </div>
      </header>

      <section className="poster" aria-label="Cartel con código QR">
        <img className="poster__logo" src="/marca/logo-fenix-point.jpg" alt="Fénix Point" width={120} height={120} />
        <h2>Registre su envío aquí</h2>
        <p>Escanee con la cámara de su celular</p>
        <div className="poster__qr" role="img" aria-label={`Código QR que abre ${url}`} dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="url">{url.replace(/^https?:\/\//, '')}</p>
        <p style={{ fontSize: 13 }}>Llene sus datos, lleve su paquete al mostrador y reciba su folio.</p>
      </section>

      <p className="alert alert--warn no-print" style={{ maxWidth: 520, marginInline: 'auto' }}>
        <span>Este QR apunta a <b>{url}</b>. Si algún día cambia el nombre del proyecto o la dirección, los QR ya impresos dejarían de funcionar.</span>
      </p>
    </>
  );
}
