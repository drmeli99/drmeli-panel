'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type It = { id: string; cuentaId: string; cuenta: string; titulo: string; precio: number; stock: number; estado: string; sku: string; thumbnail: string; catalogo: boolean; variaciones: boolean; costo: number | null; comisionPct: number | null; comisionFija: number; envio: number };
type Res = { itemId: string; ok: boolean; detalle: string; nuevoId?: string };
type Modo = 'precio' | 'stock' | 'estado' | 'clonar';

const plata = (n: number) => '$ ' + Math.round(n || 0).toLocaleString('es-AR');
const n = (s: string) => Number(String(s).replace(',', '.'));

function redondear(p: number, modo: string) {
  if (modo === '99') return Math.max(99, Math.round(p / 100) * 100 - 1);
  if (modo === '00') return Math.round(p / 100) * 100;
  return Math.round(p);
}

export function Masivo({ cuentas, items }: { cuentas: { id: string; nombre: string }[]; items: It[] }) {
  const router = useRouter();
  const [tienda, setTienda] = useState('');
  const [buscar, setBuscar] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [modo, setModo] = useState<Modo>('precio');
  const [tipoPrecio, setTipoPrecio] = useState<'pct' | 'fijo'>('pct');
  const [valor, setValor] = useState('10');
  const [red, setRed] = useState('99');
  const [stock, setStock] = useState('10');
  const [estado, setEstado] = useState<'paused' | 'active'>('paused');
  const [destino, setDestino] = useState('');
  const [ajuste, setAjuste] = useState('0');
  const [stockClon, setStockClon] = useState('');
  const [corriendo, setCorriendo] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [resultados, setResultados] = useState<Res[]>([]);
  const [confirmar, setConfirmar] = useState(false);

  const visibles = useMemo(() => items.filter((i) => (!tienda || i.cuentaId === tienda) &&
    (!buscar || (i.titulo + i.sku + i.id).toLowerCase().includes(buscar.toLowerCase()))), [items, tienda, buscar]);
  const elegidos = items.filter((i) => sel.has(i.id));
  const todos = visibles.length > 0 && visibles.every((i) => sel.has(i.id));

  const nuevoPrecio = (i: It) => {
    const v = n(valor);
    if (!isFinite(v)) return i.precio;
    return redondear(tipoPrecio === 'pct' ? i.precio * (1 + v / 100) : v, red);
  };
  const margen = (i: It, p: number) => i.costo == null || i.comisionPct == null ? null : (p - p * i.comisionPct - i.comisionFija - i.envio - i.costo) / p;

  async function ejecutar() {
    setConfirmar(false); setCorriendo(true); setResultados([]); setProgreso(0);
    const out: Res[] = [];
    try {
      if (modo === 'clonar') {
        const ops = elegidos.filter((i) => i.cuentaId !== destino).map((i) => ({ itemId: i.id, origenId: i.cuentaId, destinoId: destino, ajustePct: n(ajuste) || 0, stock: stockClon ? n(stockClon) : undefined }));
        for (let k = 0; k < ops.length; k += 5) {
          const r = await fetch('/api/masivo/clonar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ops: ops.slice(k, k + 5) }) }).then((x) => x.json());
          out.push(...(r.resultados || ops.slice(k, k + 5).map((o) => ({ itemId: o.itemId, ok: false, detalle: r.error || 'Error' }))));
          setResultados([...out]); setProgreso(Math.min(ops.length, k + 5) / ops.length);
        }
      } else {
        const cambios = elegidos.map((i) => ({
          itemId: i.id, cuentaId: i.cuentaId,
          ...(modo === 'precio' ? { precio: nuevoPrecio(i) } : modo === 'stock' ? { stock: n(stock) } : { estado }),
        }));
        for (let k = 0; k < cambios.length; k += 25) {
          const r = await fetch('/api/masivo/editar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cambios: cambios.slice(k, k + 25) }) }).then((x) => x.json());
          out.push(...(r.resultados || cambios.slice(k, k + 25).map((c) => ({ itemId: c.itemId, ok: false, detalle: r.error || 'Error' }))));
          setResultados([...out]); setProgreso(Math.min(cambios.length, k + 25) / cambios.length);
        }
      }
    } finally {
      setCorriendo(false); router.refresh();
    }
  }

  const listo = elegidos.length > 0 && !(modo === 'clonar' && !destino);
  const accionTxt = modo === 'precio' ? `Cambiar precio de ${elegidos.length}` : modo === 'stock' ? `Poner stock ${stock} en ${elegidos.length}` : modo === 'estado' ? `${estado === 'paused' ? 'Pausar' : 'Activar'} ${elegidos.length}` : `Copiar ${elegidos.length} a ${cuentas.find((c) => c.id === destino)?.nombre || '…'}`;

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <section className="min-w-0 rounded-xl border border-line bg-panel">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <input id="buscar" value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar…" className="min-w-[180px] flex-1" />
          <select id="tienda" value={tienda} onChange={(e) => setTienda(e.target.value)}><option value="">Todas las tiendas</option>{cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select>
          <span className="text-[13px] text-muted">{sel.size} elegidas</span>
          {sel.size > 0 && <button onClick={() => setSel(new Set())} className="text-[13px] text-accent">limpiar</button>}
        </div>
        <div className="max-h-[620px] overflow-auto">
          <table>
            <thead className="sticky top-0 z-10 bg-panel"><tr>
              <th><input type="checkbox" aria-label="Elegir todas" checked={todos} onChange={() => { const s = new Set(sel); visibles.forEach((i) => (todos ? s.delete(i.id) : s.add(i.id))); setSel(s); }} /></th>
              <th>Publicación</th><th className="r">Precio</th>{modo === 'precio' && <th className="r">Nuevo</th>}<th className="r">Stock</th>
            </tr></thead>
            <tbody>{visibles.slice(0, 400).map((i) => {
              const np = nuevoPrecio(i), m = margen(i, np);
              return (
                <tr key={i.id} className={sel.has(i.id) ? 'bg-accent/5' : ''} onClick={() => { const s = new Set(sel); s.has(i.id) ? s.delete(i.id) : s.add(i.id); setSel(s); }}>
                  <td><input type="checkbox" checked={sel.has(i.id)} readOnly aria-label={`Elegir ${i.titulo}`} /></td>
                  <td className="min-w-[240px] cursor-pointer">
                    <div className="line-clamp-1 font-medium">{i.titulo}</div>
                    <div className="text-[11px] text-muted">{i.cuenta} · {i.sku || i.id}{i.estado === 'paused' ? ' · pausada' : ''}{i.catalogo ? ' · catálogo' : ''}{i.variaciones ? ' · con variantes' : ''}</div>
                  </td>
                  <td className="r num">{plata(i.precio)}</td>
                  {modo === 'precio' && <td className={`r num ${sel.has(i.id) ? 'text-accent' : 'text-muted'}`}>{plata(np)}{m != null && <div className={`text-[11px] ${m < 0 ? 'text-bad' : 'text-muted'}`}>margen {(m * 100).toFixed(0)}%</div>}</td>}
                  <td className={`r num ${i.stock === 0 ? 'text-bad' : ''}`}>{i.stock}</td>
                </tr>
              );
            })}</tbody>
          </table>
          {visibles.length > 400 && <p className="p-3 text-[12px] text-muted">Mostrando 400 de {visibles.length}. Usá el buscador para filtrar.</p>}
        </div>
      </section>

      <aside className="flex flex-col gap-4 rounded-xl border border-line bg-panel p-4 xl:sticky xl:top-4 xl:self-start">
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-panel2 p-1">
          {([['precio', 'Precio'], ['stock', 'Stock'], ['estado', 'Pausar/activar'], ['clonar', 'Copiar a tienda']] as [Modo, string][]).map(([k, l]) => (
            <button key={k} onClick={() => setModo(k)} className={`rounded-md px-2 py-1.5 text-[13px] font-semibold ${modo === k ? 'bg-accent text-white' : 'text-muted'}`}>{l}</button>
          ))}
        </div>

        {modo === 'precio' && (
          <div className="flex flex-col gap-3">
            <div className="flex gap-2 text-[13px]">
              <label className="flex items-center gap-1.5"><input type="radio" checked={tipoPrecio === 'pct'} onChange={() => setTipoPrecio('pct')} /> Subir/bajar %</label>
              <label className="flex items-center gap-1.5"><input type="radio" checked={tipoPrecio === 'fijo'} onChange={() => setTipoPrecio('fijo')} /> Precio fijo</label>
            </div>
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold">{tipoPrecio === 'pct' ? 'Porcentaje (negativo para bajar)' : 'Nuevo precio'}
              <input id="valor" value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" className="num" /></label>
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Redondeo
              <select id="red" value={red} onChange={(e) => setRed(e.target.value)}><option value="99">Terminar en 99 ($12.499)</option><option value="00">Terminar en 00 ($12.500)</option><option value="no">Sin redondeo</option></select></label>
            <p className="text-[12px] text-muted">La tabla muestra el precio nuevo y el margen que te queda.</p>
          </div>
        )}
        {modo === 'stock' && (
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Stock para todas<input id="stock" value={stock} onChange={(e) => setStock(e.target.value)} inputMode="numeric" className="num" />
            <span className="font-normal text-muted">Las publicaciones con variantes se saltean (el stock va por variante).</span></label>
        )}
        {modo === 'estado' && (
          <div className="flex flex-col gap-2 text-[13px]">
            <label className="flex items-center gap-2"><input type="radio" checked={estado === 'paused'} onChange={() => setEstado('paused')} /> Pausar</label>
            <label className="flex items-center gap-2"><input type="radio" checked={estado === 'active'} onChange={() => setEstado('active')} /> Activar</label>
          </div>
        )}
        {modo === 'clonar' && (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Copiar a la tienda
              <select id="destino" value={destino} onChange={(e) => setDestino(e.target.value)}><option value="">Elegí…</option>{cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></label>
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Ajuste de precio %<input id="ajuste" value={ajuste} onChange={(e) => setAjuste(e.target.value)} className="num" /></label>
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Stock (vacío = el mismo)<input id="stockClon" value={stockClon} onChange={(e) => setStockClon(e.target.value)} className="num" /></label>
            <p className="text-[12px] text-muted">Copia título, fotos, atributos, variantes y descripción. Las de catálogo no se copian: copiá la publicación original. Las que ya están en la tienda destino se saltean.</p>
          </div>
        )}

        {!confirmar ? (
          <button disabled={!listo || corriendo} onClick={() => setConfirmar(true)} className="rounded-lg bg-accent py-2 font-semibold text-white disabled:opacity-40">{corriendo ? `Procesando… ${Math.round(progreso * 100)}%` : accionTxt}</button>
        ) : (
          <div className="flex flex-col gap-2 rounded-lg border border-warn/40 bg-warn/10 p-3 text-[13px]">
            <b className="text-warn">¿Confirmás? Se cambia directo en MercadoLibre.</b>
            <span>{accionTxt}.</span>
            <div className="flex gap-2"><button onClick={ejecutar} className="flex-1 rounded-lg bg-accent py-1.5 font-semibold text-white">Sí, hacerlo</button><button onClick={() => setConfirmar(false)} className="flex-1 rounded-lg border border-line py-1.5">Cancelar</button></div>
          </div>
        )}

        {resultados.length > 0 && (
          <div className="flex flex-col gap-1 text-[12px]">
            <b>{resultados.filter((r) => r.ok).length} bien · {resultados.filter((r) => !r.ok).length} con error</b>
            <ul className="max-h-60 overflow-auto">{resultados.map((r, k) => (
              <li key={k} className={r.ok ? 'text-ok' : 'text-bad'}>{r.ok ? '✓' : '✗'} {r.itemId}: {r.detalle}{r.nuevoId ? ` (${r.nuevoId})` : ''}</li>))}</ul>
          </div>
        )}
      </aside>
    </div>
  );
}
