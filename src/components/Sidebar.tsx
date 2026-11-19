'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { I } from './Iconos';

type Item = { href: string; label: string; icono: ReactNode; badge?: number; badgeTono?: 'bad' | 'accent'; hijos?: { href: string; label: string; badge?: number }[] };

export function Sidebar({ despachos, urgentes, preguntas, vigilados }: { despachos: number; urgentes: number; preguntas: number; vigilados: number }) {
  const ruta = usePathname();
  const sp = useSearchParams();
  const [abierto, setAbierto] = useState(false);
  const t = sp.get('t');
  const conT = (h: string) => (t ? `${h}${h.includes('?') ? '&' : '?'}t=${t}` : h);
  const items: Item[] = [
    { href: '/', label: 'Overview', icono: I.inicio },
    { href: '/despachos', label: 'Despachos', icono: I.envio, badge: despachos, badgeTono: urgentes ? 'bad' : 'accent' },
    { href: '/preguntas', label: 'Preguntas', icono: I.pregunta, badge: preguntas, badgeTono: 'accent' },
    { href: '/ventas', label: 'Ventas y ganancia', icono: I.ventas },
    { href: '/productos', label: 'Productos y costos', icono: I.producto },
    { href: '/pricing', label: 'Pricing', icono: I.precio },
    {
      href: '/competencia', label: 'Competencia', icono: I.competencia, hijos: [
        { href: '/competencia', label: 'Ranking' },
        { href: '/competencia?tab=vigilancia', label: 'Vigilancia', badge: vigilados },
        { href: '/competencia?tab=sellers', label: 'Mis competidores' },
      ],
    },
    { href: '/publicidad', label: 'Publicidad', icono: I.publicidad },
    { href: '/masivo', label: 'Publicaciones masivas', icono: I.masivo },
    { href: '/configuracion', label: 'Configuración', icono: I.config },
  ];
  const activo = (h: string) => (h === '/' ? ruta === '/' : ruta.startsWith(h.split('?')[0]));
  const tab = sp.get('tab') || '';

  const nav = (
    <nav className="flex flex-col gap-0.5 p-3">
      {items.map((it) => (
        <div key={it.href}>
          <Link href={conT(it.href)} onClick={() => setAbierto(false)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] font-medium ${activo(it.href) ? 'bg-accent/15 text-accent' : 'text-muted hover:bg-panel2 hover:text-ink'}`}>
            {it.icono}<span className="flex-1">{it.label}</span>
            {!!it.badge && <span className={`num rounded-full px-1.5 text-[11px] font-bold ${it.badgeTono === 'bad' ? 'bg-bad text-white' : 'bg-accent/25 text-accent'}`}>{it.badge}</span>}
          </Link>
          {it.hijos && activo(it.href) && (
            <div className="ml-6 mt-0.5 flex flex-col border-l border-line pl-3">
              {it.hijos.map((h) => {
                const ht = new URLSearchParams(h.href.split('?')[1] || '').get('tab') || '';
                return (
                  <Link key={h.href} href={conT(h.href)} onClick={() => setAbierto(false)}
                    className={`flex items-center rounded-md px-2 py-1.5 text-[13px] ${ht === tab ? 'text-ink' : 'text-muted hover:text-ink'}`}>
                    <span className="flex-1">{h.label}</span>
                    {!!h.badge && <span className="num rounded-full bg-accent/25 px-1.5 text-[11px] font-bold text-accent">{h.badge}</span>}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </nav>
  );

  return (
    <>
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-bg/95 px-4 py-3 backdrop-blur lg:hidden">
        <button onClick={() => setAbierto(!abierto)} aria-label="Abrir menú" className="rounded-md p-1 text-ink">{I.menu}</button>
        <Marca />
        {urgentes > 0 && <span className="ml-auto rounded-full bg-bad px-2 py-0.5 text-[11px] font-bold text-white pulso">{urgentes} Flex hoy</span>}
      </div>
      {abierto && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setAbierto(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 overflow-y-auto border-r border-line bg-panel transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${abierto ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="px-5 pb-2 pt-5"><Marca /><div className="mt-0.5 text-[12px] text-muted">MercadoLibre Argentina</div></div>
        {nav}
        <form action="/api/auth/logout" method="post" className="px-6 pb-6 pt-2">
          <button className="text-[12px] text-muted hover:text-ink">Cerrar sesión</button>
        </form>
      </aside>
    </>
  );
}

function Marca() {
  return <div className="text-[15px] font-extrabold tracking-wide">PANEL <span className="text-[11px] font-semibold tracking-[.2em] text-muted">MELI</span></div>;
}
