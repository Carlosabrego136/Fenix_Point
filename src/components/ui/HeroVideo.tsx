'use client';

import { useEffect, useRef, useState } from 'react';

/** Segundos que la escena se queda quieta al terminar, antes de reiniciar. */
const HOLD_MS = 4500;
const FADE_MS = 900;

export function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [veil, setVeil] = useState(false);
  const [still, setStill] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setStill(true);
      return;
    }
    const wide = window.matchMedia('(min-width: 921px)').matches;
    v.src = wide ? '/marca/escena-1080.mp4' : '/marca/escena-720.mp4';
    let hold: ReturnType<typeof setTimeout> | undefined;
    let restart: ReturnType<typeof setTimeout> | undefined;
    const onEnded = () => {
      hold = setTimeout(() => {
        setVeil(true);
        restart = setTimeout(() => {
          v.currentTime = 0;
          v.play().catch(() => undefined);
          setVeil(false);
        }, FADE_MS);
      }, HOLD_MS);
    };
    v.addEventListener('ended', onEnded);
    v.play().catch(() => undefined);
    return () => {
      v.removeEventListener('ended', onEnded);
      clearTimeout(hold);
      clearTimeout(restart);
    };
  }, []);

  return (
    <div className={`hv${still ? ' hv--still' : ''}`} aria-hidden="true">
      <video ref={ref} muted playsInline preload="auto" poster="/marca/escena-inicio.jpg" disablePictureInPicture tabIndex={-1} />
      <div className="hv__shade" />
      <div className={`hv__veil${veil ? ' on' : ''}`} />
    </div>
  );
}
