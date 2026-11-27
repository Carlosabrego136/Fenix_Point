import bwipjs from 'bwip-js/node';
import { CINZEL_700, INTER_600, INTER_700, LOGO_JPG } from '@/lib/poster-assets';

/** Medidas del cartel (A4 a 150 dpi). Todo se dibuja en este espacio. */
export const POSTER_W = 1240;
export const POSTER_H = 1754;

const NAVY = '#0b2152';
const NAVY_DEEP = '#040b1f';
const EMBER = '#ffa13d';
const EMBER_DARK = '#f27a0a';

function matrix(url: string): { n: number; on: (x: number, y: number) => boolean } {
  const [r] = bwipjs.raw({ bcid: 'qrcode', text: url, eclevel: 'H' } as Parameters<typeof bwipjs.raw>[0]) as unknown as { pixs: number[]; pixx: number }[];
  const n = r.pixx;
  return { n, on: (x, y) => x >= 0 && y >= 0 && x < n && y < n && r.pixs[y * n + x] === 1 };
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const f = (v: number) => Math.round(v * 100) / 100;

/**
 * Dibuja el QR estilizado (puntos redondeados, ojos con borde, logo al centro).
 * Devuelve el contenido SVG sin envoltorio, ocupando un cuadrado de `size` en (ox, oy).
 * Siempre oscuro sobre blanco y con corrección de errores H para que escanee bien.
 */
function qrArt(url: string, ox: number, oy: number, size: number, withLogo: boolean): string {
  const { n, on } = matrix(url);
  const quiet = 3; // módulos de margen blanco dentro de la tarjeta
  const cell = size / (n + quiet * 2);
  const x0 = ox + quiet * cell;
  const y0 = oy + quiet * cell;
  const inEye = (x: number, y: number) => (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);

  // Zona del logo (centro). ~21 % del ancho del QR; H tolera hasta ~30 % de daño.
  const logoMods = withLogo ? Math.round(n * 0.22) | 1 : 0;
  const lo = Math.floor((n - logoMods) / 2);
  const inLogo = (x: number, y: number) => withLogo && x >= lo - 1 && x < lo + logoMods + 1 && y >= lo - 1 && y < lo + logoMods + 1;

  let dots = '';
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!on(x, y) || inEye(x, y) || inLogo(x, y)) continue;
      const px = x0 + x * cell;
      const py = y0 + y * cell;
      dots += `<rect x="${f(px + cell * 0.03)}" y="${f(py + cell * 0.03)}" width="${f(cell * 0.94)}" height="${f(cell * 0.94)}" rx="${f(cell * 0.3)}"/>`;
    }
  }

  const eye = (ex: number, ey: number) => {
    const px = x0 + ex * cell;
    const py = y0 + ey * cell;
    return (
      `<rect x="${f(px + cell * 0.5)}" y="${f(py + cell * 0.5)}" width="${f(cell * 6)}" height="${f(cell * 6)}" rx="${f(cell * 1.1)}" fill="none" stroke="${NAVY}" stroke-width="${f(cell)}"/>` +
      `<rect x="${f(px + cell * 2)}" y="${f(py + cell * 2)}" width="${f(cell * 3)}" height="${f(cell * 3)}" rx="${f(cell * 0.6)}" fill="${NAVY}"/>`
    );
  };
  const eyes = eye(0, 0) + eye(n - 7, 0) + eye(0, n - 7);

  let logo = '';
  if (withLogo) {
    const lx = x0 + lo * cell;
    const ly = y0 + lo * cell;
    const ls = logoMods * cell;
    logo =
      `<rect x="${f(lx - cell * 0.6)}" y="${f(ly - cell * 0.6)}" width="${f(ls + cell * 1.2)}" height="${f(ls + cell * 1.2)}" rx="${f(cell * 1.9)}" fill="#fff"/>` +
      `<clipPath id="qrlogo"><rect x="${f(lx)}" y="${f(ly)}" width="${f(ls)}" height="${f(ls)}" rx="${f(cell * 1.5)}"/></clipPath>` +
      `<image href="data:image/jpeg;base64,${LOGO_JPG}" x="${f(lx)}" y="${f(ly)}" width="${f(ls)}" height="${f(ls)}" preserveAspectRatio="xMidYMid slice" clip-path="url(#qrlogo)"/>`;
  }

  return `<g fill="${NAVY}">${dots}</g>${eyes}${logo}`;
}

const FONT_FACE = `
@font-face{font-family:'FP Cinzel';font-weight:700;src:url(data:font/woff2;base64,${CINZEL_700}) format('woff2');}
@font-face{font-family:'FP Inter';font-weight:600;src:url(data:font/woff2;base64,${INTER_600}) format('woff2');}
@font-face{font-family:'FP Inter';font-weight:700;src:url(data:font/woff2;base64,${INTER_700}) format('woff2');}
.d{font-family:'FP Cinzel',Georgia,serif;font-weight:700}
.b{font-family:'FP Inter',system-ui,Arial,sans-serif;font-weight:600}
.bb{font-family:'FP Inter',system-ui,Arial,sans-serif;font-weight:700}`;

/** Solo el QR estilizado (descarga independiente), en blanco con esquinas redondeadas. */
export function buildQrOnlySvg(url: string): string {
  const s = 1000;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}" width="${s}" height="${s}">` +
    `<rect width="${s}" height="${s}" rx="64" fill="#fff"/>${qrArt(url, 0, 0, s, true)}</svg>`
  );
}

function truck(x: number, y: number, k: number): string {
  // Camión de lado: remolque con contenedor + cabina. Origen en la esquina inferior izquierda de la caja.
  const w = (v: number) => f(v * k);
  const wheel = (cx: number) => `<circle cx="${f(x + cx * k)}" cy="${f(y + 6 * k)}" r="${w(15)}" fill="${NAVY_DEEP}" stroke="#fff" stroke-width="${w(4)}"/><circle cx="${f(x + cx * k)}" cy="${f(y + 6 * k)}" r="${w(5)}" fill="#fff"/>`;
  return (
    `<g opacity="0.96">` +
    `<rect x="${f(x)}" y="${f(y - 150 * k)}" width="${w(300)}" height="${w(142)}" rx="${w(10)}" fill="#fff"/>` +
    [30, 70, 110, 150, 190, 230, 270].map((v) => `<rect x="${f(x + v * k)}" y="${f(y - 142 * k)}" width="${w(5)}" height="${w(126)}" fill="#d3def5"/>`).join('') +
    `<rect x="${f(x)}" y="${f(y - 8 * k)}" width="${w(420)}" height="${w(14)}" rx="${w(5)}" fill="#8fa3c8"/>` +
    `<path d="M${f(x + 312 * k)} ${f(y - 100 * k)} h${w(58)} l${w(34)} ${w(46)} v${w(46)} h${w(-92)} Z" fill="${EMBER_DARK}"/>` +
    `<path d="M${f(x + 326 * k)} ${f(y - 88 * k)} h${w(38)} l${w(22)} ${w(32)} h${w(-60)} Z" fill="#cfe1ff"/>` +
    wheel(60) + wheel(105) + wheel(150) + wheel(345) + wheel(390) +
    `</g>`
  );
}

export function buildPosterSvg(url: string): string {
  const W = POSTER_W;
  const cx = W / 2;
  const host = url.replace(/^https?:\/\//, '');

  // Tarjeta del QR
  const cardS = 660;
  const cardX = cx - cardS / 2;
  const cardY = 628;

  const steps = [
    { n: '1', t: 'Llene sus datos' },
    { n: '2', t: 'Lleve su paquete' },
    { n: '3', t: 'Reciba su folio' },
  ];
  const stepsY = 1452;
  const stepX = [250, 620, 990];
  const stepsSvg =
    `<line x1="${stepX[0]}" y1="${stepsY}" x2="${stepX[2]}" y2="${stepsY}" stroke="${EMBER}" stroke-opacity="0.55" stroke-width="4" stroke-dasharray="4 14" stroke-linecap="round"/>` +
    steps
      .map(
        (s, i) =>
          `<circle cx="${stepX[i]}" cy="${stepsY}" r="34" fill="${EMBER}"/><circle cx="${stepX[i]}" cy="${stepsY}" r="34" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="3"/>` +
          `<text x="${stepX[i]}" y="${stepsY + 13}" text-anchor="middle" class="bb" font-size="36" fill="#2b1600">${s.n}</text>` +
          `<text x="${stepX[i]}" y="${stepsY + 84}" text-anchor="middle" class="b" font-size="30" fill="#e6eeff">${esc(s.t)}</text>`,
      )
      .join('');

  const watermark = [0, 1, 2, 3, 4, 5, 6, 7]
    .map((i) => `<text x="${(i % 2) * -260}" y="${i * 250}" class="d" font-size="210" fill="#fff" fill-opacity="0.035" letter-spacing="14">FÉNIX POINT · FÉNIX POINT · FÉNIX POINT</text>`)
    .join('');

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${POSTER_W} ${POSTER_H}" width="${POSTER_W}" height="${POSTER_H}" role="img" aria-label="Cartel Fénix Point con código QR para registrar envíos">` +
    `<defs><style>${FONT_FACE}</style>` +
    `<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d2a6b"/><stop offset=".5" stop-color="#071634"/><stop offset="1" stop-color="${NAVY_DEEP}"/></linearGradient>` +
    `<radialGradient id="g1" cx="85%" cy="4%" r="60%"><stop offset="0" stop-color="#2f6bff" stop-opacity=".55"/><stop offset="1" stop-color="#2f6bff" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="g2" cx="0%" cy="100%" r="55%"><stop offset="0" stop-color="${EMBER}" stop-opacity=".32"/><stop offset="1" stop-color="${EMBER}" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="ember" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${EMBER}"/><stop offset="1" stop-color="#ffd08a"/></linearGradient>` +
    `<clipPath id="plogo"><rect x="${cx - 95}" y="60" width="190" height="190" rx="42"/></clipPath>` +
    `<clipPath id="page"><rect width="${POSTER_W}" height="${POSTER_H}"/></clipPath></defs>` +
    `<g clip-path="url(#page)">` +
    `<rect width="${POSTER_W}" height="${POSTER_H}" fill="url(#bg)"/><rect width="${POSTER_W}" height="${POSTER_H}" fill="url(#g1)"/><rect width="${POSTER_W}" height="${POSTER_H}" fill="url(#g2)"/>` +
    `<g transform="rotate(-18 ${cx} 900) translate(-300 -200)">${watermark}</g>` +
    // franja superior de color
    `<rect width="${POSTER_W}" height="12" fill="url(#ember)"/>` +
    // logo
    `<rect x="${cx - 103}" y="52" width="206" height="206" rx="48" fill="#fff" fill-opacity=".14"/>` +
    `<image href="data:image/jpeg;base64,${LOGO_JPG}" x="${cx - 95}" y="60" width="190" height="190" clip-path="url(#plogo)" preserveAspectRatio="xMidYMid slice"/>` +
    // títulos
    `<text x="${cx}" y="352" text-anchor="middle" class="d" font-size="92" fill="#fff" letter-spacing="3">REGISTRE SU</text>` +
    `<text x="${cx}" y="452" text-anchor="middle" class="d" font-size="104" fill="url(#ember)" letter-spacing="3">ENVÍO</text>` +
    `<text x="${cx}" y="512" text-anchor="middle" class="b" font-size="34" fill="#c7d6f2">En un minuto y sin crear cuenta</text>` +
    `<g transform="translate(${cx - 150} 540)"><rect width="300" height="52" rx="26" fill="${EMBER}"/><text x="150" y="36" text-anchor="middle" class="bb" font-size="26" letter-spacing="5" fill="#2b1600">ESCANEE AQUÍ</text></g>` +
    // tarjeta QR
    `<rect x="${cardX - 18}" y="${cardY - 18}" width="${cardS + 36}" height="${cardS + 36}" rx="62" fill="url(#ember)"/>` +
    `<rect x="${cardX}" y="${cardY}" width="${cardS}" height="${cardS}" rx="46" fill="#fff"/>` +
    qrArt(url, cardX, cardY, cardS, true) +
    // URL
    `<g transform="translate(${cx} ${cardY + cardS + 92})"><text text-anchor="middle" class="bb" font-size="40" fill="#fff" letter-spacing="1">${esc(host)}</text></g>` +
    // pasos
    stepsSvg +
    // camión + carretera
    `<line x1="0" y1="1690" x2="${POSTER_W}" y2="1690" stroke="#fff" stroke-opacity=".18" stroke-width="3"/>` +
    truck(70, 1686, 0.5) +
    `<line x1="520" y1="1690" x2="${POSTER_W}" y2="1690" stroke="${EMBER}" stroke-opacity=".5" stroke-width="3" stroke-dasharray="26 22"/>` +
    `<text x="${POSTER_W - 60}" y="1660" text-anchor="end" class="d" font-size="34" fill="#fff" fill-opacity=".9" letter-spacing="3">FÉNIX POINT</text>` +
    `<text x="${POSTER_W - 60}" y="1728" text-anchor="end" class="b" font-size="24" fill="#9fb4e2">Envíos Ayora · Tijuana y Ensenada</text>` +
    `</g></svg>`
  );
}
