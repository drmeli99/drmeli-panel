import { igualSeguro } from './cripto';
import { cronSecret } from './entorno';
import { sincronizarRapido, sincronizarLento } from './sync';
import { syncCompetencia, syncVigilancia } from './competencia';
import { syncPublicidad } from './publicidad';
import { procesarAlertas } from './alertas';
import { getEstado, setEstado } from './db';

export function cronAutorizado(req: Request) {
  const secreto = cronSecret();
  if (!secreto) return false;
  const h = req.headers.get('authorization') || '';
  const k = new URL(req.url).searchParams.get('key') || '';
  return igualSeguro(h, `Bearer ${secreto}`) || igualSeguro(k, secreto);
}

export async function correrRapido() {
  const r = await sincronizarRapido();
  const a = await procesarAlertas();
  return { ...r, ...a };
}

const PASOS = ['publicaciones', 'competencia', 'vigilancia', 'publicidad'] as const;

/**
 * Tareas lentas. Corre los pasos en orden hasta ~40 s; si no llega,
 * la próxima ejecución sigue desde donde quedó.
 */
export async function correrLento(limiteMs = 40_000) {
  const t0 = Date.now();
  const prev = await getEstado<{ siguiente: number }>('lento:paso');
  let i = prev?.datos.siguiente ?? 0;
  const hechos: string[] = [];
  const avisos: { clave: string; texto: string }[] = [];
  for (let n = 0; n < PASOS.length; n++) {
    if (n > 0 && Date.now() - t0 > limiteMs) break;
    const paso = PASOS[i % PASOS.length];
    try {
      if (paso === 'publicaciones') await sincronizarLento();
      if (paso === 'competencia') avisos.push(...(await syncCompetencia()));
      if (paso === 'vigilancia') avisos.push(...(await syncVigilancia()));
      if (paso === 'publicidad') await syncPublicidad();
      hechos.push(paso);
    } catch (e) {
      hechos.push(`${paso} (error: ${(e as Error).message})`);
    }
    i = (i + 1) % PASOS.length;
  }
  await setEstado('lento:paso', { siguiente: i });
  if (avisos.length) await procesarAlertas(avisos);
  return { hechos, segundos: Math.round((Date.now() - t0) / 1000) };
}
