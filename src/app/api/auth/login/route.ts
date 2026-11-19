import { NextResponse } from 'next/server';
import { igualSeguro } from '@/lib/cripto';
import { COOKIE, crearSesion } from '@/lib/sesion';

export async function POST(req: Request) {
  const form = await req.formData();
  const clave = String(form.get('clave') || '');
  const volver = String(form.get('volver') || '/');
  const destino = volver.startsWith('/') && !volver.startsWith('//') ? volver : '/';
  const base = new URL(req.url);
  if (!process.env.APP_PASSWORD || !igualSeguro(clave, process.env.APP_PASSWORD)) {
    await new Promise((r) => setTimeout(r, 800));
    return NextResponse.redirect(new URL(`/login?error=1&volver=${encodeURIComponent(destino)}`, base), 303);
  }
  const res = NextResponse.redirect(new URL(destino, base), 303);
  res.cookies.set(COOKIE, await crearSesion(), { httpOnly: true, secure: base.protocol === 'https:', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 });
  return res;
}
