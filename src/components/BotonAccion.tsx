'use client';
import { useTransition, type ReactNode } from 'react';

/** Botón que ejecuta una server action y muestra "trabajando…". */
export function BotonAccion({ accion, children, trabajando = 'Actualizando…', tono = 'normal' }: { accion: () => Promise<unknown>; children: ReactNode; trabajando?: string; tono?: 'normal' | 'pri' }) {
  const [pend, start] = useTransition();
  return (
    <button type="button" disabled={pend} onClick={() => start(async () => { await accion(); })}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold whitespace-nowrap disabled:opacity-60 ${tono === 'pri' ? 'bg-accent text-white' : 'border border-line bg-panel2 hover:border-accent/60'}`}>
      {pend ? trabajando : children}
    </button>
  );
}
