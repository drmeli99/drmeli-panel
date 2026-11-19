import { NextResponse } from 'next/server';
import { comision } from '@/lib/sync';
import { meliOpt, SITE } from '@/lib/meli';

/** Comisión de MeLi para precio/categoría, o predicción de categoría por título. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  if (q.get('titulo')) {
    const r = await meliOpt(null, `/sites/${SITE}/domain_discovery/search?limit=3&q=${encodeURIComponent(q.get('titulo')!)}`);
    return NextResponse.json({ categorias: (r || []).map((x: any) => ({ id: x.category_id, nombre: x.category_name })) });
  }
  const precio = Number(q.get('precio')), cat = q.get('categoria') || '';
  if (!precio || !cat) return NextResponse.json({ error: 'Falta precio o categoría' }, { status: 400 });
  const [clasica, premium] = await Promise.all([comision(precio, 'gold_special', cat), comision(precio, 'gold_pro', cat)]);
  return NextResponse.json({ clasica, premium });
}
