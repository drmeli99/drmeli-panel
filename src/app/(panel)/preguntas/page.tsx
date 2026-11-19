import { operacionTotal } from '@/lib/sync';
import { getConfig } from '@/lib/config';
import { listaCuentas, deTienda } from '@/lib/datos';
import { db } from '@/lib/db';
import { tiempo, plata } from '@/lib/tiempo';
import { Encabezado, Tarjeta, Vacio, Pill } from '@/components/ui';
import { FiltroTienda } from '@/components/FiltroTienda';
import { Responder } from '@/components/Responder';
import { BotonAccion } from '@/components/BotonAccion';
import { actualizarAhora } from '@/app/acciones';
import { I } from '@/components/Iconos';

export default async function Preguntas({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  const [op, cfg, cs] = await Promise.all([operacionTotal(), getConfig(), listaCuentas()]);
  const preg = op.preguntas.filter(deTienda(t));
  const sql = await db();
  const ids = [...new Set(preg.map((q) => q.itemId))];
  const items = new Map((ids.length ? await sql`select item_id, precio, stock, thumbnail, permalink from items where item_id in ${sql(ids)}` : []).map((r) => [r.item_id, r]));
  const rapidas = cfg.RESPUESTAS_RAPIDAS.split('|').map((x) => x.trim()).filter(Boolean);
  return (
    <>
      <Encabezado icono={I.pregunta} titulo="Preguntas sin responder" sub="Respondé desde acá sin entrar a cada tienda. Las respuestas rápidas se editan en Configuración.">
        <BotonAccion accion={actualizarAhora} tono="pri">Actualizar</BotonAccion>
      </Encabezado>
      <FiltroTienda cuentas={cs.map((c) => ({ id: c.id, nombre: c.nombre }))} />
      {!preg.length && <Tarjeta><Vacio>No hay preguntas pendientes. 🎉</Vacio></Tarjeta>}
      {preg.map((q) => {
        const it = items.get(q.itemId);
        return (
          <Tarjeta key={q.id}>
            <div className="flex flex-col gap-3 p-4 sm:flex-row">
              {it?.thumbnail && <img src={it.thumbnail} alt="" className="h-16 w-16 shrink-0 rounded-lg border border-line bg-white object-contain" />}
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted">
                  <Pill tono={q.minutos >= Number(cfg.PREGUNTA_DEMORA_MIN) ? 'warn' : 'accent'}>hace {tiempo(q.minutos)}</Pill>
                  <span className="font-semibold text-ink">{q.cuenta}</span>
                  <a href={it?.permalink || '#'} target="_blank" rel="noreferrer" className="truncate hover:text-accent">{q.producto}</a>
                  {it && <span className="num">· {plata(it.precio)} · stock {it.stock}</span>}
                </div>
                <div className="text-[15px] font-semibold">“{q.texto}”</div>
                <Responder id={q.id} cuentaId={q.cuentaId} rapidas={rapidas} />
              </div>
            </div>
          </Tarjeta>
        );
      })}
    </>
  );
}
