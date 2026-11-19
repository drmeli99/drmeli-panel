import { operacionTotal } from '@/lib/sync';
import { getConfig } from '@/lib/config';
import { listaCuentas, deTienda } from '@/lib/datos';
import { hace } from '@/lib/tiempo';
import { Encabezado, Tarjeta, Vacio, Tabs } from '@/components/ui';
import { FiltroTienda } from '@/components/FiltroTienda';
import { ListaPendientes } from '@/components/Pendientes';
import { BotonAccion } from '@/components/BotonAccion';
import { actualizarAhora } from '@/app/acciones';
import { I } from '@/components/Iconos';

export default async function Despachos({ searchParams }: { searchParams: Promise<{ t?: string; tipo?: string }> }) {
  const { t, tipo = 'todos' } = await searchParams;
  const [op, cfg, cs] = await Promise.all([operacionTotal(), getConfig(), listaCuentas()]);
  const todos = op.pendientes.filter(deTienda(t));
  const lista = tipo === 'todos' ? todos : todos.filter((p) => p.tipo === tipo);
  const hoy = lista.filter((p) => p.estado !== 'PROXIMO'), prox = lista.filter((p) => p.estado === 'PROXIMO');
  const q = (x: string) => `/despachos?tipo=${x}${t ? `&t=${t}` : ''}`;
  return (
    <>
      <Encabezado icono={I.envio} titulo="Despachos" sub={`Corte Flex ${cfg.FLEX_CORTE}. Se actualiza solo cada 5 minutos${op.actualizado ? ` (último: hace ${hace(op.actualizado)})` : ''}. Un envío sale de esta lista cuando MeLi lo marca como despachado.`}>
        <BotonAccion accion={actualizarAhora} tono="pri">Actualizar</BotonAccion>
      </Encabezado>
      <FiltroTienda cuentas={cs.map((c) => ({ id: c.id, nombre: c.nombre }))} />
      <Tabs activa={tipo} tabs={[
        { id: 'todos', label: 'Todos', href: q('todos'), n: todos.length },
        { id: 'flex', label: 'Flex', href: q('flex'), n: todos.filter((p) => p.tipo === 'flex').length },
        { id: 'colecta', label: 'Colecta', href: q('colecta'), n: todos.filter((p) => p.tipo === 'colecta').length },
        { id: 'correo', label: 'Correo / punto', href: q('correo'), n: todos.filter((p) => p.tipo === 'correo').length },
      ]} />
      <Tarjeta titulo={`Hoy y atrasados · ${hoy.length}`}><div className="p-3">{hoy.length ? <ListaPendientes lista={hoy} corte={cfg.FLEX_CORTE} /> : <Vacio>Nada para despachar hoy.</Vacio>}</div></Tarjeta>
      <Tarjeta titulo={`Próximos días · ${prox.length}`}><div className="p-3">{prox.length ? <ListaPendientes lista={prox} corte={cfg.FLEX_CORTE} /> : <Vacio>Nada programado.</Vacio>}</div></Tarjeta>
    </>
  );
}
