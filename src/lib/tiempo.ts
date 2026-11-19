export const TZ = 'America/Argentina/Buenos_Aires';

function partes(d: Date) {
  const p: Record<string, string> = {};
  new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
  }).formatToParts(d).forEach((x) => (p[x.type] = x.value));
  return p;
}

/** 'yyyy-mm-dd' en hora argentina. */
export function fechaAR(d: Date = new Date()) {
  const p = partes(d);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Minutos desde la medianoche argentina. */
export function minutosAR(d: Date = new Date()) {
  const p = partes(d);
  return Number(p.hour) * 60 + Number(p.minute);
}

/** 1 = lunes … 7 = domingo. */
export function diaSemanaAR(d: Date = new Date()) {
  return ({ Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 } as Record<string, number>)[partes(d).weekday];
}

/** Inicio del día argentino de hace N días, en ISO con -03:00. */
export function inicioDiaISO(diasAtras: number) {
  const f = fechaAR(new Date(Date.now() - diasAtras * 864e5));
  return `${f}T00:00:00.000-03:00`;
}

export function hhmm(s: string | null | undefined): number | null {
  const m = String(s || '').match(/(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export function diaLindo(f: string) {
  return new Date(f + 'T12:00:00-03:00').toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: TZ });
}

export function hace(fecha: Date | string) {
  const min = Math.round((Date.now() - new Date(fecha).getTime()) / 60000);
  return tiempo(min);
}

export function tiempo(min: number) {
  if (min < 1) return 'recién';
  if (min < 60) return `${min} min`;
  if (min < 1440) return `${Math.floor(min / 60)} h${min % 60 ? ' ' + (min % 60) + ' min' : ''}`;
  return `${Math.floor(min / 1440)} d`;
}

export const plata = (n: number | null | undefined) => '$ ' + Math.round(Number(n) || 0).toLocaleString('es-AR');
export const pct = (n: number | null | undefined, dec = 1) =>
  n == null || !isFinite(n) ? '–' : (n * 100).toLocaleString('es-AR', { maximumFractionDigits: dec }) + '%';
