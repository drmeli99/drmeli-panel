import { productos } from '@/lib/productos';
import { listaCuentas } from '@/lib/datos';
import { db } from '@/lib/db';
import { Encabezado, Tarjeta, Pill } from '@/components/ui';
import { Masivo } from '@/components/Masivo';
import { TZ } from '@/lib/tiempo';
import { I } from '@/components/Iconos';

export default async function MasivoPage() {
  const [lista, cs] = await Promise.all([productos(), listaCuentas()]);
  const sql = await db();
  const log = await sql`select a.*, c.nickname from acciones_masivas a left join cuentas c on c.user_id = a.cuenta_id order by a.id desc limit 40`;
  return (
    <>
      <Encabezado icono={I.masivo} titulo="Publicaciones masivas" sub="Cambiá precio, stock o estado de muchas publicaciones a la vez, o copiá publicaciones de una tienda a otra para escalar." />
      <Masivo
        cuentas={cs.map((c) => ({ id: c.id, nombre: c.nombre }))}
        items={lista.map((p) => ({ id: p.itemId, cuentaId: p.cuentaId, cuenta: p.cuenta, titulo: p.titulo, precio: p.precio, stock: p.stock, estado: p.estado, sku: p.sku, thumbnail: p.thumbnail, catalogo: p.catalogo, variaciones: p.variaciones, costo: p.costo, comisionPct: p.comisionPct, comisionFija: p.comisionFija, envio: p.envio }))}
      />
      <Tarjeta titulo="Últimas acciones">
        <div className="max-h-80 overflow-auto"><table>
          <thead><tr><th>Cuándo</th><th>Acción</th><th>Publicación</th><th>Resultado</th></tr></thead>
          <tbody>{log.map((l) => (
            <tr key={l.id}>
              <td className="whitespace-nowrap text-[12px] text-muted">{new Date(l.fecha).toLocaleString('es-AR', { timeZone: TZ, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
              <td>{l.tipo}{l.nickname ? <span className="text-[12px] text-muted"> · {l.nickname}</span> : null}</td>
              <td className="num text-[12px]">{l.item_id}</td>
              <td className="text-[13px]"><Pill tono={l.ok ? 'ok' : 'bad'}>{l.ok ? 'ok' : 'error'}</Pill> {l.detalle}</td>
            </tr>))}</tbody>
        </table></div>
      </Tarjeta>
    </>
  );
}
