import type { SVGProps } from 'react';

const PATHS = {
  clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  inbox: 'M3 13h5l1.5 3h5L16 13h5M5 5h14l2 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6l2-8Z',
  box: 'M21 8 12 3 3 8m18 0v8l-9 5m9-13-9 5m0 8-9-5V8m9 5v8M7.5 5.5l9 5',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  checkcircle: 'M9 12.5l2.2 2.2L15.5 10M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  printer: 'M7 9V4h10v5M7 17H5a1 1 0 0 1-1-1v-5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5a1 1 0 0 1-1 1h-2M7 14h10v6H7v-6Z',
  search: 'm20 20-3.5-3.5M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z',
  alert: 'M12 8v5m0 3.5h.01M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  logout: 'M15 17l5-5-5-5M20 12H9m4 8H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7',
  chart: 'M4 20V10m6 10V4m6 16v-7m5 7H3',
  calc: 'M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm2 4h6M9 12h.01M12 12h.01M15 12h.01M9 16h.01M12 16h.01M15 16h.01',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2-1.2L14.5 3h-4l-.4 2.6a7.6 7.6 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7.6 7.6 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z',
  qr: 'M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h2v2h-2v-2Zm4 0h2v2h-2v-2Zm-4 4h2v2h-2v-2Zm4 0h2v2h-2v-2Z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 8a8 8 0 0 1 16 0',
  download: 'M12 4v11m0 0 4-4m-4 4-4-4M5 20h14',
  whatsapp: 'M21 12a9 9 0 0 1-13.300 7.800L3 21l1.300-4.500A9 9 0 1 1 21 12Zm-6.500 2.500c-2-.5-4-2.500-4.500-4.500',
  pin: 'M12 21s7-6.2 7-11.5a7 7 0 1 0-14 0C5 14.800 12 21 12 21Zm0-8.500a2.500 2.500 0 1 0 0-5 2.500 2.500 0 0 0 0 5Z',
  arrow: 'M5 12h14m-5-5 5 5-5 5',
  arrowleft: 'M19 12H5m5-5-5 5 5 5',
  plus: 'M12 5v14M5 12h14',
  edit: 'M4 20h4L19 9a2.800 2.800 0 0 0-4-4L4 16v4Z',
  trash: 'M5 7h14M10 11v6m4-6v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3m-11 0h12v9H6v-9Z',
  tag: 'M3 12V4h8l10 10-8 8L3 12Zm5-4h.01',
  scale: 'M12 4v16m-6 0h12M5 8h14M5 8l-3 7a3.500 3.500 0 0 0 6 0L5 8Zm14 0-3 7a3.500 3.500 0 0 0 6 0l-3-7Z',
  phone: 'M5 4h4l2 5-2.500 1.500a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18, ...rest }: { name: IconName; size?: number } & Omit<SVGProps<SVGSVGElement>, 'name'>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <path d={PATHS[name]} />
    </svg>
  );
}
