'use client';
import { useActionState, useState, useTransition } from 'react';
import { guardarConfig, probarAlertas } from '@/app/acciones';

type Campo = { k: string; label: string; ayuda?: string; tipo?: 'text' | 'password' | 'si-no' | 'area'; ph?: string };

export function FormConfig({ valores, grupos }: { valores: Record<string, string>; grupos: { titulo: string; campos: Campo[] }[] }) {
  const [estado, accion, pend] = useActionState(guardarConfig, null);
  return (
    <form action={accion} className="flex flex-col gap-5">
      {grupos.map((g) => (
        <section key={g.titulo} className="rounded-xl border border-line bg-panel">
          <h2 className="border-b border-line px-4 py-3 font-semibold">{g.titulo}</h2>
          <div className="grid gap-4 p-4 md:grid-cols-2">
            {g.campos.map((c) => (
              <label key={c.k} htmlFor={c.k} className={`flex min-w-0 flex-col gap-1.5 ${c.tipo === 'area' ? 'md:col-span-2' : ''}`}>
                <span className="text-[13px] font-semibold">{c.label}</span>
                {c.tipo === 'si-no' ? (
                  <select id={c.k} name={c.k} defaultValue={valores[c.k]}><option value="SI">Sí</option><option value="NO">No</option></select>
                ) : c.tipo === 'area' ? (
                  <textarea id={c.k} name={c.k} rows={3} defaultValue={valores[c.k]} placeholder={c.ph} />
                ) : (
                  <input id={c.k} name={c.k} type={c.tipo === 'password' ? 'password' : 'text'} defaultValue={valores[c.k]} placeholder={c.ph} autoComplete="off" />
                )}
                {c.ayuda && <span className="text-[12px] text-muted">{c.ayuda}</span>}
              </label>
            ))}
          </div>
        </section>
      ))}
      <div className="sticky bottom-3 flex items-center gap-3 rounded-xl border border-line bg-panel/95 p-3 backdrop-blur">
        <button disabled={pend} className="rounded-lg bg-accent px-4 py-2 font-semibold text-white disabled:opacity-50">{pend ? 'Guardando…' : 'Guardar cambios'}</button>
        {estado?.msg && <span className="text-ok">{estado.msg}</span>}
      </div>
    </form>
  );
}

export function ProbarAlertas() {
  const [res, setRes] = useState('');
  const [pend, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" disabled={pend} onClick={() => start(async () => setRes(await probarAlertas()))} className="rounded-lg border border-line bg-panel2 px-3 py-1.5 text-[13px] font-semibold">{pend ? 'Enviando…' : 'Mandar alerta de prueba'}</button>
      {res && <span className="text-[13px] text-muted">{res}</span>}
    </div>
  );
}

export function Copiar({ texto }: { texto: string }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="flex min-w-0 items-center gap-2">
      <code className="num min-w-0 flex-1 select-all overflow-x-auto whitespace-nowrap rounded-md bg-panel2 px-2 py-1.5 text-[12px]">{texto}</code>
      <button type="button" className="shrink-0 rounded-md border border-line px-2 py-1 text-[12px]" onClick={() => navigator.clipboard.writeText(texto).then(() => { setOk(true); setTimeout(() => setOk(false), 1500); }).catch(() => {})}>{ok ? 'Copiado' : 'Copiar'}</button>
    </div>
  );
}
