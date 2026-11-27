'use client';

import { useEffect, useRef, useState } from 'react';

/** Segundos que la escena se queda quieta al terminar, antes de reiniciar. */
const HOLD_MS = 4500;
const FADE_MS = 900;

type Nav = Navigator & { connection?: { saveData?: boolean; effectiveType?: string } };

/**
 * Video de fondo. Se prepara con calma para no competir con la carga de la página:
 * mientras tanto se ve el primer cuadro como imagen (idéntico al video), y solo se
 * reproduce cuando ya está suficiente cargado. Si el equipo no puede con él, se queda
 * en la imagen final.
 */
export function HeroVideo({ variant }: { variant: 'login' | 'pub' }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [veil, setVeil] = useState(false);
  const [still, setStill] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const conn = (navigator as Nav).connection;
    if (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      conn?.saveData ||
      conn?.effectiveType === 'slow-2g' ||
      conn?.effectiveType === '2g'
    ) {
      setStill(true);
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    let started = false;
    let dead = false;
    const later = (fn: () => void, ms: number) => timers.push(setTimeout(fn, ms));

    const wide = window.matchMedia('(min-width: 921px)').matches;
    const src = wide ? `/marca/${variant}.mp4` : '/marca/m.mp4';

    const giveUp = () => {
      if (dead) return;
      v.pause();
      setStill(true);
    };

    const checkSmooth = () => {
      const q = v.getVideoPlaybackQuality?.();
      if (q && q.totalVideoFrames > 20 && q.droppedVideoFrames / q.totalVideoFrames > 0.3) giveUp();
    };

    const begin = () => {
      if (started || dead) return;
      started = true;
      v.play()
        .then(() => later(checkSmooth, 2200))
        .catch(() => undefined);
    };

    const onEnded = () => {
      later(() => {
        setVeil(true);
        later(() => {
          const go = () => {
            v.play().catch(() => undefined);
            setVeil(false);
          };
          v.addEventListener('seeked', go, { once: true });
          v.currentTime = 0;
        }, FADE_MS);
      }, HOLD_MS);
    };

    const onVisibility = () => {
      if (document.hidden) v.pause();
      else if (started && !v.ended && !dead) v.play().catch(() => undefined);
    };

    v.addEventListener('canplaythrough', begin, { once: true });
    v.addEventListener('ended', onEnded);
    document.addEventListener('visibilitychange', onVisibility);

    // Si tarda demasiado en cargar, no se insiste: se queda la imagen.
    later(() => {
      if (!started) giveUp();
    }, 9000);

    // La descarga empieza cuando la página ya terminó de cargar, sin competir con ella.
    const load = () => {
      if (dead) return;
      v.src = src;
      v.load();
    };
    const kick = () => later(load, 150);
    if (document.readyState === 'complete') kick();
    else window.addEventListener('load', kick, { once: true });

    return () => {
      dead = true;
      timers.forEach(clearTimeout);
      v.removeEventListener('canplaythrough', begin);
      v.removeEventListener('ended', onEnded);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('load', kick);
    };
  }, [variant]);

  return (
    <div className={`hv${still ? ' hv--still' : ''}`} aria-hidden="true">
      <video ref={ref} muted playsInline preload="none" disablePictureInPicture tabIndex={-1} />
      <div className={`hv__veil${veil ? ' on' : ''}`} />
    </div>
  );
}
