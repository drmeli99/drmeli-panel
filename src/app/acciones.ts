'use server';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { cuenta, meli, extraerItemId, cuentas } from '@/lib/meli';
import { setConfig, getConfig, CONFIG_DEFAULT, type Config } from '@/lib/config';
import { enviar } from '@/lib/alertas';
import { correrRapido, correrLento } from '@/lib/cron';
import { resolverSeller, syncVigilancia } from '@/lib/competencia';
import { syncPublicidad } from '@/lib/publicidad';
import { getEstado, setEstado } from '@/lib/db';
import type { Operacion } from '@/lib/tipos';

export async function actualizarAhora() {
  await correrRapido();
  revalidatePath('/', 'layout');
}

export async function actualizarTodo() {
  await correrLento(45_000);
  await correrRapido();
  revalidatePath('/', 'layout');
}

export async function responderPregunta(_: unknown, form: FormData) {
  const id = String(form.get('id')), cuentaId = String(form.get('cuentaId')), texto = String(form.get('texto') || '').trim();
  if (texto.length < 2) return { ok: false, msg: 'Escribí una respuesta.' };
  if (texto.length > 2000) return { ok: false, msg: 'Máximo 2000 caracteres.' };
  try {
    await meli(await cuenta(cuentaId), '/answers', { method: 'POST', body: { question_id: Number(id), text: texto } });
    // Sacarla de la lista sin esperar al próximo ciclo
    const e = await getEstado<Operacion>('op:' + cuentaId);
    if (e) await setEstado('op:' + cuentaId, { ...e.datos, preguntas: e.datos.preguntas.filter((q) => q.id !== id) });
    revalidatePath('/', 'layout');
    return { ok: true, msg: 'Respondida ✓' };
  } catch (err) {
    return { ok: false, msg: (err as Error).message };
  }
}

export async function guardarCosto(form: FormData) {
  const clave = String(form.get('clave') || '').trim();
  const valor = String(form.get('costo') || '').replace(/\./g, '').replace(',', '.').trim();
  if (!clave) return;
  const sql = await db();
  if (valor === '') await sql`delete from costos where clave = ${clave}`;
  else if (!isNaN(Number(valor))) {
    await sql`insert into costos (clave, costo, nota) values (${clave}, ${Number(valor)}, ${String(form.get('nota') || '')})
      on conflict (clave) do update set costo = excluded.costo`;
  }
  revalidatePath('/productos'); revalidatePath('/ventas'); revalidatePath('/');
}

export async function importarCostos(_: unknown, form: FormData) {
  const texto = String(form.get('csv') || '');
  const sql = await db();
  let n = 0;
  for (const linea of texto.split(/\r?\n/)) {
    const [clave, costo] = linea.split(/[;,\t]/).map((x) => x?.trim());
    const v = Number(String(costo || '').replace(/\$|\s/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'));
    if (!clave || !costo || isNaN(v) || /sku|costo/i.test(clave)) continue;
    await sql`insert into costos (clave, costo) values (${clave}, ${v}) on conflict (clave) do update set costo = excluded.costo`;
    n++;
  }
  revalidatePath('/productos');
  return { msg: n ? `${n} costos cargados.` : 'No encontré filas válidas. Formato: SKU;costo (una por línea).' };
}

export async function guardarConfig(_: unknown, form: FormData) {
  const v: Partial<Config> = {};
  for (const k of Object.keys(CONFIG_DEFAULT) as (keyof Config)[]) {
    if (form.has(k)) v[k] = String(form.get(k));
  }
  await setConfig(v);
  revalidatePath('/configuracion');
  return { msg: 'Guardado ✓' };
}

export async function probarAlertas() {
  const cfg = await getConfig();
  const r = await enviar({ urgente: true, titulo: 'Prueba', texto: '✅ <b>Panel MeLi conectado</b>\nAsí te van a llegar los avisos de Flex, preguntas, reclamos, stock y competencia.' }, cfg, true);
  const canales = { telegram: 'Telegram', email: 'Email', whatsapp: 'WhatsApp' };
  return Object.entries(canales).map(([k, n]) => `${n}: ${r[k] || 'no configurado'}`).join(' · ');
}

export async function desconectarTienda(form: FormData) {
  const sql = await db();
  const id = String(form.get('id'));
  await sql`delete from cuentas where user_id = ${id}`;
  await sql`delete from estado where clave = ${'op:' + id}`;
  revalidatePath('/', 'layout');
}

export async function vigilar(_: unknown, form: FormData) {
  const id = extraerItemId(String(form.get('item') || ''));
  if (!id) return { msg: 'Pegá el link o el código MLA de la publicación.' };
  const sql = await db();
  const mio = (await sql`select cuenta_id from items where item_id = ${id}`)[0];
  await sql`insert into vigilancia (tipo, item_id, cuenta_id, nota) values (${mio ? 'mio' : 'externo'}, ${id}, ${mio?.cuenta_id || null}, ${String(form.get('nota') || '')})
    on conflict (item_id) do nothing`;
  await syncVigilancia().catch(() => null);
  revalidatePath('/competencia');
  return { msg: `${id} agregado a vigilancia${mio ? ' (es tuya)' : ''}.` };
}

export async function dejarDeVigilar(form: FormData) {
  const sql = await db();
  await sql`delete from vigilancia where id = ${Number(form.get('id'))}`;
  revalidatePath('/competencia');
}

export async function agregarCompetidor(_: unknown, form: FormData) {
  const s = await resolverSeller(String(form.get('seller') || ''));
  if (!s) return { msg: 'No encontré ese vendedor. Probá con su ID numérico o su nickname exacto.' };
  const sql = await db();
  await sql`insert into competidores (seller_id, nickname, nota) values (${s.id}, ${s.nickname}, ${String(form.get('nota') || '')}) on conflict (seller_id) do nothing`;
  await syncVigilancia().catch(() => null);
  revalidatePath('/competencia');
  return { msg: `${s.nickname} agregado.` };
}

export async function quitarCompetidor(form: FormData) {
  const sql = await db();
  await sql`delete from competidores where seller_id = ${String(form.get('id'))}`;
  revalidatePath('/competencia');
}

export async function actualizarPublicidad() {
  await syncPublicidad();
  revalidatePath('/publicidad');
}

export async function hayCuentas() {
  return (await cuentas()).length > 0;
}
