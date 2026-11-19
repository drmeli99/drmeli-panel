/**
 * Competencia: estado en catálogo (price_to_win), vigilancia de publicaciones y sellers.
 */
import { db, setEstado, getEstado } from './db';
import { cuentas, meli, meliOpt, enParalelo, SITE, type Cuenta } from './meli';
import { esc, corto } from './alertas';
import { plata } from './tiempo';

export const TIPO_PUB: Record<string, string> = { gold_pro: 'Premium (cuotas)', gold_special: 'Clásica', gold: 'Oro', free: 'Gratuita' };

export type Oferta = {
  itemId: string; sellerId: string; seller?: string; precio: number; tipo: string;
  envioGratis: boolean; full: boolean; mio: boolean;
};
export type EstadoCatalogo = {
  itemId: string; cuentaId: string; cuenta: string; titulo: string; productId: string;
  miPrecio: number; tipo: string; estado: string; precioParaGanar: number | null;
  ganador: { itemId: string; precio: number | null } | null; motivos: string[]; ofertas: Oferta[];
  actualizado: string;
};

const ESTADOS: Record<string, string> = {
  winning: 'Ganando', sharing_first_place: 'Compartiendo 1°', competing: 'Perdiendo', listed: 'Sin competir',
};
export const estadoTexto = (s: string) => ESTADOS[s] || s || 'Sin datos';

/** Estado de una publicación de catálogo propia y las ofertas que compiten. */
export async function estadoCatalogo(c: Cuenta, item: { item_id: string; titulo: string; precio: number; listing_type: string; catalog_product_id: string }): Promise<EstadoCatalogo> {
  const p = await meliOpt(c, `/items/${item.item_id}/price_to_win?siteId=${SITE}&version=v2`);
  const ofertasRaw = await meliOpt(c, `/products/${item.catalog_product_id}/items?limit=20`);
  const misIds = new Set<string>();
  const ofertas: Oferta[] = ((ofertasRaw?.results as any[]) || []).map((o) => {
    const mio = String(o.seller_id) === c.user_id;
    if (mio) misIds.add(o.item_id);
    return {
      itemId: o.item_id, sellerId: String(o.seller_id), precio: Number(o.price), tipo: o.listing_type_id || '',
      envioGratis: !!o.shipping?.free_shipping, full: o.shipping?.logistic_type === 'fulfillment', mio,
    };
  }).sort((a, b) => a.precio - b.precio);
  return {
    itemId: item.item_id, cuentaId: c.user_id, cuenta: c.nickname, titulo: item.titulo, productId: item.catalog_product_id,
    miPrecio: Number(p?.current_price ?? item.precio), tipo: item.listing_type,
    estado: p?.status || (ofertas.length ? '' : 'listed'),
    precioParaGanar: p?.price_to_win != null ? Number(p.price_to_win) : null,
    ganador: p?.winner ? { itemId: p.winner.item_id, precio: p.winner.price != null ? Number(p.winner.price) : null } : null,
    motivos: ([] as string[]).concat(p?.reason || []).map(String),
    ofertas, actualizado: new Date().toISOString(),
  };
}

/** Recorre todas mis publicaciones de catálogo (lento). Devuelve alertas de cambios. */
export async function syncCompetencia() {
  const sql = await db();
  const lista = await cuentas();
  const previo = new Map(((await getEstado<EstadoCatalogo[]>('competencia'))?.datos || []).map((x) => [x.itemId, x]));
  const out: EstadoCatalogo[] = [];
  for (const c of lista) {
    const items = await sql`select item_id, titulo, precio, listing_type, catalog_product_id from items
      where cuenta_id = ${c.user_id} and estado = 'active' and catalog_listing = true and catalog_product_id is not null
      order by vendidos desc limit 120`;
    out.push(...(await enParalelo(items as any[], 6, (it) => estadoCatalogo(c, it))));
  }
  await setEstado('competencia', out);

  const alertas: { texto: string; clave: string }[] = [];
  for (const x of out) {
    const antes = previo.get(x.itemId);
    if (antes && (antes.estado === 'winning' || antes.estado === 'sharing_first_place') && x.estado === 'competing') {
      alertas.push({
        clave: `perdio:${x.itemId}:${x.actualizado.slice(0, 13)}`,
        texto: `• <b>${esc(x.cuenta)}</b> — ${esc(corto(x.titulo, 50))}: perdiste el 1° lugar.` +
          (x.precioParaGanar ? ` Precio para ganar: <b>${plata(x.precioParaGanar)}</b> (tenés ${plata(x.miPrecio)})` : ''),
      });
    }
  }
  return alertas;
}

/** Vigilancia: publicaciones propias o ajenas que el usuario marcó. */
export async function syncVigilancia() {
  const sql = await db();
  const lista = await cuentas();
  const c0 = lista[0] || null;
  const vig = await sql`select id, tipo, item_id, cuenta_id, ultimo from vigilancia order by id`;
  const alertas: { texto: string; clave: string }[] = [];
  await enParalelo(vig as any[], 5, async (v) => {
    const c = lista.find((x) => x.user_id === v.cuenta_id) || c0;
    const it = await meliOpt(c, `/items/${v.item_id}`);
    if (!it) return;
    let datos: any = {
      titulo: it.title, precio: Number(it.price), precioOriginal: it.original_price ? Number(it.original_price) : null,
      estado: it.status, sellerId: String(it.seller_id), tipo: it.listing_type_id, envioGratis: !!it.shipping?.free_shipping,
      full: it.shipping?.logistic_type === 'fulfillment', vendidos: it.sold_quantity ?? null, stock: it.available_quantity ?? null,
      permalink: it.permalink, thumbnail: String(it.thumbnail || '').replace('http://', 'https://'),
      catalogo: it.catalog_product_id || null,
    };
    if (v.tipo === 'mio' && it.catalog_listing && it.catalog_product_id && c) {
      const e = await estadoCatalogo(c, { item_id: it.id, titulo: it.title, precio: it.price, listing_type: it.listing_type_id, catalog_product_id: it.catalog_product_id });
      datos = { ...datos, estadoCatalogo: e.estado, precioParaGanar: e.precioParaGanar, ofertas: e.ofertas.slice(0, 8) };
    }
    const u = v.ultimo || {};
    if (u.precio != null && u.precio !== datos.precio) {
      await sql`insert into vigilancia_hist (vigilancia_id, precio, datos) values (${v.id}, ${datos.precio}, ${sql.json({ antes: u.precio })})`;
      if (v.tipo === 'externo') alertas.push({
        clave: `vig:${v.item_id}:${datos.precio}`,
        texto: `• ${esc(corto(datos.titulo, 50))}: ${datos.precio < u.precio ? '⬇️ bajó' : '⬆️ subió'} de ${plata(u.precio)} a <b>${plata(datos.precio)}</b>`,
      });
    } else if (u.precio == null) {
      await sql`insert into vigilancia_hist (vigilancia_id, precio, datos) values (${v.id}, ${datos.precio}, ${sql.json({})})`;
    }
    if (v.tipo === 'mio' && u.estadoCatalogo === 'winning' && datos.estadoCatalogo === 'competing') {
      alertas.push({ clave: `vigperdio:${v.item_id}:${new Date().toISOString().slice(0, 13)}`, texto: `• ${esc(corto(datos.titulo, 50))}: perdiste el 1° lugar del catálogo` });
    }
    await sql`update vigilancia set ultimo = ${sql.json(datos)} where id = ${v.id}`;
  });

  // Sellers competidores
  const comps = await sql`select seller_id, ultimo from competidores`;
  await enParalelo(comps as any[], 3, async (s) => {
    const u = await meliOpt(c0, `/users/${s.seller_id}`);
    const busq = await meliOpt(c0, `/sites/${SITE}/search?seller_id=${s.seller_id}&limit=50`);
    const pubs = ((busq?.results as any[]) || []).map((r) => ({
      id: r.id, titulo: r.title, precio: Number(r.price), vendidos: r.sold_quantity ?? null, tipo: r.listing_type_id,
      envioGratis: !!r.shipping?.free_shipping, full: r.shipping?.logistic_type === 'fulfillment', link: r.permalink,
    }));
    const antes = new Map(((s.ultimo?.publicaciones as any[]) || []).map((p) => [p.id, p.precio]));
    const cambios = pubs.filter((p) => antes.has(p.id) && antes.get(p.id) !== p.precio);
    if (cambios.length) alertas.push({
      clave: `seller:${s.seller_id}:${cambios.map((x) => x.id + x.precio).join(',').slice(0, 80)}`,
      texto: `• Seller <b>${esc(u?.nickname || s.seller_id)}</b> cambió ${cambios.length} precio${cambios.length > 1 ? 's' : ''}: ` +
        cambios.slice(0, 3).map((p) => `${esc(corto(p.titulo, 30))} ${plata(antes.get(p.id))}→${plata(p.precio)}`).join('; '),
    });
    const datos = {
      nickname: u?.nickname || s.ultimo?.nickname || '', reputacion: u?.seller_reputation?.level_id || '',
      medalla: u?.seller_reputation?.power_seller_status || '', ventas: u?.seller_reputation?.transactions?.completed ?? null,
      totalPublicaciones: busq?.paging?.total ?? null, publicaciones: pubs.length ? pubs : s.ultimo?.publicaciones || [],
      error: busq ? '' : 'MercadoLibre no devolvió las publicaciones de este seller',
    };
    await sql`update competidores set ultimo = ${sql.json(datos)}, nickname = ${datos.nickname} where seller_id = ${s.seller_id}`;
  });
  return alertas;
}

/** Resuelve "nickname", ID numérico o link de un seller a su ID. */
export async function resolverSeller(txt: string): Promise<{ id: string; nickname: string } | null> {
  const lista = await cuentas();
  const c0 = lista[0] || null;
  const t = txt.trim();
  if (/^\d+$/.test(t)) {
    const u = await meliOpt(c0, `/users/${t}`);
    return u ? { id: String(u.id), nickname: u.nickname } : null;
  }
  const nick = t.replace(/^https?:\/\/[^/]+\/(perfil|pagina)\//i, '').split(/[/?#]/)[0].replace(/\+/g, ' ');
  const r = await meliOpt(c0, `/sites/${SITE}/search?nickname=${encodeURIComponent(nick)}&limit=1`);
  const s = r?.seller || r?.results?.[0]?.seller;
  return s ? { id: String(s.id), nickname: s.nickname || nick } : null;
}

export { meli };
