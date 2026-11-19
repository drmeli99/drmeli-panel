import { productos } from '@/lib/productos';
import { listaCuentas } from '@/lib/datos';
import { plata, pct } from '@/lib/tiempo';
import { TIPO_PUB } from '@/lib/competencia';
import { Encabezado, Tarjeta, Pill, Vacio, Aviso } from '@/components/ui';
import { FiltroTienda } from '@/components/FiltroTienda';
import { CostoInline } from '@/components/CostoInline';
import { ImportarCostos } from '@/components/ImportarCostos';
import { I } from '@/components/Iconos';

export default async function Productos({ searchParams }: { searchParams: Promise<{ t?: string; q?: string; estado?: string }> }) {
  const sp = await searchParams;
  const [lista, cs] = await Promise.all([productos(sp), listaCuentas()]);
  const sinCosto = lista.filter((p) => p.costo == null && p.estado === 'active').length;
  const perdida = lista.filter((p) => p.ganancia != null && p.ganancia < 0);
  return (
    <>
      <Encabezado icono={I.producto} titulo="Productos y costos" sub="Cargá el costo de cada producto para ver cuánto ganás por unidad. Comisión según MeLi; envío = promedio que pagaste en sus ventas." />
      <FiltroTienda cuentas={cs.map((c) => ({ id: c.id, nombre: c.nombre }))} />
      {perdida.length > 0 && <Aviso tono="bad">{perdida.length} publicaciones pierden plata con el precio actual. Están marcadas en rojo; revisalas en <a className="underline" href="/pricing">Pricing</a>.</Aviso>}
      <form className="flex flex-wrap gap-2">
        {sp.t && <input type="hidden" name="t" value={sp.t} />}
        <input name="q" id="q" defaultValue={sp.q} placeholder="Buscar por título, SKU o MLA…" className="min-w-[220px] flex-1" />
        <select name="estado" id="estado" defaultValue={sp.estado || ''}><option value="">Activas y pausadas</option><option value="active">Activas</option><option value="paused">Pausadas</option></select>
        <button className="rounded-lg border border-line bg-panel2 px-3 font-semibold">Filtrar</button>
      </form>
      <Tarjeta titulo={`${lista.length} publicaciones${sinCosto ? ` · ${sinCosto} sin costo` : ''}`}>
        {lista.length ? (
          <div className="overflow-x-auto"><table>
            <thead><tr><th>Publicación</th><th className="r">Precio</th><th className="r">Stock</th><th className="r">Vend. 30d</th><th className="r">Comisión</th><th className="r">Envío</th><th className="r">Costo</th><th className="r">Ganancia/u</th></tr></thead>
            <tbody>{lista.map((p) => (
              <tr key={p.itemId}>
                <td className="min-w-[260px]">
                  <div className="flex items-center gap-3">
                    {p.thumbnail ? <img src={p.thumbnail} alt="" className="h-10 w-10 shrink-0 rounded-md border border-line bg-white object-contain" /> : <div className="h-10 w-10 shrink-0 rounded-md bg-panel2" />}
                    <div className="min-w-0">
                      <a href={p.permalink} target="_blank" rel="noreferrer" className="line-clamp-2 font-medium hover:text-accent">{p.titulo}</a>
                      <div className="mt-0.5 flex flex-wrap gap-1.5 text-[11px] text-muted">
                        <span>{p.cuenta}</span><span>· {p.sku || p.itemId}</span><span>· {TIPO_PUB[p.tipo] || p.tipo}</span>
                        {p.catalogo && <Pill tono="accent">catálogo</Pill>}{p.logistica === 'fulfillment' && <Pill tono="ok">full</Pill>}{p.estado === 'paused' && <Pill tono="warn">pausada</Pill>}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="r num">{plata(p.precio)}</td>
                <td className={`r num ${p.stock === 0 ? 'font-bold text-bad' : p.stock <= 3 ? 'text-warn' : ''}`}>{p.stock}</td>
                <td className="r num">{p.ventas30}</td>
                <td className="r num text-[13px]">{p.comisionPct != null ? pct(p.comisionPct) : '–'}{p.comisionFija ? <div className="text-[11px] text-muted">+{plata(p.comisionFija)}</div> : null}</td>
                <td className="r num text-[13px]">{p.envio ? plata(p.envio) : '–'}</td>
                <td className="r"><CostoInline clave={p.claveCosto} costo={p.costo} /></td>
                <td className={`r num ${p.ganancia != null && p.ganancia < 0 ? 'font-bold text-bad' : ''}`}>{p.ganancia != null ? plata(p.ganancia) : '–'}<div className="text-[11px] text-muted">{pct(p.margen, 0)}</div></td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <Vacio>No hay publicaciones todavía. Se cargan solas una vez por hora (o tocá “Actualizar todo” en Configuración).</Vacio>}
      </Tarjeta>
      <Tarjeta titulo="Cargar muchos costos de una vez"><ImportarCostos /></Tarjeta>
    </>
  );
}
