'use client';

import { useState } from 'react';
import { Icon } from '@/components/Icon';

const OUT_W = 2480; // A4 a 300 dpi
const OUT_H = 3508;

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function PosterDownloads({ posterId, qrSvg }: { posterId: string; qrSvg: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function downloadPng() {
    setBusy(true);
    setError('');
    try {
      const el = document.getElementById(posterId)?.querySelector('svg');
      if (!el) throw new Error('No se encontró el cartel.');
      const xml = new XMLSerializer().serializeToString(el);
      const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
      const img = new Image();
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error('No se pudo preparar la imagen.'));
        img.src = url;
      });
      const canvas = document.createElement('canvas');
      canvas.width = OUT_W;
      canvas.height = OUT_H;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Su navegador no permite crear la imagen.');
      // Se dibuja dos veces: la primera deja cargar las fuentes incrustadas en algunos navegadores.
      ctx.drawImage(img, 0, 0, OUT_W, OUT_H);
      await wait(250);
      ctx.clearRect(0, 0, OUT_W, OUT_H);
      ctx.drawImage(img, 0, 0, OUT_W, OUT_H);
      URL.revokeObjectURL(url);
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
      if (!blob) throw new Error('No se pudo crear el archivo.');
      save(blob, 'fenix-point-cartel-qr.png');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo descargar.');
    } finally {
      setBusy(false);
    }
  }

  function downloadQr() {
    save(new Blob([qrSvg], { type: 'image/svg+xml;charset=utf-8' }), 'fenix-point-qr.svg');
  }

  return (
    <>
      <button type="button" className="btn btn--primary" onClick={downloadPng} disabled={busy}>
        <Icon name="download" size={18} /> {busy ? 'Preparando…' : 'Descargar cartel (PNG)'}
      </button>
      <button type="button" className="btn btn--ghost" onClick={downloadQr}>
        Descargar solo el QR (SVG)
      </button>
      {error && <span className="alert alert--error" role="alert" style={{ width: '100%' }}>{error}</span>}
    </>
  );
}
