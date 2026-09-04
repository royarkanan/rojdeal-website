import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/ar', request.url));
  }
  const response=NextResponse.next();
  if(/^\/(ar|ku|de|en)\/(admin|account|auth|messages|notifications|favorites|my-listings)(\/|$)/.test(pathname) || /\/listings\/(new|[^/]+\/edit)$/.test(pathname))response.headers.set('X-Robots-Tag','noindex, nofollow');
  response.headers.set('X-Content-Type-Options','nosniff');
  response.headers.set('Referrer-Policy','strict-origin-when-cross-origin');
  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
