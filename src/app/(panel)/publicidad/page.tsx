import { leerPublicidad } from '@/lib/publicidad';
import { listaCuentas } from '@/lib/datos';
import { plata, pct, hace } from '@/lib/tiempo';
import { Encabezado, Tarjeta, Dato, Pill, Vacio, Aviso, Tabs } from '@/components/ui';
import { FiltroTienda } from '@/components/FiltroTienda';
import { BotonAccion } from '@/components/BotonAccion';
import { actualizarPublicidad } from '@/app/acciones';
import { I } from '@/components/Iconos';

const ORDEN = { mal: 0, ojo: 1, bien: 2 } as const;

export default async function Publicidad({ searchParams }: { searchParams: Promise<{ t?: string; ver?: string }> }) {
  const { t, ver = 'recs' } = await searchParams;
  const [pub, cs] = await Promise.all([leerPublicidad(), listaCuentas()]);
  const lista = (pub?.datos || []).filter((p) => !t || p.cuentaId === t);
  const ads = lista.flatMap((p) => p.anuncios.map((a) => ({ ...a, cuenta: p.cuenta })));
  const camps = lista.flatMap((p) => p.campanas.map((c) => ({ ...c, cuenta: p.cuenta })));
  const tot = lista.reduce((a, p) => {
    const m = p.resumen; if (!m) return a;
    return { cost: a.cost + m.cost, total: a.total + m.total_amount, units: a.units + m.units_quantity, clicks: a.clicks + m.clicks, prints: a.prints + m.prints };
  }, { cost: 0, total: 0, units: 0, clicks: 0, prints: 0 });
  const conRecs = ads.filter((a) => a.recs.length).sort((a, b) => ORDEN[a.recs[0].nivel] - ORDEN[b.recs[0].nivel] || b.m.cost - a.m.cost);
  const perdida = ads.filter((a) => a.recs.some((r) => r.nivel === 'mal')).reduce((s, a) => s + a.m.cost, 0);
  const q = (x: string) => `/publicidad?ver=${x}${t ? `&t=${t}` : ''}`;
  return (
    <>
      <Encabezado icono={I.publicidad} titulo="Publicidad" sub={`Product Ads de los últimos 30 días, cruzado con el margen real de cada producto${pub ? ` · actualizado hace ${hace(pub.actualizado)}` : ''}.`}>
        <BotonAccion accion={actualizarPublicidad} trabajando="Leyendo publicidad…">{I.refrescar} Actualizar</BotonAccion>
      </Encabezado>
      <FiltroTienda cuentas={cs.map((c) => ({ id: c.id, nombre: c.nombre }))} />
      {!pub && <Aviso>Todavía no se leyó la publicidad. Tocá Actualizar (tarda unos segundos).</Aviso>}
      {lista.filter((p) => p.error).map((p) => <Aviso key={p.cuentaId} tono="warn"><b>{p.cuenta}:</b> {p.error}</Aviso>)}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Dato label="Inversión" valor={plata(tot.cost)} sub={`${tot.clicks.toLocaleString('es-AR')} clics · CPC ${plata(tot.clicks ? tot.cost / tot.clicks : 0)}`} />
        <Dato label="Ventas por publicidad" valor={plata(tot.total)} sub={`${tot.units} unidades`} />
        <Dato label="ACOS" valor={pct(tot.total ? tot.cost / tot.total : null)} sub={`ROAS ${tot.cost ? (tot.total / tot.cost).toFixed(1) : '–'}x · lo que gastás cada $100 vendidos`} />
        <Dato label="Gasto en anuncios que pierden" valor={plata(perdida)} tono={perdida ? 'bad' : 'ok'} sub="anuncios marcados en rojo" />
      </div>
      <Aviso>Cómo leerlo: el <b className="text-ink">ACOS</b> es cuánto de cada venta se va en publicidad. Si es mayor que tu <b className="text-ink">margen</b>, ese anuncio te hace perder plata. Para que las recomendaciones sean exactas, cargá los costos en Productos.</Aviso>
      <Tabs activa={ver} tabs={[
        { id: 'recs', label: 'Qué mejorar', href: q('recs'), n: conRecs.length },
        { id: 'anuncios', label: 'Anuncios', href: q('anuncios'), n: ads.length },
        { id: 'campanas', label: 'Campañas', href: q('campanas'), n: camps.length },
        { id: 'oportunidades', label: 'Sin publicidad', href: q('oportunidades'), n: lista.reduce((a, p) => a + p.sinPublicidad.length, 0) },
      ]} />

      {ver === 'recs' && (
        <div className="flex flex-col gap-2">
          {conRecs.length ? conRecs.map((a) => (
            <Tarjeta key={a.itemId}>
              <div className="flex flex-col gap-3 p-4 md:flex-row md:items-start">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{a.titulo}</div>
                  <div className="mt-0.5 text-[12px] text-muted">{a.cuenta} · {a.itemId}</div>
                  <ul className="mt-2 flex flex-col gap-1.5">{a.recs.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-[13px]"><Pill tono={r.nivel === 'mal' ? 'bad' : r.nivel === 'ojo' ? 'warn' : 'ok'}>{r.nivel === 'mal' ? 'Pierde' : r.nivel === 'ojo' ? 'Revisar' : 'Escalar'}</Pill><span>{r.texto}</span></li>
                  ))}</ul>
                </div>
                <dl className="grid shrink-0 grid-cols-4 gap-3 text-right text-[12px] md:w-[360px]">
                  <M l="Gasto" v={plata(a.m.cost)} /><M l="Ventas" v={`${a.m.units_quantity} u.`} /><M l="ACOS" v={a.m.total_amount ? pct(a.m.acos) : 'sin ventas'} /><M l="Margen" v={pct(a.acosEquilibrio)} />
                </dl>
              </div>
            </Tarjeta>
          )) : <Tarjeta><Vacio>Sin recomendaciones por ahora.</Vacio></Tarjeta>}
          <p className="text-[12px] text-muted">Los cambios de presupuesto, ACOS objetivo y pausa se hacen en <a className="underline" href="https://ads.mercadolibre.com.ar" target="_blank" rel="noreferrer">MercadoLibre Ads</a>.</p>
        </div>
      )}

      {ver === 'anuncios' && (
        <Tarjeta>
          {ads.length ? <div className="overflow-x-auto"><table>
            <thead><tr><th>Anuncio</th><th>Estado</th><th className="r">Impresiones</th><th className="r">Clics</th><th className="r">CTR</th><th className="r">Gasto</th><th className="r">Ventas</th><th className="r">ACOS</th><th className="r">Margen</th></tr></thead>
            <tbody>{[...ads].sort((a, b) => b.m.cost - a.m.cost).map((a) => (
              <tr key={a.itemId}>
                <td className="min-w-[220px]"><div className="line-clamp-2">{a.titulo}</div><div className="text-[11px] text-muted">{a.cuenta}</div></td>
                <td><Pill tono={a.estado === 'active' ? 'ok' : 'gris'}>{a.estado === 'active' ? 'activo' : a.estado}</Pill></td>
                <td className="r num">{a.m.prints.toLocaleString('es-AR')}</td><td className="r num">{a.m.clicks}</td><td className="r num">{pct(a.m.ctr, 2)}</td>
                <td className="r num">{plata(a.m.cost)}</td><td className="r num">{plata(a.m.total_amount)}<div className="text-[11px] text-muted">{a.m.units_quantity} u.</div></td>
                <td className={`r num ${a.acosEquilibrio != null && a.m.acos > a.acosEquilibrio ? 'font-bold text-bad' : ''}`}>{a.m.total_amount ? pct(a.m.acos) : '–'}</td>
                <td className="r num">{pct(a.acosEquilibrio)}</td>
              </tr>))}</tbody>
          </table></div> : <Vacio>Sin anuncios.</Vacio>}
        </Tarjeta>
      )}

      {ver === 'campanas' && (
        <Tarjeta>
          {camps.length ? <div className="overflow-x-auto"><table>
            <thead><tr><th>Campaña</th><th>Estado</th><th className="r">Presupuesto/día</th><th className="r">ACOS objetivo</th><th className="r">ACOS real</th><th className="r">Gasto</th><th className="r">Ventas</th><th className="r">ROAS</th></tr></thead>
            <tbody>{camps.map((c) => (
              <tr key={c.id}>
                <td className="min-w-[180px] font-medium">{c.nombre}<div className="text-[11px] text-muted">{c.cuenta}{c.estrategia ? ` · ${c.estrategia}` : ''}</div></td>
                <td><Pill tono={c.estado === 'active' ? 'ok' : 'gris'}>{c.estado}</Pill></td>
                <td className="r num">{c.presupuesto != null ? plata(c.presupuesto) : '–'}</td>
                <td className="r num">{pct(c.acosObjetivo)}</td>
                <td className={`r num ${c.acosObjetivo != null && c.m.acos > c.acosObjetivo * 1.2 ? 'text-bad' : ''}`}>{pct(c.m.acos)}</td>
                <td className="r num">{plata(c.m.cost)}</td><td className="r num">{plata(c.m.total_amount)}</td><td className="r num">{c.m.roas ? c.m.roas.toFixed(1) + 'x' : '–'}</td>
              </tr>))}</tbody>
          </table></div> : <Vacio>Sin campañas.</Vacio>}
        </Tarjeta>
      )}

      {ver === 'oportunidades' && (
        <Tarjeta titulo="Productos que venden bien y no tienen publicidad">
          {lista.some((p) => p.sinPublicidad.length) ? <div className="overflow-x-auto"><table>
            <thead><tr><th>Producto</th><th>Tienda</th><th className="r">Vendidos</th><th className="r">Margen</th></tr></thead>
            <tbody>{lista.flatMap((p) => p.sinPublicidad.map((s) => (
              <tr key={s.itemId}><td className="min-w-[220px]">{s.titulo}</td><td>{p.cuenta}</td><td className="r num">{s.vendidos}</td><td className="r num">{pct(s.margen)}</td></tr>)))}</tbody>
          </table></div> : <Vacio>Nada para sugerir.</Vacio>}
          <p className="px-4 pb-4 text-[12px] text-muted">Tienen ventas y margen: suelen responder bien a publicidad con un ACOS objetivo menor a su margen.</p>
        </Tarjeta>
      )}
    </>
  );
}

function M({ l, v }: { l: string; v: string }) {
  return <div><dt className="text-muted">{l}</dt><dd className="num font-semibold text-ink">{v}</dd></div>;
}
