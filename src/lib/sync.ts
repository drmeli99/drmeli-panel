/**
 * Sincronización con MercadoLibre.
 *  rapido (cada 5 min): ventas, envíos pendientes, preguntas, reclamos → alertas
 *  lento  (cada 1 h):   publicaciones/stock, reputación, comisiones, competencia, publicidad
 */
import { db, setEstado, getEstado } from './db';
import { cuentas, meli, meliOpt, enParalelo, itemsMultiget, ventaLink, SITE, type Cuenta } from './meli';
import { getConfig, type Config } from './config';
import { fechaAR, minutosAR, diaSemanaAR, inicioDiaISO, hhmm } from './tiempo';
import type { Operacion, Pendiente, Pregunta, Reclamo, Reputacion } from './tipos';

const ENVIO_PENDIENTE = ['handling', 'ready_to_ship'];
const ENVIO_FINAL = ['shipped', 'delivered', 'not_delivered', 'cancelled', 'lost', 'returned'];
export const TIPO_ENVIO: Record<string, string> = {
  self_service: 'Flex', cross_docking: 'Colecta', xd_drop_off: 'Punto de despacho', drop_off: 'Correo',
  fulfillment: 'Full', custom: 'A convenir', not_specified: 'A convenir', default: 'Correo',
};
const MAX_NUEVAS_POR_CORRIDA = 200;

/* ------------------------------------------------------------------ rápido */

export async function sincronizarRapido() {
  const cfg = await getConfig();
  const sql = await db();
  const lista = await cuentas();
  const resultados = await enParalelo(lista, 3, async (c) => {
    const op: Operacion = { pendientes: [], preguntas: [], reclamos: [], actualizado: new Date().toISOString() };
    const errores: string[] = [];
    try { op.pendientes = await syncVentasYEnvios(c, cfg); } catch (e) { errores.push('Ventas: ' + (e as Error).message); }
    try { op.preguntas = await syncPreguntas(c); } catch (e) { errores.push('Preguntas: ' + (e as Error).message); }
    try { op.reclamos = await syncReclamos(c); } catch { /* endpoint de reclamos no crítico */ }
    if (errores.length) {
      // conservar lo último que se pudo leer
      const prev = await getEstado<Operacion>('op:' + c.user_id);
      if (prev && !op.pendientes.length && errores.some((x) => x.startsWith('Ventas'))) op.pendientes = prev.datos.pendientes;
      if (prev && !op.preguntas.length && errores.some((x) => x.startsWith('Preguntas'))) op.preguntas = prev.datos.preguntas;
    }
    op.error = errores.join(' · ');
    await setEstado('op:' + c.user_id, op);
    await sql`update cuentas set error = ${op.error} where user_id = ${c.user_id}`;
    return op;
  });
  return { cuentas: lista.length, pendientes: resultados.reduce((a, r) => a + r.pendientes.length, 0) };
}

async function syncVentasYEnvios(c: Cuenta, cfg: Config): Promise<Pendiente[]> {
  const sql = await db();
  const [{ backfill }] = await sql`select backfill from cuentas where user_id = ${c.user_id}`;
  const desde = inicioDiaISO(backfill ? 5 : 30);

  const ordenes: any[] = [];
  for (let offset = 0; offset < 3000; offset += 50) {
    const r = await meli(c, `/orders/search?seller=${c.user_id}&order.date_created.from=${encodeURIComponent(desde)}&sort=date_desc&limit=50&offset=${offset}`);
    ordenes.push(...(r.results || []));
    if (!r.paging || offset + 50 >= r.paging.total) break;
  }

  const ids = ordenes.map((o) => String(o.id));
  const existentes = ids.length
    ? await sql`select order_id, estado, estado_envio, tipo_envio, shipment_id from ventas where order_id in ${sql(ids)}`
    : [];
  const porOrden = new Map(existentes.map((r) => [r.order_id, r]));
  const envConCosto = new Set(
    ids.length ? (await sql`select distinct shipment_id from ventas where cuenta_id = ${c.user_id} and shipment_id is not null and order_id in ${sql(ids)}`).map((r) => r.shipment_id) : [],
  );

  // Ventas nuevas a registrar en esta corrida (las más nuevas primero, con tope)
  const validas = (o: any) => o.status === 'paid' || o.status === 'partially_refunded';
  const nuevas = ordenes.filter((o) => !porOrden.has(String(o.id)) && validas(o));
  const nuevasAhora = nuevas.slice(0, MAX_NUEVAS_POR_CORRIDA);
  const quedanPendientes = nuevas.length > nuevasAhora.length;
  const setNuevas = new Set(nuevasAhora.map((o) => String(o.id)));

  // Envíos a consultar: los de ventas nuevas de esta corrida + los existentes no finalizados
  const envIds = new Set<string>();
  for (const o of ordenes) {
    const sid = o.shipping?.id ? String(o.shipping.id) : '';
    if (!sid || o.status === 'cancelled' || o.status === 'invalid') continue;
    const ex = porOrden.get(String(o.id));
    if (ex ? !ENVIO_FINAL.includes(ex.estado_envio) : setNuevas.has(String(o.id))) envIds.add(sid);
  }
  const listaEnv = [...envIds];
  const envios = new Map<string, any>();
  (await enParalelo(listaEnv, 10, (id) => meliOpt(c, `/shipments/${id}`))).forEach((s, i) => s && envios.set(listaEnv[i], s));

  const sinCosto = listaEnv.filter((id) => !envConCosto.has(id) && envios.has(id) &&
    ordenes.some((o) => String(o.shipping?.id) === id && setNuevas.has(String(o.id))));
  const costos = new Map<string, number>();
  (await enParalelo(sinCosto, 10, (id) => meliOpt(c, `/shipments/${id}/costs`))).forEach((r, i) => {
    if (r) costos.set(sinCosto[i], (r.senders || []).reduce((a: number, x: any) => a + Number(x.cost || 0), 0));
  });

  const pendientes = new Map<string, Pendiente>();
  const hoy = fechaAR();

  for (const o of [...ordenes].reverse()) {
    const oid = String(o.id);
    const sid = o.shipping?.id ? String(o.shipping.id) : '';
    const s = envios.get(sid);
    const tipoRaw: string = s ? s.logistic_type || s.logistic?.type || '' : '';
    const tipo = TIPO_ENVIO[tipoRaw] || tipoRaw || (sid ? '' : 'Sin envío');
    const items: any[] = o.order_items || [];
    const ex = porOrden.get(oid);

    if (!ex && setNuevas.has(oid)) {
      let costoEnvio = 0;
      if (sid && costos.has(sid) && !envConCosto.has(sid)) { costoEnvio = costos.get(sid)!; envConCosto.add(sid); }
      const comision = items.reduce((a, it) => a + Number(it.sale_fee || 0) * Number(it.quantity || 1), 0);
      const detalle = items.map((it) => [it.item.id, it.item.seller_sku || it.item.seller_custom_field || '', it.quantity]);
      await sql`insert into ventas (order_id, cuenta_id, fecha, estado, producto, cantidad, total, comision, envio_costo, tipo_envio, estado_envio, shipment_id, detalle)
        values (${oid}, ${c.user_id}, ${new Date(o.date_created)}, ${o.status}, ${items.map((it) => it.item.title).join(' + ')},
          ${items.reduce((a, it) => a + Number(it.quantity || 1), 0)}, ${Number(o.total_amount || 0)}, ${Math.round(comision * 100) / 100},
          ${Math.round(costoEnvio * 100) / 100}, ${tipo}, ${s?.status || ''}, ${sid || null}, ${sql.json(detalle)})
        on conflict (order_id) do nothing`;
    } else if (ex) {
      const estadoEnvio = s?.status || ex.estado_envio;
      if (ex.estado !== o.status || ex.estado_envio !== estadoEnvio || (!ex.tipo_envio && tipo)) {
        await sql`update ventas set estado = ${o.status}, estado_envio = ${estadoEnvio}, tipo_envio = coalesce(nullif(tipo_envio, ''), ${tipo}) where order_id = ${oid}`;
      }
    }

    if (s && ENVIO_PENDIENTE.includes(s.status) && o.status === 'paid' && tipoRaw !== 'fulfillment') {
      let p = pendientes.get(sid);
      if (!p) { p = armarPendiente(o, s, tipoRaw, c, cfg, hoy); pendientes.set(sid, p); }
      else p.ordenes.push(oid);
      items.forEach((it) => p!.items.push({ titulo: it.item.title, cant: it.quantity, itemId: it.item.id }));
    }
  }

  if (!backfill && !quedanPendientes) await sql`update cuentas set backfill = true where user_id = ${c.user_id}`;
  return ordenarPendientes([...pendientes.values()]);
}

function armarPendiente(o: any, s: any, tipoRaw: string, c: Cuenta, cfg: Config, hoy: string): Pendiente {
  const tipo = tipoRaw === 'self_service' ? 'flex' : tipoRaw === 'cross_docking' ? 'colecta' : 'correo';
  let despacho: string;
  if (tipo === 'flex') despacho = diaDespachoFlex(new Date(o.date_created), cfg);
  else {
    const lim = s.shipping_option?.estimated_handling_limit?.date || s.lead_time?.estimated_handling_limit?.date;
    despacho = lim ? fechaAR(new Date(lim)) : hoy;
  }
  const dest = s.receiver_address || s.destination?.shipping_address || {};
  return {
    cuenta: c.nickname, cuentaId: c.user_id, envioId: String(s.id), ordenes: [String(o.id)],
    tipo, tipoTexto: TIPO_ENVIO[tipoRaw] || tipoRaw,
    comprador: o.buyer?.nickname || '',
    receptor: dest.receiver_name || s.destination?.receiver_name || '',
    zona: [dest.city?.name, dest.state?.name].filter(Boolean).join(', '),
    items: [], creado: o.date_created, despacho,
    estado: despacho < hoy ? 'ATRASADO' : despacho === hoy ? 'HOY' : 'PROXIMO',
    subestado: s.substatus || s.status, link: ventaLink(String(o.id)),
  };
}

/** Día en que hay que despachar un Flex según hora de corte y días hábiles. */
export function diaDespachoFlex(creado: Date, cfg: Pick<Config, 'FLEX_CORTE' | 'FLEX_DIAS'>) {
  const corte = hhmm(cfg.FLEX_CORTE) ?? 780;
  const dias = String(cfg.FLEX_DIAS || '1,2,3,4,5,6').split(',').map((x) => Number(x.trim()));
  if (dias.includes(diaSemanaAR(creado)) && minutosAR(creado) < corte) return fechaAR(creado);
  let d = creado;
  for (let k = 0; k < 8; k++) {
    d = new Date(d.getTime() + 864e5);
    if (dias.includes(diaSemanaAR(d))) return fechaAR(d);
  }
  return fechaAR(d);
}

function ordenarPendientes(l: Pendiente[]) {
  const pe = { ATRASADO: 0, HOY: 1, PROXIMO: 2 }, pt = { flex: 0, colecta: 1, correo: 2 };
  return l.sort((a, b) => pe[a.estado] - pe[b.estado] || pt[a.tipo] - pt[b.tipo] || (a.creado < b.creado ? -1 : 1));
}

async function syncPreguntas(c: Cuenta): Promise<Pregunta[]> {
  const r = await meli(c, `/questions/search?seller_id=${c.user_id}&status=UNANSWERED&api_version=4&limit=50&sort_fields=date_created&sort_types=ASC`);
  const qs: any[] = r.questions || [];
  const sql = await db();
  const ids = [...new Set(qs.map((q) => q.item_id))];
  const titulos = new Map<string, string>();
  if (ids.length) (await sql`select item_id, titulo from items where item_id in ${sql(ids)}`).forEach((x) => titulos.set(x.item_id, x.titulo));
  const faltan = ids.filter((i) => !titulos.has(i));
  if (faltan.length) (await itemsMultiget(c, faltan, 'id,title')).forEach((x) => titulos.set(x.id, x.title));
  return qs.map((q) => ({
    cuenta: c.nickname, cuentaId: c.user_id, id: String(q.id), itemId: q.item_id,
    producto: titulos.get(q.item_id) || q.item_id, texto: q.text, creado: q.date_created,
    minutos: Math.round((Date.now() - new Date(q.date_created).getTime()) / 60000),
    link: 'https://www.mercadolibre.com.ar/preguntas/vendedor',
  }));
}

async function syncReclamos(c: Cuenta): Promise<Reclamo[]> {
  const r = await meli(c, `/post-purchase/v1/claims/search?player_role=respondent&player_user_id=${c.user_id}&status=opened&limit=30`);
  return (r.data || []).map((x: any) => ({
    cuenta: c.nickname, cuentaId: c.user_id, id: String(x.id), orden: x.resource_id ? String(x.resource_id) : '',
    tipo: x.type === 'mediations' || x.stage === 'dispute' ? 'Mediación' : 'Reclamo',
    motivo: x.reason_id || '', creado: x.date_created, link: `https://www.mercadolibre.com.ar/reclamos/${x.id}`,
  }));
}

/* ------------------------------------------------------------------ lento */

export async function sincronizarLento() {
  const sql = await db();
  const lista = await cuentas();
  for (const c of lista) {
    const errores: string[] = [];
    try {
      const u = await meli(c, `/users/${c.user_id}`);
      await sql`update cuentas set reputacion = ${sql.json(reputacion(u.seller_reputation || {}))}, nickname = ${u.nickname || c.nickname} where user_id = ${c.user_id}`;
    } catch (e) { errores.push('Reputación: ' + (e as Error).message); }
    try { await syncItems(c); } catch (e) { errores.push('Publicaciones: ' + (e as Error).message); }
    if (errores.length) await sql`update cuentas set error = ${errores.join(' · ')} where user_id = ${c.user_id}`;
  }
  await setEstado('lento', { ok: true });
}

function reputacion(r: any): Reputacion {
  const m = r.metrics || {};
  return {
    nivel: r.level_id || '', color: String(r.level_id || '').replace(/^\d_/, ''), medalla: r.power_seller_status || '',
    reclamos: m.claims?.rate ?? null, demoras: m.delayed_handling_time?.rate ?? null,
    cancelaciones: m.cancellations?.rate ?? null, ventas60: m.sales?.completed ?? null,
  };
}

async function syncItems(c: Cuenta) {
  const sql = await db();
  const ids: string[] = [];
  for (const estado of ['active', 'paused']) {
    for (let offset = 0; offset < 1000; offset += 100) {
      const r = await meli(c, `/users/${c.user_id}/items/search?status=${estado}&limit=100&offset=${offset}`);
      ids.push(...(r.results || []));
      if (!r.paging || offset + 100 >= r.paging.total) break;
    }
  }
  const items = await itemsMultiget(c, ids,
    'id,title,price,available_quantity,sold_quantity,status,permalink,thumbnail,seller_custom_field,category_id,listing_type_id,catalog_product_id,catalog_listing,variations,shipping,attributes');

  // Comisiones: una consulta por combinación categoría/tipo/precio (cacheada)
  const cacheFee = new Map<string, { pct: number; fija: number } | null>();
  const claves = [...new Set(items.map((it) => `${it.category_id}|${it.listing_type_id}|${Math.round(it.price)}`))].slice(0, 150);
  await enParalelo(claves, 8, async (k) => {
    const [cat, tipo, precio] = k.split('|');
    cacheFee.set(k, await comision(Number(precio), tipo, cat));
  });

  const ahora = new Date();
  for (const it of items) {
    const sku = it.seller_custom_field || (it.attributes || []).find((a: any) => a.id === 'SELLER_SKU')?.value_name || '';
    const fee = cacheFee.get(`${it.category_id}|${it.listing_type_id}|${Math.round(it.price)}`);
    await sql`insert into items (item_id, cuenta_id, titulo, precio, stock, vendidos, estado, sku, permalink, thumbnail, category_id, listing_type,
        catalog_product_id, catalog_listing, tiene_variaciones, envio_gratis, logistica, comision_pct, comision_fija, actualizado)
      values (${it.id}, ${c.user_id}, ${it.title}, ${it.price}, ${it.available_quantity}, ${it.sold_quantity || 0}, ${it.status}, ${sku},
        ${it.permalink}, ${String(it.thumbnail || '').replace('http://', 'https://')}, ${it.category_id}, ${it.listing_type_id},
        ${it.catalog_product_id || null}, ${!!it.catalog_listing}, ${(it.variations || []).length > 0}, ${!!it.shipping?.free_shipping},
        ${it.shipping?.logistic_type || ''}, ${fee ? fee.pct : null}, ${fee ? fee.fija : null}, ${ahora})
      on conflict (item_id) do update set titulo = excluded.titulo, precio = excluded.precio, stock = excluded.stock, vendidos = excluded.vendidos,
        estado = excluded.estado, sku = excluded.sku, permalink = excluded.permalink, thumbnail = excluded.thumbnail, category_id = excluded.category_id,
        listing_type = excluded.listing_type, catalog_product_id = excluded.catalog_product_id, catalog_listing = excluded.catalog_listing,
        tiene_variaciones = excluded.tiene_variaciones, envio_gratis = excluded.envio_gratis, logistica = excluded.logistica,
        comision_pct = coalesce(excluded.comision_pct, items.comision_pct), comision_fija = coalesce(excluded.comision_fija, items.comision_fija),
        actualizado = excluded.actualizado`;
  }
  // Las que ya no están activas ni pausadas
  await sql`update items set estado = 'inactiva' where cuenta_id = ${c.user_id} and actualizado < ${ahora} and estado <> 'inactiva'`;
}

/** Comisión de venta de MeLi para un precio/tipo/categoría. pct en 0..1, fija en $. */
export async function comision(precio: number, tipo: string, categoria: string) {
  const r = await meliOpt(null, `/sites/${SITE}/listing_prices?price=${precio}&listing_type_id=${tipo}&category_id=${categoria}`);
  const x = Array.isArray(r) ? r.find((y: any) => y.listing_type_id === tipo) || r[0] : r;
  if (!x || x.sale_fee_amount == null) return null;
  const det = x.sale_fee_details || {};
  const fija = Number(det.fixed_fee || 0);
  const pct = det.percentage_fee != null ? Number(det.percentage_fee) / 100 : (Number(x.sale_fee_amount) - fija) / precio;
  return { pct, fija, total: Number(x.sale_fee_amount), nombre: x.listing_type_name || tipo };
}

/* ------------------------------------------------------------------ lectura para el panel */

export async function operacionTotal(): Promise<Operacion & { porCuenta: Record<string, string> }> {
  const sql = await db();
  const rows = await sql`select e.datos from estado e join cuentas c on e.clave = 'op:' || c.user_id`;
  const out: Operacion & { porCuenta: Record<string, string> } = { pendientes: [], preguntas: [], reclamos: [], actualizado: '', porCuenta: {} };
  for (const r of rows) {
    const d = r.datos as Operacion;
    out.pendientes.push(...d.pendientes); out.preguntas.push(...d.preguntas); out.reclamos.push(...d.reclamos);
    if (!out.actualizado || d.actualizado < out.actualizado) out.actualizado = d.actualizado;
  }
  ordenarPendientes(out.pendientes);
  out.preguntas.sort((a, b) => b.minutos - a.minutos);
  return out;
}
