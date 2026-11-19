import { NextResponse } from 'next/server';
import { clonar, type Clonado } from '@/lib/masivo';
import { enParalelo } from '@/lib/meli';

export const maxDuration = 60;

export async function POST(req: Request) {
  const { ops } = (await req.json()) as { ops: Clonado[] };
  if (!Array.isArray(ops) || ops.length > 10) return NextResponse.json({ error: 'Mandá entre 1 y 10 publicaciones por vez' }, { status: 400 });
  return NextResponse.json({ resultados: await enParalelo(ops, 2, clonar) });
}
