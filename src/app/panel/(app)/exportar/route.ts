import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { enviosToCsv, EXPORT_LIMIT, listEnvios, type EnvioFilters, type EnvioStatus } from '@/lib/envios';
import { logger } from '@/lib/logger';
import { can } from '@/lib/permissions';
import { appTimezone } from '@/lib/settings';

export const dynamic = 'force-dynamic';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES: EnvioStatus[] = ['en_espera', 'recibido', 'finalizado', 'cancelado'];

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL('/panel/login', request.url));
  if (!can(user.role, 'envios.manage')) return new NextResponse('Sin permiso', { status: 403 });

  const p = new URL(request.url).searchParams;
  const estado = p.get('estado') ?? '';
  const from = p.get('from') ?? '';
  const to = p.get('to') ?? '';
  const filters: EnvioFilters = {
    q: (p.get('q') ?? '').slice(0, 80),
    statuses: STATUSES.includes(estado as EnvioStatus) ? [estado as EnvioStatus] : undefined,
    from: DATE_RE.test(from) ? from : undefined,
    to: DATE_RE.test(to) ? to : undefined,
    paid: p.get('cobro') === 'si' || p.get('cobro') === 'no' ? (p.get('cobro') as 'si' | 'no') : '',
    branch_id: Number(p.get('punto')) > 0 ? Number(p.get('punto')) : undefined,
  };
  try {
    const tz = await appTimezone();
    const rows = await listEnvios(filters, tz, { limit: EXPORT_LIMIT });
    const stamp = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
    return new NextResponse(enviosToCsv(rows, tz), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="fenix-point-envios-${stamp}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    logger.error('export.failed', err);
    return new NextResponse('No se pudo generar el archivo. Inténtelo de nuevo.', { status: 500 });
  }
}
