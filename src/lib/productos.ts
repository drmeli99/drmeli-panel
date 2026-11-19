import { db } from './db';
import { getConfig } from './config';
import { mapaCostos } from './ventas';

export type Producto = {
  itemId: string; cuentaId: string; cuenta: string; titulo: string; precio: number; stock: number; vendidos: number;
  estado: string; sku: string; permalink: string; thumbnail: string; tipo: string; catalogo: boolean; variaciones: boolean;
  logistica: string; envioGratis: boolean; categoria: string;
  comisionPct: number | null; comisionFija: number; envio: number; costo: number | null; claveCosto: string;
  ganancia: number | null; margen: number | null; ventas30: number;
};

export async function productos(f: { t?: string; q?: string; estado?: string } = {}): Promise<Producto[]> {
  const sql = await db();
  const cfg = await getConfig();
  const imp = Number(cfg.IMPUESTOS_PCT || 0) / 100;
  const costos = await mapaCostos();
  const q = f.q ? `%${f.q.toLowerCase()}%` : null;
  const rows = await sql`
    select i.*, c.nickname,
      coalesce(e.envio, 0) as envio_prom, coalesce(e.unidades, 0) as ventas30
    from items i join cuentas c on c.user_id = i.cuenta_id
    left join lateral (
      select avg(v.envio_costo / greatest(v.cantidad, 1)) as envio, sum(v.cantidad) filter (where v.fecha > now() - interval '30 days') as unidades
      from ventas v where v.detalle->0->>0 = i.item_id and v.fecha > now() - interval '60 days' and v.estado <> 'cancelled'
    ) e on true
    where i.estado <> 'inactiva'
      ${f.t ? sql`and i.cuenta_id = ${f.t}` : sql``}
      ${f.estado ? sql`and i.estado = ${f.estado}` : sql``}
      ${q ? sql`and (lower(i.titulo) like ${q} or lower(i.sku) like ${q} or lower(i.item_id) like ${q})` : sql``}
    order by ventas30 desc nulls last, i.vendidos desc
    limit 1000`;
  return rows.map((r) => {
    const precio = Number(r.precio), pctC = r.comision_pct != null ? Number(r.comision_pct) : null;
    const costo = costos.get(r.sku) ?? costos.get(r.item_id) ?? null;
    const envio = Number(r.envio_prom || 0);
    const ganancia = pctC != null && costo != null ? precio - precio * pctC - Number(r.comision_fija || 0) - envio - costo - precio * imp : null;
    return {
      itemId: r.item_id, cuentaId: r.cuenta_id, cuenta: r.nickname, titulo: r.titulo, precio, stock: Number(r.stock), vendidos: Number(r.vendidos),
      estado: r.estado, sku: r.sku || '', permalink: r.permalink, thumbnail: r.thumbnail, tipo: r.listing_type, catalogo: r.catalog_listing,
      variaciones: r.tiene_variaciones, logistica: r.logistica, envioGratis: r.envio_gratis, categoria: r.category_id,
      comisionPct: pctC, comisionFija: Number(r.comision_fija || 0), envio, costo, claveCosto: r.sku || r.item_id,
      ganancia, margen: ganancia != null && precio ? ganancia / precio : null, ventas30: Number(r.ventas30 || 0),
    };
  });
}
