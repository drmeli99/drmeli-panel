import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { linkAutorizacion } from '@/lib/meli';

export async function GET() {
  if (!process.env.MELI_CLIENT_ID || !process.env.MELI_CLIENT_SECRET) {
    return NextResponse.json({ error: 'Faltan MELI_CLIENT_ID y MELI_CLIENT_SECRET en las variables de entorno de Vercel.' }, { status: 400 });
  }
  const state = crypto.randomBytes(16).toString('hex');
  const res = NextResponse.redirect(linkAutorizacion(state));
  res.cookies.set('meli_state', state, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 600, secure: true });
  return res;
}
