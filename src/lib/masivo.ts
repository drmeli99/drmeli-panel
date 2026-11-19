/** Acciones masivas sobre publicaciones: precio, stock, pausar/activar y clonar a otra tienda. */
import { db } from './db';
import { cuenta, meli, MeliError } from './meli';

export type Cambio = { itemId: string; cuentaId: string; precio?: number; stock?: number; estado?: 'active' | 'paused' };
export type Resultado = { itemId: string; ok: boolean; detalle: string; nuevoId?: string };

async function registrar(tipo: string, r: Resultado, cuentaId: string) {
  const sql = await db();
  await sql`insert into acciones_masivas (tipo, item_id, cuenta_id, ok, detalle) values (${tipo}, ${r.itemId}, ${cuentaId}, ${r.ok}, ${r.detalle})`;
}

export async function aplicarCambio(cb: Cambio): Promise<Resultado> {
  const sql = await db();
  const c = await cuenta(cb.cuentaId);
  const body: Record<string, unknown> = {};
  const partes: string[] = [];
  if (cb.precio != null) { body.price = Math.round(cb.precio * 100) / 100; partes.push(`precio $${body.price}`); }
  if (cb.estado) { body.status = cb.estado; partes.push(cb.estado === 'paused' ? 'pausada' : 'activada'); }
  let r: Resultado;
  try {
    if (cb.stock != null) {
      const it = await meli(c, `/items/${cb.itemId}?attributes=variations`);
      if ((it.variations || []).length) throw new Error('Tiene variantes: cambiá el stock de cada variante desde MeLi');
      body.available_quantity = Math.max(0, Math.round(cb.stock));
      partes.push(`stock ${body.available_quantity}`);
    }
    if (!Object.keys(body).length) throw new Error('Nada para cambiar');
    await meli(c, `/items/${cb.itemId}`, { method: 'PUT', body });
    await sql`update items set precio = coalesce(${(body.price as number) ?? null}, precio), stock = coalesce(${(body.available_quantity as number) ?? null}, stock),
      estado = coalesce(${(body.status as string) ?? null}, estado) where item_id = ${cb.itemId}`;
    r = { itemId: cb.itemId, ok: true, detalle: partes.join(', ') };
  } catch (e) {
    r = { itemId: cb.itemId, ok: false, detalle: (e as Error).message };
  }
  await registrar('editar', r, cb.cuentaId);
  return r;
}

export type Clonado = { itemId: string; origenId: string; destinoId: string; ajustePct?: number; stock?: number; tipo?: string; titulo?: string };

/** Copia una publicación de una tienda a otra (fotos, atributos, descripción). */
export async function clonar(op: Clonado): Promise<Resultado> {
  const origen = await cuenta(op.origenId);
  const destino = await cuenta(op.destinoId);
  let r: Resultado;
  try {
    const it = await meli(origen, `/items/${op.itemId}`);
    if (it.catalog_listing) throw new Error('Es una publicación de catálogo: cloná la publicación tradicional original');
    const desc = await meli(origen, `/items/${op.itemId}/description`).catch(() => null);
    const precio = Math.round(Number(it.price) * (1 + (op.ajustePct || 0) / 100));
    const atributos = (it.attributes || [])
      .filter((a: any) => !['SELLER_SKU', 'ITEM_CONDITION'].includes(a.id) && (a.value_id || a.value_name))
      .map((a: any) => (a.value_id ? { id: a.id, value_id: a.value_id } : { id: a.id, value_name: a.value_name }));
    const sku = it.seller_custom_field || (it.attributes || []).find((a: any) => a.id === 'SELLER_SKU')?.value_name;
    if (sku) atributos.push({ id: 'SELLER_SKU', value_name: sku });
    const variaciones = (it.variations || []).map((v: any) => ({
      price: precio, available_quantity: op.stock ?? v.available_quantity,
      attribute_combinations: (v.attribute_combinations || []).map((a: any) => (a.value_id ? { id: a.id, value_id: a.value_id } : { id: a.id, value_name: a.value_name })),
      ...(v.picture_ids?.length ? { picture_ids: v.picture_ids.map((pid: string) => (it.pictures || []).find((p: any) => p.id === pid)?.secure_url).filter(Boolean) } : {}),
    }));
    const titulo = op.titulo || it.title;
    const payload: Record<string, unknown> = {
      title: titulo,
      category_id: it.category_id,
      price: precio,
      currency_id: it.currency_id,
      available_quantity: op.stock ?? it.available_quantity,
      buying_mode: it.buying_mode,
      condition: it.condition,
      listing_type_id: op.tipo || it.listing_type_id,
      pictures: (it.pictures || []).map((p: any) => ({ source: p.secure_url || p.url })),
      attributes: atributos,
      sale_terms: (it.sale_terms || []).map((s: any) => (s.value_id ? { id: s.id, value_id: s.value_id } : { id: s.id, value_name: s.value_name })),
      shipping: { mode: it.shipping?.mode || 'me2', free_shipping: !!it.shipping?.free_shipping, local_pick_up: !!it.shipping?.local_pick_up },
      ...(variaciones.length ? { variations: variaciones } : {}),
    };
    let nuevo: any;
    try {
      nuevo = await meli(destino, '/items', { method: 'POST', body: payload });
    } catch (e) {
      // Categorías con "User Products" piden family_name en lugar de title
      if (e instanceof MeliError && JSON.stringify(e.body || '').includes('family_name')) {
        const { title, ...resto } = payload;
        nuevo = await meli(destino, '/items', { method: 'POST', body: { ...resto, family_name: title } });
      } else throw e;
    }
    if (desc?.plain_text) await meli(destino, `/items/${nuevo.id}/description`, { method: 'POST', body: { plain_text: desc.plain_text } }).catch(() => null);
    r = { itemId: op.itemId, ok: true, detalle: `Publicada en ${destino.nickname} a $${precio}`, nuevoId: nuevo.id };
  } catch (e) {
    r = { itemId: op.itemId, ok: false, detalle: (e as Error).message };
  }
  await registrar('clonar', r, op.destinoId);
  return r;
}
