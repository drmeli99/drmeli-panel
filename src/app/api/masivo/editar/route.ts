import { NextResponse } from 'next/server';
import { aplicarCambio, type Cambio } from '@/lib/masivo';
import { enParalelo } from '@/lib/meli';

export const maxDuration = 60;

export async function POST(req: Request) {
  const { cambios } = (await req.json()) as { cambios: Cambio[] };
  if (!Array.isArray(cambios) || cambios.length > 50) return NextResponse.json({ error: 'Mandá entre 1 y 50 cambios por vez' }, { status: 400 });
  return NextResponse.json({ resultados: await enParalelo(cambios, 4, aplicarCambio) });
}
