import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE, sesionValida } from '@/lib/sesion';

const PUBLICAS = ['/login', '/api/auth/login', '/api/cron/'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLICAS.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (await sesionValida(req.cookies.get(COOKIE)?.value)) return NextResponse.next();
  if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = pathname !== '/' ? `?volver=${encodeURIComponent(pathname)}` : '';
  return NextResponse.redirect(url);
}

export const config = { matcher: ['/((?!_next/|favicon|icon).*)'] };
