import Link from 'next/link';
import type { ReactNode } from 'react';

export function Encabezado({ icono, titulo, sub, children, extra }: { icono?: ReactNode; titulo: string; sub?: ReactNode; children?: ReactNode; extra?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        {icono && <span className="text-accent">{icono}</span>}
        <h1 className="text-2xl font-bold tracking-tight">{titulo}</h1>
        {extra}
        <div className="flex-1" />
        {children}
      </div>
      {sub && <p className="text-muted -mt-1">{sub}</p>}
    </div>
  );
}

export function Tarjeta({ titulo, children, accion, className = '' }: { titulo?: ReactNode; children: ReactNode; accion?: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-line bg-panel min-w-0 ${className}`}>
      {titulo && (
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <h2 className="font-semibold">{titulo}</h2>
          <div className="flex-1" />
          {accion}
        </div>
      )}
      {children}
    </section>
  );
}

export function Dato({ label, valor, sub, tono }: { label: string; valor: ReactNode; sub?: ReactNode; tono?: 'ok' | 'warn' | 'bad' }) {
  const c = tono === 'ok' ? 'text-ok' : tono === 'warn' ? 'text-warn' : tono === 'bad' ? 'text-bad' : '';
  return (
    <div className="rounded-xl border border-line bg-panel p-4 min-w-0 flex flex-col gap-1">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</div>
      <div className={`num text-[22px] font-semibold leading-tight whitespace-nowrap ${c}`}>{valor}</div>
      {sub && <div className="text-[13px] text-muted">{sub}</div>}
    </div>
  );
}

const TONOS = {
  ok: 'bg-ok/15 text-ok', warn: 'bg-warn/15 text-warn', bad: 'bg-bad/15 text-bad',
  accent: 'bg-accent/15 text-accent', gris: 'bg-panel2 text-muted', borde: 'border border-line text-ink',
};
export function Pill({ tono = 'gris', children }: { tono?: keyof typeof TONOS; children: ReactNode }) {
  return <span className={`inline-flex items-center shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide whitespace-nowrap ${TONOS[tono]}`}>{children}</span>;
}

export function Boton({ children, href, tono = 'normal', type = 'button', className = '', ...p }:
  { children: ReactNode; href?: string; tono?: 'normal' | 'pri' | 'peligro'; type?: 'button' | 'submit'; className?: string } & Record<string, unknown>) {
  const cls = `inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold whitespace-nowrap transition-colors disabled:opacity-50 ${
    tono === 'pri' ? 'bg-accent text-white hover:bg-accent/85' : tono === 'peligro' ? 'border border-bad/40 text-bad hover:bg-bad/10' : 'border border-line bg-panel2 hover:border-accent/60'} ${className}`;
  if (href) {
    const ext = href.startsWith('http');
    if (ext || href.startsWith('/api/')) return <a href={href} className={cls} {...(ext ? { target: '_blank', rel: 'noreferrer' } : {})}>{children}</a>;
    return <Link href={href} className={cls} {...(ext ? { target: '_blank', rel: 'noreferrer' } : {})}>{children}</Link>;
  }
  return <button type={type} className={cls} {...p}>{children}</button>;
}

export function Vacio({ children }: { children: ReactNode }) {
  return <div className="px-4 py-6 text-center text-muted">{children}</div>;
}

export function Aviso({ tono = 'gris', children }: { tono?: 'gris' | 'bad' | 'warn' | 'ok'; children: ReactNode }) {
  const c = tono === 'bad' ? 'border-bad/40 bg-bad/10 text-bad' : tono === 'warn' ? 'border-warn/40 bg-warn/10 text-warn' : tono === 'ok' ? 'border-ok/40 bg-ok/10 text-ok' : 'border-line bg-panel text-muted';
  return <div className={`rounded-xl border px-4 py-3 text-[13px] ${c}`}>{children}</div>;
}

export function Tabs({ tabs, activa }: { tabs: { id: string; label: string; href: string; n?: number }[]; activa: string }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl border border-line bg-panel p-1 w-fit max-w-full">
      {tabs.map((t) => (
        <Link key={t.id} href={t.href} className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold ${t.id === activa ? 'bg-accent/20 text-accent' : 'text-muted hover:text-ink'}`}>
          {t.label}{t.n != null && <span className="ml-1.5 rounded-full bg-panel2 px-1.5 num text-[11px]">{t.n}</span>}
        </Link>
      ))}
    </div>
  );
}

/** Barras simples (SVG) con la última barra resaltada. */
export function Barras({ serie, alto = 56 }: { serie: { fecha: string; total: number }[]; alto?: number }) {
  if (!serie.length) return null;
  const w = 280, gap = 3, max = Math.max(...serie.map((d) => d.total)) || 1;
  const bw = (w - gap * (serie.length - 1)) / serie.length;
  return (
    <svg viewBox={`0 0 ${w} ${alto}`} preserveAspectRatio="none" className="mt-2 block h-14 w-full" role="img" aria-label="Facturación de los últimos 14 días">
      {serie.map((d, i) => {
        const h = Math.max(2, (d.total / max) * (alto - 4));
        return (
          <rect key={d.fecha} x={i * (bw + gap)} y={alto - h} width={bw} height={h} rx={1.5}
            fill="rgb(var(--accent))" opacity={i === serie.length - 1 ? 1 : 0.35}>
            <title>{`${d.fecha}: $ ${Math.round(d.total).toLocaleString('es-AR')}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

const NIVELES: Record<string, [number, string, string]> = {
  red: [1, 'Roja', '#e0453a'], orange: [2, 'Naranja', '#f08a24'], yellow: [3, 'Amarilla', '#f2c230'],
  light_green: [4, 'Verde claro', '#8fc93a'], green: [5, 'Verde', '#2f9e57'],
};
export const nivelRep = (color?: string | null) => (color ? NIVELES[color] : undefined);

export function Termometro({ color }: { color?: string | null }) {
  const n = nivelRep(color)?.[0] || 0;
  return (
    <div className="mt-2 grid grid-cols-5 gap-1" role="img" aria-label={`Reputación nivel ${n} de 5`}>
      {Object.values(NIVELES).map(([k, , c]) => (
        <i key={k} className={`block rounded-sm ${k === n ? 'h-3 -mt-0.5' : 'h-2 opacity-25'}`} style={{ background: c }} />
      ))}
    </div>
  );
}

export function PuntoRep({ color }: { color?: string | null }) {
  const n = nivelRep(color);
  return <span title={`Reputación ${n?.[1] || 'sin datos'}`} className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: n?.[2] || 'rgb(var(--line))' }} />;
}
