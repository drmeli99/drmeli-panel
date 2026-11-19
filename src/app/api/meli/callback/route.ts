import { NextResponse, after } from 'next/server';
import { cookies } from 'next/headers';
import { conectarCuenta } from '@/lib/meli';
import { correrRapido, correrLento } from '@/lib/cron';

export const maxDuration = 60;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const jar = await cookies();
  const esperado = jar.get('meli_state')?.value;
  const volver = (q: string) => NextResponse.redirect(new URL(`/configuracion?${q}`, url), 303);
  if (!code) return volver('error=' + encodeURIComponent(url.searchParams.get('error_description') || 'MercadoLibre no devolvió el código'));
  if (!esperado || state !== esperado) return volver('error=' + encodeURIComponent('La conexión venció. Probá de nuevo.'));
  try {
    const c = await conectarCuenta(code);
    after(async () => { await correrLento(50_000).catch(console.error); await correrRapido().catch(console.error); });
    const res = volver('conectada=' + encodeURIComponent(c.nickname));
    res.cookies.delete('meli_state');
    return res;
  } catch (e) {
    return volver('error=' + encodeURIComponent((e as Error).message));
  }
}
