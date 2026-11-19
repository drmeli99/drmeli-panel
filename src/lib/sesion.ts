import { SignJWT, jwtVerify } from 'jose';

export const COOKIE = 'panel_sesion';

function key() {
  return new TextEncoder().encode('sesion:' + (process.env.AUTH_SECRET || ''));
}

export async function crearSesion() {
  return new SignJWT({ ok: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(key());
}

export async function sesionValida(token?: string) {
  if (!token || !process.env.AUTH_SECRET) return false;
  try {
    await jwtVerify(token, key());
    return true;
  } catch {
    return false;
  }
}
