import Link from 'next/link';
import type { TabCounts } from '@/lib/envios';

/** Colores de la marca para las repeticiones del nombre (fill, opacidad). Muy tenues para no estorbar la lectura. */
const PALETTE: [string, number][] = [
  ['#123274', 0.1],
  ['#2f6bff', 0.13],
  ['#ffa13d', 0.2],
  ['#7aa8ff', 0.2],
  ['#8b9bb8', 0.24],
  ['#f27a0a', 0.14],
];
const PERIOD = 560; // separación horizontal entre frases
const ROW_H = 92;
const ROWS = 6; // par y múltiplo de la paleta: el patrón repite sin costuras

/** Fondo del panel: "FÉNIX POINT" repetido muchas veces, cada frase en un color distinto. */
export function PanelWatermark() {
  const texts: { x: number; y: number; c: [string, number] }[] = [];
  for (let r = 0; r < ROWS; r++) {
    const c0 = PALETTE[(2 * r) % PALETTE.length];
    const c1 = PALETTE[(2 * r + 1) % PALETTE.length];
    const y = 66 + r * ROW_H;
    if (r % 2 === 0) {
      texts.push({ x: 0, y, c: c0 }, { x: PERIOD, y, c: c1 });
    } else {
      texts.push({ x: PERIOD / 2, y, c: c0 }, { x: PERIOD / 2 + PERIOD, y, c: c1 }, { x: PERIOD / 2 - PERIOD, y, c: c1 });
    }
  }
  return (
    <svg className="wm no-print" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="wm-pat" width={PERIOD * 2} height={ROW_H * ROWS} patternUnits="userSpaceOnUse" patternTransform="rotate(-14)">
          {texts.map((t, i) => (
            <text key={i} x={t.x} y={t.y} fill={t.c[0]} fillOpacity={t.c[1]} style={{ fontFamily: 'var(--font-display), Georgia, serif', fontWeight: 700, fontSize: 52, letterSpacing: 5 }}>
              FÉNIX POINT
            </text>
          ))}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#wm-pat)" />
    </svg>
  );
}

function greeting(hour: number) {
  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

export function WelcomeBar({ name, tz, counts }: { name: string; tz: string; counts: TabCounts | null }) {
  const now = new Date();
  let hour = now.getHours();
  let date = '';
  try {
    hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }).format(now));
    date = new Intl.DateTimeFormat('es-MX', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long' }).format(now);
    date = date.charAt(0).toUpperCase() + date.slice(1);
  } catch {
    date = '';
  }
  const first = name.trim().split(/\s+/)[0] || name;
  return (
    <section className="welcome no-print" aria-label="Resumen del día">
      <div className="welcome__who">
        <span className="welcome__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7" /><circle cx="7" cy="17.5" r="1.8" /><circle cx="17" cy="17.5" r="1.8" /></svg>
        </span>
        <div>
          <h2>{greeting(hour)}, {first}</h2>
          {date && <p>{date}</p>}
        </div>
      </div>
      {counts && (
        <div className="welcome__chips">
          <Link className="welcome__chip" href="/panel"><b>{counts.en_espera}</b> en espera</Link>
          <Link className="welcome__chip" href="/panel/recibidos"><b>{counts.recibido_hoy}</b> recibidos hoy</Link>
        </div>
      )}
    </section>
  );
}
