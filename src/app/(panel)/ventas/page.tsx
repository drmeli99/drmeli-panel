import Link from 'next/link';
import { db } from '@/lib/db';
import { resumenVentas, mapaCostos } from '@/lib/ventas';
import { getConfig } from '@/lib/config';
import { listaCuentas } from '@/lib/datos';
import { plata, pct, TZ } from '@/lib/tiempo';
import { ventaLink } from '@/lib/meli';
import { Encabezado, Tarjeta, Dato, Barras, Tabs, Aviso, Pill } from '@/components/ui';
import { FiltroTienda } from '@/components/FiltroTienda';
import { I } from '@/components/Iconos';

export default async function Ventas({ searchParams }: { searchParams: Promise<{ t?: string; p?: string }> }) {
  const { t, p = 'd30' } = await searchParams;
  const [res, cs, cfg, costos] = await Promise.all([resumenVentas(), listaCuentas(), getConfig(), mapaCostos()]);
  const r = t ? res.porCuenta[t] : res.todas;
  const per = (p === 'hoy' || p === 'd7' ? p : 'd30') as 'hoy' | 'd7' | 'd30';
  const a = r?.[per];
  const sql = await db();
  const dias = per === 'hoy' ? 1 : per === 'd7' ? 7 : 30;
  const filas = await sql`select v.*, c.nickname from ventas v join cuentas c on c.user_id = v.cuenta_id
    where v.fecha > now() - make_interval(days => ${dias}) ${t ? sql`and v.cuenta_id = ${t}` : sql``}
    order by v.fecha desc limit 150`;
  const imp = Number(cfg.IMPUESTOS_PCT || 0) / 100;
  const q = (x: string) => `/ventas?p=${x}${t ? `&t=${t}` : ''}`;
  const pasos = a ? [
    { l: 'Facturado', v: a.total, c: 'bg-accent' },
    { l: 'Comisión MeLi', v: -a.comision, c: 'bg-bad/70' },
    { l: 'Envíos', v: -a.envio, c: 'bg-bad/70' },
    { l: 'Impuestos', v: -a.impuestos, c: 'bg-bad/70' },
    { l: 'Costo producto', v: -a.costo, c: 'bg-bad/70' },
    { l: 'Ganancia', v: a.neto, c: 'bg-ok' },
  ] : [];
  return (
    <>
      <Encabezado icono={I.ventas} titulo="Ventas y ganancia" sub="Ganancia = facturado − comisión de MeLi − envío que pagás − impuestos − costo del producto." />
      <FiltroTienda cuentas={cs.map((c) => ({ id: c.id, nombre: c.nombre }))} />
      <Tabs activa={per} tabs={[{ id: 'hoy', label: 'Hoy', href: q('hoy') }, { id: 'd7', label: '7 días', href: q('d7') }, { id: 'd30', label: '30 días', href: q('d30') }]} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Dato label="Facturado" valor={plata(a?.total)} sub={`${a?.ventas || 0} ventas · ${a?.unidades || 0} unidades`} />
        <Dato label="Ganancia" valor={plata(a?.neto)} tono={a && a.neto < 0 ? 'bad' : 'ok'} sub={`Margen ${pct(a && a.total ? a.neto / a.total : null)}`} />
        <Dato label="Ticket promedio" valor={plata(a && a.ventas ? a.total / a.ventas : 0)} sub={`Ganancia por venta ${plata(a && a.ventas ? a.neto / a.ventas : 0)}`} />
        <div className="rounded-xl border border-line bg-panel p-4"><div className="text-[11px] font-semibold uppercase tracking-wider text-muted">Últimos 14 días</div>{r && <Barras serie={r.serie} />}</div>
      </div>
      {r && r.sinCosto > 0 && <Aviso>{r.sinCosto} ventas sin costo de producto cargado. <Link className="underline" href="/productos">Cargalos en Productos</Link> para ver la ganancia real.</Aviso>}
      {a && a.total > 0 && (
        <Tarjeta titulo="¿A dónde va la plata?">
          <div className="flex flex-col gap-2 p-4">
            {pasos.map((x) => (
              <div key={x.l} className="grid grid-cols-[120px_1fr_110px] items-center gap-3 sm:grid-cols-[150px_1fr_130px]">
                <span className="text-[13px] text-muted">{x.l}</span>
                <div className="h-3 rounded bg-panel2"><div className={`h-3 rounded ${x.c}`} style={{ width: `${Math.min(100, (Math.abs(x.v) / a.total) * 100)}%` }} /></div>
                <span className={`num text-right text-[13px] ${x.v < 0 ? 'text-bad' : ''}`}>{plata(x.v)} <span className="text-muted">{pct(Math.abs(x.v) / a.total, 0)}</span></span>
              </div>
            ))}
          </div>
        </Tarjeta>
      )}
      <div className="grid gap-5 xl:grid-cols-[1fr_1.6fr]">
        <Tarjeta titulo="Más vendidos (7 días)">
          <div className="overflow-x-auto"><table>
            <thead><tr><th>Producto</th><th className="r">U.</th><th className="r">Ganancia</th></tr></thead>
            <tbody>{(r?.top || []).map((x) => <tr key={x.producto}><td className="min-w-[180px]">{x.producto}</td><td className="r num">{x.unidades}</td><td className="r num">{plata(x.neto)}</td></tr>)}</tbody>
          </table></div>
        </Tarjeta>
        <Tarjeta titulo={`Ventas (${filas.length}${filas.length === 150 ? '+' : ''})`}>
          <div className="max-h-[560px] overflow-auto"><table>
            <thead className="sticky top-0 bg-panel"><tr><th>Fecha</th><th>Producto</th><th>Envío</th><th className="r">Total</th><th className="r">Ganancia</th></tr></thead>
            <tbody>{filas.map((v) => {
              let costo = 0, falta = false;
              for (const d of (v.detalle as [string, string, number][]) || []) { const c = costos.get(d[1]) ?? costos.get(d[0]); if (c === undefined) falta = true; else costo += c * Number(d[2] || 1); }
              const neto = Number(v.total) - Number(v.comision) - Number(v.envio_costo) - costo - Number(v.total) * imp;
              const cancel = v.estado === 'cancelled';
              return (
                <tr key={v.order_id} className={cancel ? 'opacity-50' : ''}>
                  <td className="whitespace-nowrap text-[13px] text-muted">{new Date(v.fecha).toLocaleString('es-AR', { timeZone: TZ, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}<div className="text-[11px]">{v.nickname}</div></td>
                  <td className="min-w-[200px]"><a href={ventaLink(v.order_id)} target="_blank" rel="noreferrer" className="hover:text-accent">{v.cantidad > 1 ? `${v.cantidad}× ` : ''}{v.producto}</a></td>
                  <td className="text-[12px]">{v.tipo_envio}{cancel && <> <Pill tono="bad">cancelada</Pill></>}</td>
                  <td className="r num">{plata(v.total)}</td>
                  <td className={`r num ${neto < 0 ? 'text-bad' : ''}`}>{plata(neto)}{falta && <span title="Sin costo cargado" className="text-warn"> *</span>}</td>
                </tr>
              );
            })}</tbody>
          </table></div>
        </Tarjeta>
      </div>
    </>
  );
}
