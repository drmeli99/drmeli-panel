import { db } from './db';
import { getConfig } from './config';
import { fechaAR } from './tiempo';

export type Acc = { ventas: number; unidades: number; total: number; comision: number; envio: number; costo: number; impuestos: number; neto: number };
export type Resumen = {
  hoy: Acc; ayer: Acc; d7: Acc; d30: Acc;
  serie: { fecha: string; total: number; neto: number; ventas: number }[];
  top: { producto: string; unidades: number; total: number; neto: number }[];
  sinCosto: number;
};
const acc = (): Acc => ({ ventas: 0, unidades: 0, total: 0, comision: 0, envio: 0, costo: 0, impuestos: 0, neto: 0 });

export async function mapaCostos() {
  const sql = await db();
  const m = new Map<string, number>();
  (await sql`select clave, costo from costos`).forEach((r) => m.set(String(r.clave).trim(), Number(r.costo)));
  return m;
}

/** Calcula ventas y ganancia de los últimos 30 días, total y por tienda. */
export async function resumenVentas(dias = 30): Promise<{ todas: Resumen; porCuenta: Record<string, Resumen> }> {
  const sql = await db();
  const cfg = await getConfig();
  const imp = Number(cfg.IMPUESTOS_PCT || 0) / 100;
  const filas = await sql`select cuenta_id, fecha, producto, cantidad, total, comision, envio_costo, detalle from ventas
    where fecha >= now() - make_interval(days => ${dias + 1}) and estado not in ('cancelled', 'invalid')`;
  const costos = await mapaCostos();
  const hoy = fechaAR(), ayer = fechaAR(new Date(Date.now() - 864e5));
  const hace7 = fechaAR(new Date(Date.now() - 6 * 864e5)), hace30 = fechaAR(new Date(Date.now() - 29 * 864e5));
  const dias14 = Array.from({ length: 14 }, (_, k) => fechaAR(new Date(Date.now() - (13 - k) * 864e5)));

  type G = Resumen & { _serie: Map<string, Resumen['serie'][0]>; _top: Map<string, Resumen['top'][0]> };
  const nuevo = (): G => ({
    hoy: acc(), ayer: acc(), d7: acc(), d30: acc(), serie: [], top: [], sinCosto: 0,
    _serie: new Map(dias14.map((d) => [d, { fecha: d, total: 0, neto: 0, ventas: 0 }])), _top: new Map(),
  });
  const todas = nuevo();
  const porCuenta: Record<string, G> = {};

  for (const r of filas) {
    const f = fechaAR(new Date(r.fecha));
    if (f < hace30) continue;
    let costo = 0, falta = false;
    for (const d of (r.detalle as [string, string, number][]) || []) {
      const c = costos.get(d[1]) ?? costos.get(d[0]);
      if (c === undefined) falta = true; else costo += c * Number(d[2] || 1);
    }
    const total = Number(r.total), comision = Number(r.comision), envio = Number(r.envio_costo);
    const impuestos = total * imp;
    const v = { cant: Number(r.cantidad), total, comision, envio, costo, impuestos, neto: total - comision - envio - costo - impuestos };
    for (const g of [todas, (porCuenta[r.cuenta_id] ||= nuevo())]) {
      const sumar = (a: Acc) => { a.ventas++; a.unidades += v.cant; a.total += v.total; a.comision += v.comision; a.envio += v.envio; a.costo += v.costo; a.impuestos += v.impuestos; a.neto += v.neto; };
      sumar(g.d30);
      if (f >= hace7) {
        sumar(g.d7);
        const t = g._top.get(r.producto) || { producto: r.producto, unidades: 0, total: 0, neto: 0 };
        t.unidades += v.cant; t.total += v.total; t.neto += v.neto; g._top.set(r.producto, t);
      }
      if (f === hoy) sumar(g.hoy);
      if (f === ayer) sumar(g.ayer);
      const s = g._serie.get(f); if (s) { s.total += v.total; s.neto += v.neto; s.ventas++; }
      if (falta) g.sinCosto++;
    }
  }
  const cerrar = (g: G): Resumen => ({
    hoy: g.hoy, ayer: g.ayer, d7: g.d7, d30: g.d30, sinCosto: g.sinCosto,
    serie: [...g._serie.values()],
    top: [...g._top.values()].sort((a, b) => b.unidades - a.unidades).slice(0, 8),
  });
  return { todas: cerrar(todas), porCuenta: Object.fromEntries(Object.entries(porCuenta).map(([k, g]) => [k, cerrar(g)])) };
}
