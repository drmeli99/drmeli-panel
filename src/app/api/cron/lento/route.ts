import { NextResponse } from 'next/server';
import { cronAutorizado, correrLento } from '@/lib/cron';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!cronAutorizado(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  return NextResponse.json(await correrLento());
}
export const POST = GET;
