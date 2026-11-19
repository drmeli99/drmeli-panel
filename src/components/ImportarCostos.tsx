'use client';
import { useActionState } from 'react';
import { importarCostos } from '@/app/acciones';

export function ImportarCostos() {
  const [estado, accion, pend] = useActionState(importarCostos, null);
  return (
    <form action={accion} className="flex flex-col gap-2 p-4">
      <label htmlFor="csv" className="text-[13px] text-muted">Pegá desde Excel o Google Sheets: una fila por producto con <b className="text-ink">SKU (o código MLA)</b> y <b className="text-ink">costo</b>.</label>
      <textarea id="csv" name="csv" rows={4} placeholder={'VAS-350;7000\nLAM-LED1;12000'} className="num" />
      <div className="flex items-center gap-3">
        <button disabled={pend} className="rounded-lg bg-accent px-3 py-1.5 text-[13px] font-semibold text-white disabled:opacity-50">{pend ? 'Cargando…' : 'Cargar costos'}</button>
        {estado && <span className="text-[13px] text-muted">{estado.msg}</span>}
      </div>
    </form>
  );
}
