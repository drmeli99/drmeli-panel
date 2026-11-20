/**
 * Cliente de la API de MercadoLibre: OAuth multi-cuenta + llamadas con reintentos.
 * Todos los endpoints de MercadoLibre que usa la app pasan por acá.
 */
import { db } from './db';
import { cifrar, descifrar } from './cripto';
import { appUrl } from './entorno';

export const MELI_API = process.env.MELI_API_BASE || 'https://api.mercadolibre.com';
const MELI_AUTH = process.env.MELI_AUTH_BASE || 'https://auth.mercadolibre.com.ar/authorization';
export const SITE = 'MLA';

export type Cuenta = {
  user_id: string;
  nickname: string;
  access_token: string;
  refresh_token: string;
  expira: Date;
};

export class MeliError extends Error {
  constructor(public status: number, public path: string, public body: unknown) {
    super(`MercadoLibre ${status} en ${path.split('?')[0]}: ${resumenError(body)}`);
  }
}

function resumenError(b: unknown): string {
  if (!b || typeof b !== 'object') return String(b ?? '').slice(0, 200);
  const o = b as Record<string, unknown>;
  const causa = Array.isArray(o.cause) ? o.cause.map((c: Record<string, unknown>) => c.message || c.code).join('; ') : '';
  return [o.message, o.error, causa].filter(Boolean).join(' · ').slice(0, 300);
}

export function redirectUri() {
  return `${appUrl()}/api/meli/callback`;
}

export function linkAutorizacion(state: string) {
  const id = process.env.MELI_CLIENT_ID || '';
  return `${MELI_AUTH}?response_type=code&client_id=${encodeURIComponent(id)}&redirect_uri=${encodeURIComponent(redirectUri())}&state=${encodeURIComponent(state)}`;
}

async function postToken(payload: Record<string, string>) {
  const res = await fetch(`${MELI_API}/oauth/token`, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(payload),
    cache: 'no-store',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new MeliError(res.status, '/oauth/token', body);
  return body as { access_token: string; refresh_token: string; expires_in: number; user_id: number };
}

/** Canjea el ?code= de la vuelta del login por tokens y guarda la tienda. */
export async function conectarCuenta(code: string) {
  const tok = await postToken({
    grant_type: 'authorization_code',
    client_id: process.env.MELI_CLIENT_ID || '',
    client_secret: process.env.MELI_CLIENT_SECRET || '',
    code,
    redirect_uri: redirectUri(),
  });
  const me = await fetch(`${MELI_API}/users/me`, { headers: { Authorization: `Bearer ${tok.access_token}` }, cache: 'no-store' }).then((r) => r.json());
  const cuenta: Cuenta = {
    user_id: String(me.id),
    nickname: me.nickname,
    access_token: tok.access_token,
    refresh_token: tok.refresh_token,
    expira: new Date(Date.now() + (tok.expires_in - 300) * 1000),
  };
  await guardarCuenta(cuenta, true);
  return cuenta;
}

async function guardarCuenta(c: Cuenta, nueva = false) {
  const sql = await db();
  const tokens = cifrar(JSON.stringify({ a: c.access_token, r: c.refresh_token }));
  if (nueva) {
    await sql`insert into cuentas (user_id, nickname, tokens, expira, error) values (${c.user_id}, ${c.nickname}, ${tokens}, ${c.expira}, '')
      on conflict (user_id) do update set nickname = excluded.nickname, tokens = excluded.tokens, expira = excluded.expira, error = ''`;
  } else {
    await sql`update cuentas set tokens = ${tokens}, expira = ${c.expira} where user_id = ${c.user_id}`;
  }
}

export async function cuentas(): Promise<Cuenta[]> {
  const sql = await db();
  const rows = await sql`select user_id, nickname, tokens, expira from cuentas order by nickname`;
  return rows.map((r) => {
    const t = JSON.parse(descifrar(r.tokens));
    return { user_id: r.user_id, nickname: r.nickname, access_token: t.a, refresh_token: t.r, expira: new Date(r.expira) };
  });
}

export async function cuenta(userId: string) {
  const c = (await cuentas()).find((x) => x.user_id === userId);
  if (!c) throw new Error('Tienda no conectada: ' + userId);
  return c;
}

// Evita renovar dos veces el mismo token a la vez dentro de una ejecución
const renovando = new Map<string, Promise<void>>();

async function renovar(c: Cuenta) {
  if (!renovando.has(c.user_id)) {
    renovando.set(c.user_id, (async () => {
      // Releer por si otra ejecución ya lo renovó (el refresh_token se usa una sola vez)
      const fresca = (await cuentas()).find((x) => x.user_id === c.user_id);
      if (fresca && fresca.expira.getTime() > Date.now() && fresca.access_token !== c.access_token) {
        Object.assign(c, fresca);
        return;
      }
      const tok = await postToken({
        grant_type: 'refresh_token',
        client_id: process.env.MELI_CLIENT_ID || '',
        client_secret: process.env.MELI_CLIENT_SECRET || '',
        refresh_token: (fresca || c).refresh_token,
      });
      c.access_token = tok.access_token;
      c.refresh_token = tok.refresh_token || c.refresh_token;
      c.expira = new Date(Date.now() + (tok.expires_in - 300) * 1000);
      await guardarCuenta(c);
    })().finally(() => renovando.delete(c.user_id)));
  }
  await renovando.get(c.user_id);
}

type Opciones = { method?: string; body?: unknown; headers?: Record<string, string> };

/** Llamada autenticada. Renueva el token si venció y reintenta en 429/5xx. */
export async function meli<T = any>(c: Cuenta | null, path: string, op: Opciones = {}): Promise<T> {
  if (c && c.expira.getTime() < Date.now()) await renovar(c);
  for (let intento = 0; intento < 4; intento++) {
    const headers: Record<string, string> = { accept: 'application/json', ...(op.headers || {}) };
    if (c) headers.Authorization = `Bearer ${c.access_token}`;
    if (op.body !== undefined) headers['content-type'] = 'application/json';
    const res = await fetch(MELI_API + path, {
      method: op.method || 'GET',
      headers,
      body: op.body !== undefined ? JSON.stringify(op.body) : undefined,
      cache: 'no-store',
    });
    if (res.ok) {
      const txt = await res.text();
      return (txt ? JSON.parse(txt) : null) as T;
    }
    if (res.status === 401 && c && intento === 0) { await renovar(c); continue; }
    if ((res.status === 429 || res.status >= 500) && intento < 3) { await new Promise((r) => setTimeout(r, 800 * (intento + 1))); continue; }
    throw new MeliError(res.status, path, await res.json().catch(() => null));
  }
  throw new MeliError(0, path, 'sin respuesta');
}

/** Igual que meli() pero devuelve null si falla. */
export async function meliOpt<T = any>(c: Cuenta | null, path: string, op: Opciones = {}): Promise<T | null> {
  try { return await meli<T>(c, path, op); } catch { return null; }
}

/** Ejecuta tareas en paralelo con un límite de concurrencia. */
export async function enParalelo<A, R>(lista: A[], limite: number, fn: (a: A, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(lista.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limite, lista.length) }, async () => {
    while (i < lista.length) { const k = i++; out[k] = await fn(lista[k], k); }
  }));
  return out;
}

/** Multiget de publicaciones (de a 20). */
export async function itemsMultiget(c: Cuenta | null, ids: string[], atributos?: string) {
  const lotes: string[][] = [];
  for (let i = 0; i < ids.length; i += 20) lotes.push(ids.slice(i, i + 20));
  const res = await enParalelo(lotes, 5, (l) =>
    meliOpt<{ code: number; body: any }[]>(c, `/items?ids=${l.join(',')}${atributos ? '&attributes=' + atributos : ''}`));
  return res.flat().filter((x) => x && x.code === 200).map((x) => x!.body);
}

/** Saca el ID MLA de una URL o texto ("MLA-123", "https://articulo.../MLA-123-...") */
export function extraerItemId(txt: string): string | null {
  const m = String(txt).toUpperCase().match(/MLA-?(\d{6,})/);
  return m ? 'MLA' + m[1] : null;
}

export const ventaLink = (orderId: string) => `https://www.mercadolibre.com.ar/ventas/${orderId}/detalle`;
