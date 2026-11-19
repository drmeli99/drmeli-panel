'use client';
import { useEffect, useMemo, useState } from 'react';

type Prod = { id: string; titulo: string; precio: number; categoria: string; tipo: string; costo: number | null; envio: number; comisionPct: number | null; comisionFija: number };
type Fee = { pct: number; fija: number; total: number; nombre: string } | null;

const plata = (n: number) => '$ ' + Math.round(n || 0).toLocaleString('es-AR');
const num = (s: string) => Number(String(s).replace(/\./g, '').replace(',', '.')) || 0;

/** Precio que deja `margen` (0..1) de ganancia, con comisión pct+fija, envío, costo e impuestos. */
function precioPara(margen: number, f: { pct: number; fija: number }, costo: number, envio: number, imp: number) {
  const d = 1 - f.pct - imp - margen;
  return d > 0 ? (costo + envio + f.fija) / d : NaN;
}

export function Calculadora({ productos, impuestosPct }: { productos: Prod[]; impuestosPct: number }) {
  const [sel, setSel] = useState('');
  const [titulo, setTitulo] = useState('');
  const [categoria, setCategoria] = useState('');
  const [cats, setCats] = useState<{ id: string; nombre: string }[]>([]);
  const [precio, setPrecio] = useState('');
  const [costo, setCosto] = useState('');
  const [envio, setEnvio] = useState('0');
  const [imp, setImp] = useState(String(impuestosPct));
  const [objetivo, setObjetivo] = useState('20');
  const [fees, setFees] = useState<{ clasica: Fee; premium: Fee } | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  const p = productos.find((x) => x.id === sel);
  useEffect(() => {
    if (!p) return;
    setPrecio(String(p.precio)); setCategoria(p.categoria); setCosto(p.costo != null ? String(p.costo) : '');
    setEnvio(String(Math.round(p.envio || 0))); setCats([]);
  }, [sel]); // eslint-disable-line react-hooks/exhaustive-deps

  const pr = num(precio);
  useEffect(() => {
    if (!pr || !categoria) { setFees(null); return; }
    const t = setTimeout(async () => {
      setCargando(true); setError('');
      try {
        const r = await fetch(`/api/pricing?precio=${pr}&categoria=${categoria}`).then((x) => x.json());
        if (r.error) throw new Error(r.error);
        setFees(r);
      } catch (e) { setError('No se pudo consultar la comisión: ' + (e as Error).message); setFees(null); }
      setCargando(false);
    }, 400);
    return () => clearTimeout(t);
  }, [pr, categoria]);

  async function buscarCategoria() {
    if (!titulo.trim()) return;
    const r = await fetch(`/api/pricing?titulo=${encodeURIComponent(titulo)}`).then((x) => x.json());
    setCats(r.categorias || []);
    if (r.categorias?.[0]) setCategoria(r.categorias[0].id);
  }

  const c = num(costo), e = num(envio), i = num(imp) / 100, m = num(objetivo) / 100;
  const filas = useMemo(() => (['clasica', 'premium'] as const).map((k) => {
    const f = fees?.[k];
    if (!f) return { k, f: null };
    const comision = f.total;
    const ganancia = pr - comision - e - c - pr * i;
    return { k, f, comision, ganancia, margen: pr ? ganancia / pr : 0, sugerido: precioPara(m, f, c, e, i), equilibrio: precioPara(0, f, c, e, i) };
  }), [fees, pr, c, e, i, m]);

  return (
    <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
      <section className="flex flex-col gap-3 rounded-xl border border-line bg-panel p-4">
        <label className="flex flex-col gap-1.5"><span className="text-[13px] font-semibold">Partir de una publicación tuya</span>
          <select id="sel" value={sel} onChange={(x) => setSel(x.target.value)}>
            <option value="">— Producto nuevo —</option>
            {productos.map((x) => <option key={x.id} value={x.id}>{x.titulo.slice(0, 70)}</option>)}
          </select>
        </label>
        {!sel && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold">¿Qué vas a vender? (para saber la categoría)</span>
            <div className="flex gap-2"><input id="titulo" value={titulo} onChange={(x) => setTitulo(x.target.value)} placeholder="Ej: termo acero 1 litro" className="flex-1" />
              <button type="button" onClick={buscarCategoria} className="rounded-lg border border-line bg-panel2 px-3 text-[13px] font-semibold">Buscar</button></div>
            {cats.length > 0 && <select id="cat" value={categoria} onChange={(x) => setCategoria(x.target.value)}>{cats.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}</select>}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Campo id="precio" label="Precio de venta" v={precio} set={setPrecio} pre="$" />
          <Campo id="costo" label="Costo del producto" v={costo} set={setCosto} pre="$" />
          <Campo id="envio" label="Envío que pagás" v={envio} set={setEnvio} pre="$" ayuda="Por unidad. En Flex suele ser 0." />
          <Campo id="imp" label="Impuestos" v={imp} set={setImp} suf="%" ayuda="IIBB, retenciones, etc." />
        </div>
        <Campo id="obj" label="Ganancia que querés" v={objetivo} set={setObjetivo} suf="% del precio" />
        {error && <p className="text-[13px] text-bad">{error}</p>}
        {!categoria && <p className="text-[13px] text-muted">Elegí una publicación o buscá la categoría para traer la comisión real.</p>}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {filas.map((x) => (
          <section key={x.k} className="flex flex-col gap-3 rounded-xl border border-line bg-panel p-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold">{x.k === 'clasica' ? 'Clásica' : 'Premium'}</h2>
              <span className="text-[12px] text-muted">{x.k === 'premium' ? 'con cuotas sin interés' : 'sin cuotas'}</span>
              {p && p.tipo === (x.k === 'clasica' ? 'gold_special' : 'gold_pro') && <span className="ml-auto rounded-full bg-accent/20 px-2 py-0.5 text-[11px] font-bold text-accent">ACTUAL</span>}
            </div>
            {cargando && <p className="text-muted">Consultando comisión…</p>}
            {!cargando && !x.f && <p className="text-muted">Sin datos de comisión.</p>}
            {x.f && 'ganancia' in x && (
              <>
                <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 text-[14px]">
                  <dt className="text-muted">Precio</dt><dd className="num text-right">{plata(pr)}</dd>
                  <dt className="text-muted">Comisión MeLi ({(x.f.pct * 100).toFixed(1)}%{x.f.fija ? ` + ${plata(x.f.fija)}` : ''})</dt><dd className="num text-right text-bad">−{plata(x.comision!)}</dd>
                  <dt className="text-muted">Envío</dt><dd className="num text-right text-bad">−{plata(e)}</dd>
                  <dt className="text-muted">Impuestos</dt><dd className="num text-right text-bad">−{plata(pr * i)}</dd>
                  <dt className="text-muted">Costo</dt><dd className="num text-right text-bad">−{plata(c)}</dd>
                  <dt className="border-t border-line pt-1.5 font-semibold">Te queda</dt>
                  <dd className={`num border-t border-line pt-1.5 text-right text-lg font-semibold ${x.ganancia! < 0 ? 'text-bad' : 'text-ok'}`}>{plata(x.ganancia!)} <span className="text-[13px]">({(x.margen! * 100).toFixed(1)}%)</span></dd>
                </dl>
                <div className="grid grid-cols-2 gap-2 rounded-lg bg-panel2 p-3">
                  <div><div className="text-[11px] font-semibold uppercase tracking-wider text-muted">Para ganar {objetivo}%</div><div className="num text-lg font-semibold text-accent">{isFinite(x.sugerido!) ? plata(Math.ceil(x.sugerido! / 10) * 10) : 'imposible'}</div></div>
                  <div><div className="text-[11px] font-semibold uppercase tracking-wider text-muted">Precio mínimo (sin pérdida)</div><div className="num text-lg font-semibold">{isFinite(x.equilibrio!) ? plata(Math.ceil(x.equilibrio!)) : '–'}</div></div>
                </div>
                <p className="text-[12px] text-muted">La comisión cambia con el precio: si cambiás mucho el precio, ponelo arriba y se recalcula.</p>
              </>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

function Campo({ id, label, v, set, pre, suf, ayuda }: { id: string; label: string; v: string; set: (s: string) => void; pre?: string; suf?: string; ayuda?: string }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5" htmlFor={id}>
      <span className="text-[13px] font-semibold">{label}</span>
      <div className="flex items-center gap-1.5">{pre && <span className="text-muted">{pre}</span>}<input id={id} inputMode="decimal" value={v} onChange={(x) => set(x.target.value)} className="num w-full" />{suf && <span className="whitespace-nowrap text-[12px] text-muted">{suf}</span>}</div>
      {ayuda && <span className="text-[11px] text-muted">{ayuda}</span>}
    </label>
  );
}
