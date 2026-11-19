import { db } from './db';
import { operacionTotal } from './sync';
import type { Reputacion } from './tipos';

export type CuentaInfo = { id: string; nombre: string; reputacion: Reputacion | null; error: string; activos: number; backfill: boolean };

export async function listaCuentas(): Promise<CuentaInfo[]> {
  const sql = await db();
  const r = await sql`select c.user_id, c.nickname, c.reputacion, c.error, c.backfill,
      (select count(*) from items i where i.cuenta_id = c.user_id and i.estado = 'active')::int as activos
    from cuentas c order by c.nickname`;
  return r.map((x) => ({ id: x.user_id, nombre: x.nickname, reputacion: x.reputacion, error: x.error || '', activos: x.activos, backfill: x.backfill }));
}

export async function contadores() {
  const op = await operacionTotal();
  const sql = await db();
  const [{ n }] = await sql`select count(*)::int as n from vigilancia`;
  return {
    despachos: op.pendientes.filter((p) => p.estado !== 'PROXIMO').length,
    urgentes: op.pendientes.filter((p) => p.tipo === 'flex' && p.estado !== 'PROXIMO').length,
    preguntas: op.preguntas.length,
    vigilados: n,
  };
}

/** Filtro por tienda (?t=) */
export const deTienda = (t?: string) => <T extends { cuentaId: string }>(x: T) => !t || x.cuentaId === t;
