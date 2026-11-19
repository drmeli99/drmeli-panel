import { Fragment } from 'react';
import { db, getEstado } from '@/lib/db';
import { listaCuentas, deTienda } from '@/lib/datos';
import { estadoTexto, TIPO_PUB, type EstadoCatalogo } from '@/lib/competencia';
import { plata, pct, hace } from '@/lib/tiempo';
import { Encabezado, Tarjeta, Tabs, Pill, Vacio, Dato, Boton, Aviso } from '@/components/ui';
import { FiltroTienda } from '@/components/FiltroTienda';
import { FormSimple } from '@/components/FormSimple';
import { BotonAccion } from '@/components/BotonAccion';
import { vigilar, dejarDeVigilar, agregarCompetidor, quitarCompetidor, actualizarTodo } from '@/app/acciones';
import { I } from '@/components/Iconos';

const tonoEstado = (s: string) => (s === 'winning' ? 'ok' : s === 'sharing_first_place' ? 'accent' : s === 'competing' ? 'bad' : 'gris') as 'ok' | 'accent' | 'bad' | 'gris';

export default async function Competencia({ searchParams }: { searchParams: Promise<{ t?: string; tab?: string; ver?: string }> }) {
  const { t, tab = 'ranking', ver } = await searchParams;
  const sql = await db();
  const [cs, comp, vig, sellers] = await Promise.all([
    listaCuentas(), getEstado<EstadoCatalogo[]>('competencia'),
    sql`select v.*, (select json_agg(json_build_object('f', h.fecha, 'p', h.precio) order by h.fecha) from (select * from vigilancia_hist where vigilancia_id = v.id order by fecha desc limit 30) h) as hist from vigilancia v order by v.creado desc`,
    sql`select * from competidores order by creado desc`,
  ]);
  const ranking = (comp?.datos || []).filter(deTienda(t));
  const q = (x: string) => `/competencia?tab=${x}${t ? `&t=${t}` : ''}`;
  const ganando = ranking.filter((x) => x.estado === 'winning').length;
  const perdiendo = ranking.filter((x) => x.estado === 'competing');
  return (
    <>
      <Encabezado icono={I.competencia} titulo="Competencia" extra={<span className="text-[13px] text-muted">{ranking.length} catálogos · {vig.length} vigilados · {sellers.length} sellers</span>}>
        <BotonAccion accion={actualizarTodo}>{I.refrescar} Actualizar</BotonAccion>
      </Encabezado>
      <Tabs activa={tab} tabs={[
        { id: 'ranking', label: 'Ranking', href: q('ranking'), n: ranking.length },
        { id: 'vigilancia', label: 'Vigilancia', href: q('vigilancia'), n: vig.length },
        { id: 'sellers', label: 'Mis competidores', href: q('sellers'), n: sellers.length },
      ]} />

      {tab === 'ranking' && (
        <>
          <p className="-mt-1 text-muted">Tus publicaciones de catálogo: si estás ganando el primer lugar (la “caja de compra”), y a qué precio tendrías que estar para ganarlo. Se revisa cada hora{comp ? ` · última vez hace ${hace(comp.actualizado)}` : ''}.</p>
          <FiltroTienda cuentas={cs.map((c) => ({ id: c.id, nombre: c.nombre }))} />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Dato label="Ganando" valor={ganando} tono="ok" sub={`de ${ranking.length} catálogos`} />
            <Dato label="Perdiendo" valor={perdiendo.length} tono={perdiendo.length ? 'bad' : undefined} sub="otro vendedor tiene el 1° lugar" />
            <Dato label="Compartiendo 1°" valor={ranking.filter((x) => x.estado === 'sharing_first_place').length} />
            <Dato label="Bajar para ganar" valor={plata(perdiendo.reduce((a, x) => a + (x.precioParaGanar ? Math.max(0, x.miPrecio - x.precioParaGanar) : 0), 0) / Math.max(1, perdiendo.length))} sub="diferencia promedio" />
          </div>
          <Tarjeta titulo="Mis catálogos">
            {ranking.length ? (
              <div className="overflow-x-auto"><table>
                <thead><tr><th>Publicación</th><th>Estado</th><th className="r">Mi precio</th><th className="r">Precio para ganar</th><th className="r">Diferencia</th><th className="r">Competidores</th><th /></tr></thead>
                <tbody>{ranking.map((x) => {
                  const dif = x.precioParaGanar != null ? x.precioParaGanar - x.miPrecio : null;
                  const abierto = ver === x.itemId;
                  return (
                    <Fragment key={x.itemId}>
                      <tr>
                        <td className="min-w-[240px]"><div className="line-clamp-2 font-medium">{x.titulo}</div><div className="text-[11px] text-muted">{x.cuenta} · {TIPO_PUB[x.tipo] || x.tipo} · {x.itemId}</div></td>
                        <td><Pill tono={tonoEstado(x.estado)}>{estadoTexto(x.estado)}</Pill></td>
                        <td className="r num">{plata(x.miPrecio)}</td>
                        <td className="r num">{x.precioParaGanar != null ? plata(x.precioParaGanar) : '–'}</td>
                        <td className={`r num ${dif != null && dif < 0 ? 'text-bad' : ''}`}>{dif != null ? `${dif > 0 ? '+' : ''}${plata(dif)} (${pct(dif / x.miPrecio, 1)})` : '–'}</td>
                        <td className="r num">{x.ofertas.filter((o) => !o.mio).length}</td>
                        <td className="r"><Boton href={abierto ? q('ranking') : `${q('ranking')}&ver=${x.itemId}`}>{abierto ? 'Cerrar' : 'Ver ofertas'}</Boton></td>
                      </tr>
                      {abierto && (
                        <tr><td colSpan={7} className="bg-panel2">
                          {x.motivos.length > 0 && <div className="mb-2 text-[12px] text-muted">Por qué no ganás: {x.motivos.join(', ')}</div>}
                          <table><thead><tr><th>#</th><th>Vendedor</th><th>Tipo</th><th className="r">Precio contado</th><th className="r">vs vos</th><th>Envío</th></tr></thead>
                            <tbody>{x.ofertas.map((o, i) => (
                              <tr key={o.itemId} className={o.mio ? 'text-accent' : ''}>
                                <td className="num">{i + 1}</td><td>{o.mio ? 'Vos' : o.sellerId}</td>
                                <td><Pill tono={o.tipo === 'gold_pro' ? 'accent' : 'gris'}>{o.tipo === 'gold_pro' ? 'Cuotas' : 'Contado'}</Pill></td>
                                <td className="r num">{plata(o.precio)}</td>
                                <td className={`r num ${o.precio < x.miPrecio ? 'text-bad' : 'text-ok'}`}>{o.mio ? '' : pct((o.precio - x.miPrecio) / x.miPrecio)}</td>
                                <td className="text-[12px]">{o.full ? 'Full' : ''}{o.envioGratis ? (o.full ? ' · ' : '') + 'Gratis' : ''}</td>
                              </tr>))}</tbody></table>
                          <div className="mt-2 text-[12px] text-muted">Compará cuotas con cuotas y contado con contado: una Premium (cuotas sin interés) más cara puede ganarle a una Clásica más barata.</div>
                        </td></tr>
                      )}
                    </Fragment>
                  );
                })}</tbody>
              </table></div>
            ) : <Vacio>No hay publicaciones de catálogo todavía, o no se revisaron. Tocá Actualizar.</Vacio>}
          </Tarjeta>
        </>
      )}

      {tab === 'vigilancia' && (
        <>
          <p className="-mt-1 text-muted">Seguí cualquier publicación (tuya o de otro). Cada hora se guarda el precio y te avisa por Telegram si cambia o si perdés el 1° lugar.</p>
          <Tarjeta titulo="Vigilar una publicación">
            <FormSimple accion={vigilar} boton="Vigilar" className="p-4">
              <input name="item" id="item" placeholder="Link o código MLA de la publicación" className="min-w-[260px] flex-1" required />
              <input name="nota" id="nota" placeholder="Nota (opcional)" className="w-48" />
            </FormSimple>
          </Tarjeta>
          <Tarjeta titulo="Vigiladas">
            {vig.length ? (
              <div className="overflow-x-auto"><table>
                <thead><tr><th>Publicación</th><th>De</th><th className="r">Precio</th><th>Historial (30)</th><th>Estado</th><th /></tr></thead>
                <tbody>{vig.map((v) => {
                  const u = v.ultimo || {};
                  const hist = ((v.hist as { p: number }[]) || []).map((h) => Number(h.p));
                  return (
                    <tr key={v.id}>
                      <td className="min-w-[240px]"><div className="flex items-center gap-3">
                        {u.thumbnail && <img src={u.thumbnail} alt="" className="h-10 w-10 rounded-md border border-line bg-white object-contain" />}
                        <div><a href={u.permalink} target="_blank" rel="noreferrer" className="line-clamp-2 font-medium hover:text-accent">{u.titulo || v.item_id}</a>
                          <div className="text-[11px] text-muted">{v.item_id}{v.nota ? ` · ${v.nota}` : ''}{u.vendidos != null ? ` · ${u.vendidos} vendidos` : ''}</div></div></div></td>
                      <td>{v.tipo === 'mio' ? <Pill tono="accent">Mía</Pill> : <Pill>Otro</Pill>}</td>
                      <td className="r num">{u.precio != null ? plata(u.precio) : '–'}{u.precioOriginal ? <div className="text-[11px] text-muted line-through">{plata(u.precioOriginal)}</div> : null}</td>
                      <td><Mini valores={hist} /></td>
                      <td>{u.estadoCatalogo ? <Pill tono={tonoEstado(u.estadoCatalogo)}>{estadoTexto(u.estadoCatalogo)}</Pill> : <span className="text-[12px] text-muted">{TIPO_PUB[u.tipo] || ''}{u.full ? ' · Full' : ''}</span>}</td>
                      <td className="r"><form action={dejarDeVigilar}><input type="hidden" name="id" value={v.id} /><button className="text-[12px] text-muted hover:text-bad">Quitar</button></form></td>
                    </tr>
                  );
                })}</tbody>
              </table></div>
            ) : <Vacio>Todavía no vigilás nada. Pegá arriba el link de una publicación.</Vacio>}
          </Tarjeta>
        </>
      )}

      {tab === 'sellers' && (
        <>
          <p className="-mt-1 text-muted">Seguí a los vendedores que compiten con vos: reputación, cantidad de publicaciones y sus precios. Te avisa cuando cambian precios.</p>
          <Tarjeta titulo="Agregar competidor">
            <FormSimple accion={agregarCompetidor} boton="Agregar" className="p-4">
              <input name="seller" id="seller" placeholder="Nickname o ID del vendedor" className="min-w-[240px] flex-1" required />
              <input name="nota" id="notaS" placeholder="Nota (opcional)" className="w-48" />
            </FormSimple>
          </Tarjeta>
          {sellers.length === 0 && <Tarjeta><Vacio>Sin competidores cargados.</Vacio></Tarjeta>}
          {sellers.map((s) => {
            const u = s.ultimo || {};
            return (
              <Tarjeta key={s.seller_id} titulo={<span className="flex items-center gap-2">{s.nickname || s.seller_id}{u.medalla && <Pill tono="accent">MercadoLíder {u.medalla}</Pill>}</span>}
                accion={<form action={quitarCompetidor}><input type="hidden" name="id" value={s.seller_id} /><button className="text-[12px] text-muted hover:text-bad">Quitar</button></form>}>
                <div className="flex flex-wrap gap-4 px-4 pt-3 text-[13px] text-muted">
                  <span>Reputación: <b className="text-ink">{u.reputacion || '–'}</b></span>
                  <span>Ventas: <b className="text-ink">{u.ventas ?? '–'}</b></span>
                  <span>Publicaciones: <b className="text-ink">{u.totalPublicaciones ?? '–'}</b></span>
                  {s.nota && <span>Nota: {s.nota}</span>}
                </div>
                {u.error && <div className="px-4 pt-2"><Aviso tono="warn">{u.error}</Aviso></div>}
                {(u.publicaciones || []).length > 0 && (
                  <div className="mt-2 max-h-80 overflow-auto"><table>
                    <thead><tr><th>Publicación</th><th>Tipo</th><th className="r">Precio</th><th className="r">Vendidos</th></tr></thead>
                    <tbody>{(u.publicaciones as any[]).slice(0, 30).map((p) => (
                      <tr key={p.id}><td className="min-w-[220px]"><a href={p.link} target="_blank" rel="noreferrer" className="hover:text-accent">{p.titulo}</a></td>
                        <td><Pill tono={p.tipo === 'gold_pro' ? 'accent' : 'gris'}>{p.tipo === 'gold_pro' ? 'Cuotas' : 'Contado'}</Pill>{p.full && <> <Pill tono="ok">Full</Pill></>}</td>
                        <td className="r num">{plata(p.precio)}</td><td className="r num">{p.vendidos ?? '–'}</td></tr>))}</tbody>
                  </table></div>
                )}
                <div className="h-3" />
              </Tarjeta>
            );
          })}
        </>
      )}
    </>
  );
}

function Mini({ valores }: { valores: number[] }) {
  if (valores.length < 2) return <span className="text-[12px] text-muted">{valores.length ? 'sin cambios' : '–'}</span>;
  const w = 120, h = 28, min = Math.min(...valores), max = Math.max(...valores), r = max - min || 1;
  const pts = valores.map((v, i) => `${(i / (valores.length - 1)) * (w - 4) + 2},${h - 3 - ((v - min) / r) * (h - 6)}`).join(' ');
  const ult = valores[valores.length - 1], ant = valores[valores.length - 2];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Historial de precio">
      <polyline points={pts} fill="none" stroke="rgb(var(--accent))" strokeWidth="1.8" />
      <circle cx={w - 2} cy={h - 3 - ((ult - min) / r) * (h - 6)} r="2.5" fill={ult < ant ? 'rgb(var(--bad))' : 'rgb(var(--ok))'} />
    </svg>
  );
}
