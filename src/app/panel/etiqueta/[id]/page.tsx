import bwipjs from 'bwip-js/node';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { PrintNow } from '@/components/ui/Bits';
import { canViewEnvio } from '@/lib/access';
import { requirePageUser } from '@/lib/auth';
import { getEnvio } from '@/lib/envios';
import { formatDateTime, moneyMx, padFolio } from '@/lib/format';
import { appTimezone, loadSettings } from '@/lib/settings';

export const metadata = { title: 'Etiqueta', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

function barcodeSvg(text: string): string {
  // Solo dígitos (el folio): Code 128 en modo numérico. SVG generado por la librería, sin entrada del usuario.
  const svg = bwipjs.toSVG({ bcid: 'code128', text, height: 11, includetext: false, scale: 2, paddingwidth: 0, paddingheight: 0 });
  // Se estira solo a lo alto (las barras conservan su ancho); así el código ocupa poco espacio en la etiqueta.
  return svg.replace('<svg ', '<svg preserveAspectRatio="none" ');
}

// Solo esta página define el papel de la etiqueta (50 × 100 mm); el resto del panel imprime en hoja normal.
// Chrome recorta unas décimas de milímetro al papel: la etiqueta mide 98 mm para no saltar a una segunda hoja.
const PRINT_CSS = `
@media print {
  @page { size: 50mm 100mm; margin: 0; }
  html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; height: 98mm !important; overflow: hidden !important; }
  .no-print, .skip-link { display: none !important; }
  .lbl-page { display: block; background: #fff !important; padding: 0 !important; min-height: 0 !important; height: 98mm; overflow: hidden; }
  .lbl { box-shadow: none; width: 50mm; height: 98mm; break-inside: avoid; page-break-after: avoid; page-break-inside: avoid; }
}`;

export default async function LabelPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ auto?: string }> }) {
  const user = await requirePageUser('envios.operate');
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const envio = await getEnvio(id);
  if (!envio) notFound();
  if (envio.status === 'en_espera') redirect(`/panel/recibir/${id}`);
  if (envio.folio_number === null) notFound();
  const [tz, settings] = await Promise.all([appTimezone(), loadSettings()]);
  if (!canViewEnvio(user.role, envio, tz)) redirect('/panel?aviso=sin-permiso');
  const sp = await searchParams;
  const cancelled = envio.status === 'cancelado';
  const number = padFolio(envio.folio_number);

  return (
    <main className="lbl-page" id="contenido">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <div className="lbl-toolbar no-print">
        <div className="row-actions">
          <PrintNow auto={sp.auto === '1' && !cancelled} />
          <Link className="btn btn--ghost" href={`/panel/envio/${envio.id}`}>Ver envío</Link>
          <Link className="btn btn--ghost" href="/panel">Volver a en espera</Link>
        </div>
        <p className="field__hint">En el cuadro de impresión elija su impresora térmica, tamaño 50 × 100 mm, márgenes «ninguno» y escala 100 %.</p>
      </div>

      <article className={`lbl ${cancelled ? 'lbl--cancelled' : ''}`} aria-label={`Etiqueta del folio ${number}`}>
        <header className="lbl__logo">
          <img src="/marca/logo-etiqueta.png" alt="Fénix Point" width={720} height={569} />
        </header>
        <div className="lbl__folio">{number}</div>
        <div className="lbl__barcode" aria-hidden="true" dangerouslySetInnerHTML={{ __html: barcodeSvg(number) }} />
        <div className="lbl__row"><span>{settings.label_branch_title.toUpperCase()}</span><strong>{envio.branch}</strong></div>
        <div className="lbl__row"><span>PARA</span><strong>{envio.recipient_name}</strong></div>
        <div className="lbl__row"><span>DE</span><strong>{envio.sender_name}</strong></div>
        <div className="lbl__row lbl__row--split">
          <div><span>TAMAÑO</span><strong>{envio.size_name}{envio.weight_kg ? ` · ${Number(envio.weight_kg)} kg` : ''}</strong></div>
          <div><span>{envio.paid ? 'PAGADO' : 'POR COBRAR'}</span><strong>{moneyMx(envio.price)}</strong></div>
        </div>
        <footer className="lbl__foot">
          {formatDateTime(envio.received_at, tz)} · {envio.received_by_name}
          {settings.label_note ? <><br />{settings.label_note}</> : null}
        </footer>
        {cancelled && <div className="lbl__stamp">CANCELADO</div>}
      </article>
    </main>
  );
}
