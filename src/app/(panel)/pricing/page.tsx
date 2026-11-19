import { productos } from '@/lib/productos';
import { getConfig } from '@/lib/config';
import { Encabezado } from '@/components/ui';
import { Calculadora } from '@/components/Calculadora';
import { I } from '@/components/Iconos';

export default async function Pricing() {
  const [lista, cfg] = await Promise.all([productos({ estado: 'active' }), getConfig()]);
  const opciones = lista.slice(0, 500).map((p) => ({
    id: p.itemId, titulo: `${p.titulo} · ${p.cuenta}`, precio: p.precio, categoria: p.categoria, tipo: p.tipo,
    costo: p.costo, envio: p.envio, comisionPct: p.comisionPct, comisionFija: p.comisionFija,
  }));
  return (
    <>
      <Encabezado icono={I.precio} titulo="Pricing" sub="Calculá a qué precio vender para ganar lo que querés, en publicación Clásica y Premium (cuotas sin interés). Las comisiones salen de MercadoLibre en el momento." />
      <Calculadora productos={opciones} impuestosPct={Number(cfg.IMPUESTOS_PCT || 0)} />
    </>
  );
}
