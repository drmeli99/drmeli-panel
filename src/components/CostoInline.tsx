'use client';
import { useState, useTransition } from 'react';
import { guardarCosto } from '@/app/acciones';

export function CostoInline({ clave, costo }: { clave: string; costo: number | null }) {
  const [v, setV] = useState(costo == null ? '' : String(costo));
  const [pend, start] = useTransition();
  const [ok, setOk] = useState(false);
  const cambiado = v !== (costo == null ? '' : String(costo));
  return (
    <form className="flex items-center justify-end gap-1" action={(f) => start(async () => { await guardarCosto(f); setOk(true); setTimeout(() => setOk(false), 1500); })}>
      <input type="hidden" name="clave" value={clave} />
      <input name="costo" inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} placeholder="cargar" aria-label={`Costo de ${clave}`}
        className={`num w-24 text-right ${costo == null ? 'border-warn/50' : ''}`} />
      {cambiado && <button disabled={pend} className="rounded-md bg-accent px-2 py-1 text-[12px] font-semibold text-white">{pend ? '…' : 'OK'}</button>}
      {ok && !cambiado && <span className="text-[12px] text-ok">✓</span>}
    </form>
  );
}
