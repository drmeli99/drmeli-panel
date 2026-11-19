'use client';
import { useActionState, useState } from 'react';
import { responderPregunta } from '@/app/acciones';

export function Responder({ id, cuentaId, rapidas }: { id: string; cuentaId: string; rapidas: string[] }) {
  const [estado, accion, pend] = useActionState(responderPregunta, null);
  const [texto, setTexto] = useState('');
  if (estado?.ok) return <div className="font-semibold text-ok">{estado.msg}</div>;
  return (
    <form action={accion} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} /><input type="hidden" name="cuentaId" value={cuentaId} />
      {rapidas.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {rapidas.map((r, i) => (
            <button key={i} type="button" onClick={() => setTexto(r)} className="max-w-full truncate rounded-full border border-line px-2.5 py-0.5 text-[12px] text-muted hover:border-accent hover:text-ink" title={r}>
              {r.length > 38 ? r.slice(0, 37) + '…' : r}
            </button>
          ))}
        </div>
      )}
      <textarea id={`r-${id}`} name="texto" rows={2} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escribí la respuesta…" maxLength={2000} />
      <div className="flex items-center gap-3">
        <button disabled={pend || texto.trim().length < 2} className="rounded-lg bg-accent px-3 py-1.5 text-[13px] font-semibold text-white disabled:opacity-50">{pend ? 'Enviando…' : 'Responder'}</button>
        {estado && !estado.ok && <span className="text-[13px] text-bad">{estado.msg}</span>}
      </div>
    </form>
  );
}
