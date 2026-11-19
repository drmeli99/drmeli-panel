import type { Pendiente } from '@/lib/tipos';
import { diaLindo } from '@/lib/tiempo';
import { Pill, Boton } from './ui';

export function ListaPendientes({ lista, corte, compacta = false }: { lista: Pendiente[]; corte: string; compacta?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      {lista.map((p) => {
        const cuando = p.estado === 'ATRASADO' ? 'Atrasado' : p.estado === 'HOY' ? (p.tipo === 'flex' ? `Hoy antes de ${corte}` : 'Hoy') : diaLindo(p.despacho);
        const barra = p.estado === 'ATRASADO' ? 'bg-bad' : p.estado === 'HOY' ? 'bg-warn' : 'bg-line';
        return (
          <div key={p.envioId} className="grid grid-cols-[5px_1fr] overflow-hidden rounded-xl border border-line bg-panel sm:grid-cols-[5px_1fr_auto]">
            <div className={barra} />
            <div className="flex min-w-0 flex-col gap-1 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2 text-[12px]">
                <Pill tono={p.estado === 'ATRASADO' ? 'bad' : p.estado === 'HOY' ? 'warn' : 'gris'}>{cuando}</Pill>
                <Pill tono="borde">{p.tipoTexto}</Pill>
                <span className="font-semibold">{p.cuenta}</span>
              </div>
              <div className="font-semibold [overflow-wrap:anywhere]">{p.items.map((i) => (i.cant > 1 ? `${i.cant}× ` : '') + i.titulo).join(' + ')}</div>
              {!compacta && (
                <div className="text-[13px] text-muted [overflow-wrap:anywhere]">
                  {[p.receptor ? `Para ${p.receptor}` : p.comprador && `Comprador ${p.comprador}`, p.zona, p.ordenes.length > 1 && `${p.ordenes.length} ventas en un paquete`].filter(Boolean).join(' · ')}
                </div>
              )}
            </div>
            <div className="flex items-center px-4 pb-3 sm:pb-0 sm:pl-0"><Boton href={p.link}>Ver venta</Boton></div>
          </div>
        );
      })}
    </div>
  );
}
