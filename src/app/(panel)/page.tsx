import Link from 'next/link';
import { operacionTotal } from '@/lib/sync';
import { resumenVentas } from '@/lib/ventas';
import { getConfig } from '@/lib/config';
import { listaCuentas, deTienda } from '@/lib/datos';
import { minutosAR, hhmm, plata, pct, hace, tiempo } from '@/lib/tiempo';
import { Encabezado, Tarjeta, Dato, Barras, Termometro, nivelRep, Aviso, Boton, Pill, Vacio, PuntoRep } from '@/components/ui';
import { FiltroTienda } from '@/components/FiltroTienda';
import { ListaPendientes } from '@/components/Pendientes';
import { BotonAccion } from '@/components/BotonAccion';
import { actualizarAhora } from '@/app/acciones';
import { I } from '@/components/Iconos';

export default async function Overview({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  let cs;
  try { cs = await listaCuentas(); } catch (e) { return <SinBase error={(e as Error).message} />; }
  const [op, ventas, cfg] = await Promise.all([operacionTotal(), resumenVentas(), getConfig()]);
  const f = deTienda(t);
  const pend = op.pendientes.filter(f), preg = op.preguntas.filter(f), rec = op.reclamos.filter(f);
  const v = t ? ventas.porCuenta[t] : ventas.todas;
  const corte = hhmm(cfg.FLEX_CORTE) ?? 780;
  const falta = corte - minutosAR();
  const flexHoy = pend.filter((p) => p.tipo === 'flex' && p.estado !== 'PROXIMO');
  const atras = pend.filter((p) => p.estado === 'ATRASADO');
  const otrosHoy = pend.filter((p) => p.tipo !== 'flex' && p.estado !== 'PROXIMO');

  let tono = 'border-ok/30 bg-ok/10 text-ok', titulo = 'Todo al día', sub = 'No hay envíos, preguntas ni reclamos pendientes.';
  if (flexHoy.length) {
    tono = atras.length || falta <= 60 ? 'border-bad/40 bg-bad/10 text-bad' : 'border-warn/40 bg-warn/10 text-warn';
    titulo = `${flexHoy.length} ${flexHoy.length === 1 ? 'envío Flex' : 'envíos Flex'} para despachar${falta > 0 ? ' hoy' : ''}`;
    sub = falta > 0 ? `Corte a las ${cfg.FLEX_CORTE}.` : `Ya pasó el corte de las ${cfg.FLEX_CORTE}. Si el repartidor ya los retiró, se van solos de esta lista.`;
    if (atras.length) sub += ` ${atras.length} ${atras.length === 1 ? 'viene' : 'vienen'} de días anteriores.`;
  } else if (otrosHoy.length || preg.length || rec.length) {
    tono = 'border-warn/40 bg-warn/10 text-warn';
    titulo = 'Tenés ' + [otrosHoy.length && `${otrosHoy.length} para despachar`, preg.length && `${preg.length} ${preg.length === 1 ? 'pregunta' : 'preguntas'}`, rec.length && `${rec.length} ${rec.length === 1 ? 'reclamo' : 'reclamos'}`].filter(Boolean).join(', ');
    sub = 'No hay Flex urgentes.';
  }

  const rep = (() => {
    const lista = cs.filter((c) => !t || c.id === t);
    let peor: (typeof cs)[0] | null = null;
    for (const c of lista) { const n = nivelRep(c.reputacion?.color)?.[0]; if (n && (!peor || n < (nivelRep(peor.reputacion?.color)?.[0] || 9))) peor = c; }
    return peor;
  })();
  const dif = v && v.ayer.total ? (v.hoy.total - v.ayer.total) / v.ayer.total : null;

  return (
    <>
      <Encabezado icono={I.inicio} titulo="Overview" extra={<span className="text-[13px] text-muted">{op.actualizado ? `Actualizado hace ${hace(op.actualizado)}` : 'Sin datos todavía'}</span>}>
        <BotonAccion accion={actualizarAhora} tono="pri"><span className="flex items-center gap-1.5">{I.refrescar} Actualizar</span></BotonAccion>
      </Encabezado>
      <FiltroTienda cuentas={cs.map((c) => ({ id: c.id, nombre: c.nombre }))} />
      {!cs.length && <Aviso tono="warn">Todavía no conectaste ninguna tienda. Andá a <Link className="underline" href="/configuracion">Configuración</Link> y tocá <b>Conectar tienda</b>.</Aviso>}
      {cs.filter((c) => c.error).map((c) => <Aviso key={c.id} tono="bad"><b>{c.nombre}:</b> {c.error}</Aviso>)}
      {cs.some((c) => !c.backfill) && cs.length > 0 && <Aviso>Cargando el historial de los últimos 30 días. Las cifras se completan en unos minutos.</Aviso>}

      <div className={`grid grid-cols-1 items-center gap-3 rounded-xl border p-5 sm:grid-cols-[1fr_auto] ${tono}`}>
        <div><h2 className="text-xl font-bold leading-tight">{titulo}</h2><p className="mt-1 text-ink/80">{sub}</p></div>
        {flexHoy.length > 0 && falta > 0 && (
          <div className="sm:text-right">
            <div className={`num text-3xl font-semibold leading-none ${falta <= 60 ? 'pulso' : ''}`}>{Math.floor(falta / 60)}:{String(falta % 60).padStart(2, '0')}</div>
            <div className="mt-1 text-[11px] font-semibold uppercase tracking-wider">para el corte</div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Dato label="Ventas hoy" valor={plata(v?.hoy.total)} sub={<><b className="text-ink">{v?.hoy.ventas || 0}</b> ventas{dif != null && <span className={dif >= 0 ? ' text-ok' : ' text-bad'}> · {dif >= 0 ? '▲' : '▼'} {Math.abs(Math.round(dif * 100))}% vs ayer</span>}</>} />
        <Dato label="Ganancia hoy" valor={plata(v?.hoy.neto)} sub={`Comisión ${plata(v?.hoy.comision)} · envío ${plata(v?.hoy.envio)}`} />
        <div className="rounded-xl border border-line bg-panel p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">Últimos 7 días</div>
          <div className="num text-[22px] font-semibold">{plata(v?.d7.total)}</div>
          <div className="text-[13px] text-muted">Ganancia <b className="text-ink">{plata(v?.d7.neto)}</b> ({pct(v && v.d7.total ? v.d7.neto / v.d7.total : null, 0)})</div>
          {v && <Barras serie={v.serie} />}
        </div>
        <div className="rounded-xl border border-line bg-panel p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">Reputación{rep && cs.length > 1 && !t ? ` · ${rep.nombre}` : ''}</div>
          <div className="text-[22px] font-semibold">{nivelRep(rep?.reputacion?.color)?.[1] || '–'}</div>
          <div className="text-[13px] text-muted">Reclamos {pct(rep?.reputacion?.reclamos)} · demoras {pct(rep?.reputacion?.demoras)} · cancel. {pct(rep?.reputacion?.cancelaciones)}</div>
          <Termometro color={rep?.reputacion?.color} />
        </div>
      </div>
      {v && v.sinCosto > 0 && <Aviso>{v.sinCosto} ventas de los últimos 30 días no tienen el costo del producto cargado, así que la ganancia solo descuenta comisión, envío e impuestos. <Link href="/productos" className="underline">Cargá tus costos</Link>.</Aviso>}

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Tarjeta titulo={<span className="flex items-center gap-2">Para despachar <Pill tono={flexHoy.length ? 'bad' : 'gris'}>{pend.filter((p) => p.estado !== 'PROXIMO').length} hoy</Pill></span>} accion={<Boton href={t ? `/despachos?t=${t}` : '/despachos'}>Ver todo</Boton>}>
          <div className="p-3">{pend.length ? <ListaPendientes lista={pend.slice(0, 6)} corte={cfg.FLEX_CORTE} compacta /> : <Vacio>Nada para despachar.</Vacio>}</div>
        </Tarjeta>
        <div className="flex flex-col gap-5">
          <Tarjeta titulo={<span className="flex items-center gap-2">Preguntas <Pill tono={preg.length ? 'accent' : 'gris'}>{preg.length}</Pill></span>} accion={<Boton href="/preguntas">Responder</Boton>}>
            {preg.length ? (
              <ul className="divide-y divide-line">{preg.slice(0, 4).map((q) => (
                <li key={q.id} className="px-4 py-3">
                  <div className="flex gap-2 text-[12px] text-muted"><Pill tono={q.minutos >= 60 ? 'warn' : 'accent'}>hace {tiempo(q.minutos)}</Pill><span className="font-semibold text-ink">{q.cuenta}</span></div>
                  <div className="mt-1 line-clamp-2">“{q.texto}”</div>
                </li>))}
              </ul>
            ) : <Vacio>Sin preguntas pendientes.</Vacio>}
          </Tarjeta>
          <Tarjeta titulo={<span className="flex items-center gap-2">Reclamos <Pill tono={rec.length ? 'bad' : 'gris'}>{rec.length}</Pill></span>}>
            {rec.length ? (
              <ul className="divide-y divide-line">{rec.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                  <Pill tono="bad">{r.tipo}</Pill><span className="flex-1 text-[13px]"><b>{r.cuenta}</b> · venta #{r.orden}</span><Boton href={r.link}>Ver</Boton>
                </li>))}
              </ul>
            ) : <Vacio>Sin reclamos abiertos.</Vacio>}
          </Tarjeta>
        </div>
      </div>

      {cs.length > 1 && (
        <Tarjeta titulo="Tiendas">
          <div className="overflow-x-auto">
            <table>
              <thead><tr><th>Tienda</th><th className="r">Hoy</th><th className="r">7 días</th><th className="r">30 días</th><th className="r">Ganancia 30 d</th><th className="r">Margen</th></tr></thead>
              <tbody>{cs.map((c) => { const x = ventas.porCuenta[c.id]; return (
                <tr key={c.id}>
                  <td><div className="flex items-center gap-2"><PuntoRep color={c.reputacion?.color} /><Link href={`/?t=${c.id}`} className="font-semibold hover:text-accent">{c.nombre}</Link></div><div className="text-[12px] text-muted">{c.activos} publicaciones activas</div></td>
                  <td className="r num">{plata(x?.hoy.total)}<div className="text-[12px] text-muted">{x?.hoy.ventas || 0} ventas</div></td>
                  <td className="r num">{plata(x?.d7.total)}</td><td className="r num">{plata(x?.d30.total)}</td>
                  <td className="r num">{plata(x?.d30.neto)}</td><td className="r num">{pct(x && x.d30.total ? x.d30.neto / x.d30.total : null, 0)}</td>
                </tr>); })}</tbody>
            </table>
          </div>
        </Tarjeta>
      )}
    </>
  );
}

function SinBase({ error }: { error: string }) {
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-2xl font-bold">Falta configurar la base de datos</h1>
      <Aviso tono="bad">{error}</Aviso>
      <p className="text-muted">En Vercel: tu proyecto → <b>Storage → Create Database → Neon</b> → conectalo al proyecto y hacé <b>Redeploy</b>.</p>
    </div>
  );
}
