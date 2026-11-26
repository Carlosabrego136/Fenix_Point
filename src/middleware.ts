import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE = 'fp_session';

/**
 * Primera barrera del panel: sin cookie de sesión no se llega a ninguna ruta de /panel (salvo el login).
 * La validación real (firma, expiración, usuario activo, permisos) ocurre en el servidor en cada página y acción.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLogin = pathname === '/panel/login';
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (!isLogin && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = '/panel/login';
    url.search = '';
    return NextResponse.redirect(url);
  }

  const response = NextResponse.next();
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  return response;
}

export const config = { matcher: ['/panel', '/panel/:path*'] };
