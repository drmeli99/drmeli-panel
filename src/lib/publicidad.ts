/**
 * Product Ads (publicidad en MercadoLibre): campañas, anuncios, métricas y recomendaciones.
 * Endpoints de la versión "marketplace" (api-version 2). Si MeLi cambia algo, se ajusta acá.
 */
import { db, setEstado, getEstado } from './db';
import { cuentas, meli, SITE, type Cuenta } from './meli';
import { mapaCostos } from './ventas';
import { getConfig } from './config';
import { fechaAR } from './tiempo';

const METRICAS = 'clicks,prints,ctr,cost,cpc,acos,roas,cvr,direct_amount,indirect_amount,total_amount,direct_units_quantity,indirect_units_quantity,units_quantity';

export type Metricas = { clicks: number; prints: number; ctr: number; cost: number; cpc: number; acos: number; roas: number; cvr: number; total_amount: number; units_quantity: number };
export type Campana = { id: string; nombre: string; estado: string; presupuesto: number | null; acosObjetivo: number | null; estrategia: string; m: Metricas };
export type Anuncio = {
  itemId: string; campanaId: string; titulo: string; estado: string; precio: number | null; thumbnail: string; link: string; m: Metricas;
  margen: number | null; acosEquilibrio: number | null;
  recs: { nivel: 'bien' | 'ojo' | 'mal'; texto: string }[];
};
export type Publicidad = {
  cuentaId: string; cuenta: string; advertiserId: string | null; desde: string; hasta: string;
  resumen: Metricas | null; campanas: Campana[]; anuncios: Anuncio[]; sinPublicidad: { itemId: string; titulo: string; vendidos: number; margen: number | null }[];
  error: string; actualizado: string;
};

const num = (x: unknown) => (x == null || x === '' ? 0 : Number(x));
function metricas(m: any = {}): Metricas {
  const clicks = num(m.clicks), prints = num(m.prints), cost = num(m.cost), total = num(m.total_amount ?? num(m.direct_amount) + num(m.indirect_amount));
  const units = num(m.units_quantity ?? num(m.direct_units_quantity) + num(m.indirect_units_quantity));
  return {
    clicks, prints, cost, total_amount: total, units_quantity: units,
    ctr: m.ctr != null ? num(m.ctr) / 100 : prints ? clicks / prints : 0,
    cpc: m.cpc != null ? num(m.cpc) : clicks ? cost / clicks : 0,
    acos: m.acos != null ? num(m.acos) / 100 : total ? cost / total : 0,
    roas: m.roas != null ? num(m.roas) : cost ? total / cost : 0,
    cvr: m.cvr != null ? num(m.cvr) / 100 : clicks ? units / clicks : 0,
  };
}

const H = { 'api-version': '2' };

async function advertiser(c: Cuenta): Promise<string | null> {
  const r = await meli(c, `/advertising/advertisers?product_id=PADS`, { headers: { 'Api-Version': '1' } });
  const a = (r?.advertisers || []).find((x: any) => !x.site_id || x.site_id === SITE) || r?.advertisers?.[0];
  return a ? String(a.advertiser_id) : null;
}

async function paginar(c: Cuenta, base: string) {
  const out: any[] = [];
  let resumen: any = null;
  for (let offset = 0; offset < 1000; offset += 50) {
    const r = await meli(c, `${base}&limit=50&offset=${offset}`, { headers: H });
    out.push(...(r.results || []));
    resumen ||= r.metrics_summary || null;
    if (!r.paging || offset + 50 >= r.paging.total) break;
  }
  return { out, resumen };
}

export async function syncPublicidadCuenta(c: Cuenta, dias = 30): Promise<Publicidad> {
  const hasta = fechaAR(), desde = fechaAR(new Date(Date.now() - (dias - 1) * 864e5));
  const pub: Publicidad = {
    cuentaId: c.user_id, cuenta: c.nickname, advertiserId: null, desde, hasta, resumen: null,
    campanas: [], anuncios: [], sinPublicidad: [], error: '', actualizado: new Date().toISOString(),
  };
  try {
    pub.advertiserId = await advertiser(c);
    if (!pub.advertiserId) { pub.error = 'Esta tienda no tiene Product Ads activado.'; return pub; }
    const q = `date_from=${desde}&date_to=${hasta}&metrics=${METRICAS}`;
    const camp = await paginar(c, `/advertising/${SITE}/advertisers/${pub.advertiserId}/product_ads/campaigns/search?${q}&metrics_summary=true`);
    pub.resumen = camp.resumen ? metricas(camp.resumen) : null;
    pub.campanas = camp.out.map((x) => ({
      id: String(x.id), nombre: x.name, estado: x.status, presupuesto: x.budget != null ? num(x.budget) : null,
      acosObjetivo: x.acos_target != null ? num(x.acos_target) / 100 : null, estrategia: x.strategy || '', m: metricas(x.metrics),
    }));
    const ads = await paginar(c, `/advertising/${SITE}/advertisers/${pub.advertiserId}/product_ads/ads/search?${q}`);
    pub.anuncios = ads.out.map((x) => ({
      itemId: x.item_id, campanaId: x.campaign_id ? String(x.campaign_id) : '', titulo: x.title || x.item_id, estado: x.status,
      precio: x.price != null ? num(x.price) : null, thumbnail: String(x.thumbnail || '').replace('http://', 'https://'),
      link: x.permalink || '', m: metricas(x.metrics), margen: null, acosEquilibrio: null, recs: [],
    }));
    if (!pub.resumen && pub.campanas.length) {
      const s = pub.campanas.reduce((a, x) => ({ clicks: a.clicks + x.m.clicks, prints: a.prints + x.m.prints, cost: a.cost + x.m.cost, total_amount: a.total_amount + x.m.total_amount, units_quantity: a.units_quantity + x.m.units_quantity }), { clicks: 0, prints: 0, cost: 0, total_amount: 0, units_quantity: 0 });
      pub.resumen = metricas(s);
    }
  } catch (e) {
    pub.error = 'No se pudo leer la publicidad: ' + (e as Error).message;
  }
  await recomendar(pub);
  return pub;
}

/** Recomendaciones simples a partir de métricas + margen real de cada producto. */
async function recomendar(pub: Publicidad) {
  const sql = await db();
  const costos = await mapaCostos();
  const cfg = await getConfig();
  const imp = Number(cfg.IMPUESTOS_PCT || 0) / 100;
  const items = await sql`select i.item_id, i.titulo, i.precio, i.sku, i.vendidos, i.comision_pct, i.comision_fija, i.estado,
      (select avg(v.envio_costo / greatest(v.cantidad, 1)) from ventas v where v.detalle->0->>0 = i.item_id and v.fecha > now() - interval '60 days') as envio
    from items i where i.cuenta_id = ${pub.cuentaId}`;
  const margenDe = new Map<string, number | null>();
  for (const it of items) {
    const costo = costos.get(it.sku) ?? costos.get(it.item_id);
    if (costo === undefined || it.comision_pct == null || !Number(it.precio)) { margenDe.set(it.item_id, null); continue; }
    const p = Number(it.precio);
    const neto = p - p * Number(it.comision_pct) - Number(it.comision_fija || 0) - Number(it.envio || 0) - costo - p * imp;
    margenDe.set(it.item_id, neto / p);
  }
  for (const a of pub.anuncios) {
    a.margen = margenDe.get(a.itemId) ?? null;
    a.acosEquilibrio = a.margen != null ? Math.max(0, a.margen) : null;
    const m = a.m, r = a.recs;
    if (a.estado !== 'active') continue;
    if (m.cost > 0 && m.units_quantity === 0 && m.clicks >= 30)
      r.push({ nivel: 'mal', texto: `${m.clicks} clics y ninguna venta en 30 días. Pausalo o revisá precio, fotos y cuotas antes de seguir pagando.` });
    if (a.acosEquilibrio != null && m.units_quantity > 0 && m.acos > a.acosEquilibrio)
      r.push({ nivel: 'mal', texto: `Pierde plata: el ACOS (${(m.acos * 100).toFixed(1)}%) es mayor que tu margen (${(a.acosEquilibrio * 100).toFixed(1)}%). Bajá el ACOS objetivo de la campaña o subí el precio.` });
    if (a.acosEquilibrio != null && m.units_quantity >= 3 && m.acos < a.acosEquilibrio * 0.5)
      r.push({ nivel: 'bien', texto: `Rentable: ACOS ${(m.acos * 100).toFixed(1)}% contra un margen de ${(a.acosEquilibrio * 100).toFixed(1)}%. Podés darle más presupuesto o un ACOS objetivo más alto para vender más.` });
    if (m.prints >= 2000 && m.ctr < 0.003)
      r.push({ nivel: 'ojo', texto: `Se muestra mucho pero casi nadie entra (CTR ${(m.ctr * 100).toFixed(2)}%). Mejorá la foto principal y el título, y compará tu precio.` });
    if (m.clicks >= 50 && m.units_quantity > 0 && m.cvr < 0.01)
      r.push({ nivel: 'ojo', texto: `Muchos clics y pocas ventas (conversión ${(m.cvr * 100).toFixed(1)}%). Revisá precio contra la competencia, cuotas sin interés, envío gratis y la descripción.` });
    if (a.margen == null)
      r.push({ nivel: 'ojo', texto: 'Cargá el costo de este producto para saber si la publicidad te deja ganancia.' });
  }
  const conAds = new Set(pub.anuncios.map((a) => a.itemId));
  pub.sinPublicidad = items
    .filter((it) => it.estado === 'active' && !conAds.has(it.item_id) && Number(it.vendidos) >= 5 && (margenDe.get(it.item_id) ?? 0.15) > 0.12)
    .sort((a, b) => Number(b.vendidos) - Number(a.vendidos)).slice(0, 10)
    .map((it) => ({ itemId: it.item_id, titulo: it.titulo, vendidos: Number(it.vendidos), margen: margenDe.get(it.item_id) ?? null }));
}

export async function syncPublicidad() {
  const lista = await cuentas();
  const out: Publicidad[] = [];
  for (const c of lista) out.push(await syncPublicidadCuenta(c));
  await setEstado('publicidad', out);
  return out;
}

export async function leerPublicidad() {
  return (await getEstado<Publicidad[]>('publicidad')) || null;
}
