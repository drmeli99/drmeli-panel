'use client';
import { useActionState, type ReactNode } from 'react';

/** Formulario con una server action que devuelve {msg}. */
export function FormSimple({ accion, children, boton, className = '' }: { accion: (s: unknown, f: FormData) => Promise<{ msg: string }>; children: ReactNode; boton: string; className?: string }) {
  const [estado, act, pend] = useActionState(accion, null);
  return (
    <form action={act} className={`flex flex-wrap items-center gap-2 ${className}`}>
      {children}
      <button disabled={pend} className="rounded-lg bg-accent px-3 py-1.5 text-[13px] font-semibold text-white disabled:opacity-50">{pend ? 'Un momento…' : boton}</button>
      {estado?.msg && <span className="basis-full text-[13px] text-muted">{estado.msg}</span>}
    </form>
  );
}
