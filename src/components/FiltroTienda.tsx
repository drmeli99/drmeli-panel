'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export function FiltroTienda({ cuentas }: { cuentas: { id: string; nombre: string }[] }) {
  const router = useRouter(), ruta = usePathname(), sp = useSearchParams();
  if (cuentas.length < 2) return null;
  const actual = sp.get('t') || '';
  const ir = (id: string) => {
    const q = new URLSearchParams(sp.toString());
    if (id) q.set('t', id); else q.delete('t');
    router.push(`${ruta}${q.toString() ? '?' + q : ''}`);
  };
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por tienda">
      {[{ id: '', nombre: 'Todas' }, ...cuentas].map((c) => (
        <button key={c.id} onClick={() => ir(c.id)} aria-pressed={actual === c.id}
          className={`rounded-full border px-3 py-1 text-[12px] font-semibold ${actual === c.id ? 'border-accent bg-accent text-white' : 'border-line bg-panel text-muted hover:text-ink'}`}>
          {c.nombre}
        </button>
      ))}
    </div>
  );
}
