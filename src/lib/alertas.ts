/** Alertas por Telegram, Email (Resend) y WhatsApp (CallMeBot), sin repetir. */
import { db } from './db';
import { getConfig, type Config } from './config';
import { operacionTotal } from './sync';
import { resumenVentas } from './ventas';
import { fechaAR, minutosAR, diaSemanaAR, hhmm, diaLindo, tiempo, plata } from './tiempo';
import type { Pendiente } from './tipos';
import { appUrl } from './entorno';

const MAX = 10;
type Msg = { urgente: boolean; titulo: string; texto: string };

/** extra: avisos de competencia ya armados, con su clave para no repetirlos. */
export async function procesarAlertas(extra: { clave: string; texto: string }[] = []) {
  const cfg = await getConfig();
  const sql = await db();
  const op = await operacionTotal();
  const ahora = new Date(), hoy = fechaAR(ahora), min = minutosAR(ahora);
  const enviadas = new Set((await sql`select clave from alertas_enviadas where fecha > now() - interval '10 days'`).map((r) => r.clave as string));
  const nuevas: string[] = [];
  const ya = (k: string) => enviadas.has(k) || nuevas.includes(k);
  const marcar = (k: string) => { if (!ya(k)) nuevas.push(k); };
  const msgs: Msg[] = [];

  const silencio = enSilencio(cfg.HORARIO_SILENCIO, min);
  const corte = hhmm(cfg.FLEX_CORTE) ?? 780;
  const diaFlex = cfg.FLEX_DIAS.split(',').map((x) => Number(x.trim())).includes(diaSemanaAR(ahora));
  const flex = op.pendientes.filter((p) => p.tipo === 'flex');
  const flexHoy = flex.filter((p) => p.estado !== 'PROXIMO');
  const otrosHoy = op.pendientes.filter((p) => p.tipo !== 'flex' && p.estado !== 'PROXIMO');

  const fNuevos = flex.filter((p) => !ya('flex:' + p.envioId));
  if (fNuevos.length && !silencio) {
    msgs.push({
      urgente: true, titulo: fNuevos.length === 1 ? 'Nueva venta FLEX' : `${fNuevos.length} ventas FLEX nuevas`,
      texto: `🛵 <b>${fNuevos.length === 1 ? 'Nueva venta FLEX' : fNuevos.length + ' ventas FLEX nuevas'}</b>\n` + lineas(fNuevos, (p) =>
        `• <b>${esc(p.cuenta)}</b> — ${esc(items(p))}\n   ` +
        (p.estado === 'PROXIMO' ? 'Sale el ' + diaLindo(p.despacho)
          : p.estado === 'ATRASADO' ? `🔴 <b>ATRASADO</b> (era para el ${diaLindo(p.despacho)})` : `<b>Sale HOY</b> (corte ${cfg.FLEX_CORTE})`) +
        (p.zona ? ' · ' + esc(p.zona) : '')),
    });
    fNuevos.forEach((p) => marcar('flex:' + p.envioId));
  }

  if (diaFlex && min < corte) {
    const slots = cfg.FLEX_RECORDATORIOS.split(',').map(hhmm).filter((x): x is number => x !== null);
    const vencidos = slots.filter((s) => min >= s && !ya(`rec:${hoy}:${s}`));
    if (vencidos.length) {
      if ((flexHoy.length || otrosHoy.length) && !silencio)
        msgs.push({ urgente: false, titulo: 'Pendientes de despacho', texto: `⏰ <b>Para despachar hoy</b> (corte Flex ${cfg.FLEX_CORTE})\n` + textoPend(flexHoy, otrosHoy) });
      vencidos.forEach((s) => marcar(`rec:${hoy}:${s}`));
    }
  }

  const alarma = Number(cfg.FLEX_ALARMA_MIN || 60);
  if (diaFlex && flexHoy.length && min >= corte - alarma && min < corte) {
    const k = `alarma:${hoy}:${Math.floor(min / 15)}`;
    if (!ya(k)) {
      msgs.push({
        urgente: true, titulo: `🚨 Faltan ${corte - min} min para el corte Flex`,
        texto: `🚨 <b>URGENTE: faltan ${corte - min} min para el corte Flex</b>\n${flexHoy.length} envío${flexHoy.length > 1 ? 's' : ''} sin despachar:\n` + textoPend(flexHoy, []),
      });
      marcar(k);
    }
  }

  if (diaFlex && min >= corte && flexHoy.length && !ya('corte:' + hoy) && !silencio) {
    msgs.push({
      urgente: true, titulo: '❌ Pasó el corte Flex con envíos pendientes',
      texto: `❌ <b>Pasó el corte Flex y ${flexHoy.length} envío${flexHoy.length > 1 ? 's siguen' : ' sigue'} sin salir</b>\nSi ya se los diste al repartidor, ignorá este aviso.\n` + textoPend(flexHoy, []),
    });
    marcar('corte:' + hoy);
  }

  if (!silencio) {
    const demora = Number(cfg.PREGUNTA_DEMORA_MIN || 60);
    const pn = op.preguntas.filter((q) => q.minutos < demora && !ya('preg:' + q.id));
    const pt = op.preguntas.filter((q) => q.minutos >= demora && !ya('pregtarde:' + q.id));
    if (pn.length) {
      msgs.push({ urgente: false, titulo: 'Preguntas nuevas', texto: `❓ <b>${pn.length === 1 ? 'Pregunta nueva' : pn.length + ' preguntas nuevas'}</b>\n` +
        lineas(pn, (q) => `• <b>${esc(q.cuenta)}</b> — ${esc(corto(q.producto, 40))}\n   “${esc(corto(q.texto, 140))}”`) + linkPanel('/preguntas', 'Responder desde el panel') });
      pn.forEach((q) => marcar('preg:' + q.id));
    }
    if (pt.length) {
      msgs.push({ urgente: false, titulo: 'Preguntas sin responder', texto: `⌛ <b>${pt.length} pregunta${pt.length > 1 ? 's' : ''} sin responder hace más de ${demora} min</b>\n` +
        lineas(pt, (q) => `• <b>${esc(q.cuenta)}</b> (${tiempo(q.minutos)}) “${esc(corto(q.texto, 100))}”`) + linkPanel('/preguntas', 'Responder') });
      pt.forEach((q) => { marcar('pregtarde:' + q.id); marcar('preg:' + q.id); });
    }
    const rn = op.reclamos.filter((r) => !ya('reclamo:' + r.id));
    if (rn.length) {
      msgs.push({ urgente: true, titulo: 'Reclamo nuevo', texto: `⚠️ <b>${rn.length === 1 ? 'Reclamo nuevo' : rn.length + ' reclamos nuevos'}</b> (cuidá tu reputación)\n` +
        lineas(rn, (r) => `• <b>${esc(r.cuenta)}</b> — ${r.tipo} venta #${r.orden} <a href="${r.link}">ver</a>`) });
      rn.forEach((r) => marcar('reclamo:' + r.id));
    }
    const stock = await sql`select i.item_id, i.titulo, i.stock, c.nickname from items i join cuentas c on c.user_id = i.cuenta_id
      where i.estado = 'active' and i.stock <= ${Number(cfg.STOCK_MINIMO || 3)} order by i.stock`;
    const sn = stock.filter((s) => !ya(`stock:${s.item_id}:${hoy}`));
    if (sn.length) {
      msgs.push({ urgente: false, titulo: 'Stock bajo', texto: '📦 <b>Stock bajo</b>\n' +
        lineas(sn, (s) => `• ${s.stock === 0 ? '<b>AGOTADO</b>' : s.stock + ' u.'} — ${esc(corto(s.titulo, 50))} (${esc(s.nickname)})`) });
      sn.forEach((s) => marcar(`stock:${s.item_id}:${hoy}`));
    }
    const en = extra.filter((x) => !ya(x.clave));
    if (en.length && cfg.COMPETENCIA_ALERTAS.toUpperCase() === 'SI') {
      msgs.push({ urgente: false, titulo: 'Competencia', texto: '🎯 <b>Competencia</b>\n' + lineas(en, (x) => x.texto) + linkPanel('/competencia', 'Ver competencia') });
    }
    en.forEach((x) => marcar(x.clave));
  }

  const hr = hhmm(cfg.RESUMEN_HORA);
  if (hr !== null && min >= hr && !ya('resumen:' + hoy)) {
    msgs.push({ urgente: true, titulo: 'Resumen del día', texto: await textoResumen(op, hoy) });
    marcar('resumen:' + hoy);
  }

  for (const m of msgs) await enviar(m, cfg);
  if (nuevas.length) {
    await sql`insert into alertas_enviadas ${sql(nuevas.map((clave) => ({ clave })))} on conflict do nothing`;
  }
  await sql`delete from alertas_enviadas where fecha < now() - interval '15 days'`;
  return { enviados: msgs.length };
}

function textoPend(flexHoy: Pendiente[], otros: Pendiente[]) {
  let t = '';
  if (flexHoy.length) t += lineas(flexHoy, (p) => `${p.estado === 'ATRASADO' ? '🔴 ATRASADO ' : '🟠 '}<b>Flex · ${esc(p.cuenta)}</b> — ${esc(items(p))}${p.receptor ? ' → ' + esc(p.receptor) : ''}${p.zona ? ' (' + esc(p.zona) + ')' : ''}`) + '\n';
  if (otros.length) t += lineas(otros, (p) => `📦 <b>${esc(p.tipoTexto)} · ${esc(p.cuenta)}</b> — ${esc(items(p))}${p.estado === 'ATRASADO' ? ' (atrasado)' : ''}`);
  return t.trim() + linkPanel('/despachos', 'Ver en el panel');
}

async function textoResumen(op: Awaited<ReturnType<typeof operacionTotal>>, hoy: string) {
  const v = await resumenVentas(2);
  const sql = await db();
  const cs = await sql`select user_id, nickname from cuentas order by nickname`;
  let t = `📊 <b>Resumen del día</b>\nVentas hoy: <b>${v.todas.hoy.ventas}</b> · ${plata(v.todas.hoy.total)}\nGanancia estimada: <b>${plata(v.todas.hoy.neto)}</b>\n`;
  for (const c of cs) { const x = v.porCuenta[c.user_id]; if (x) t += `  • ${esc(c.nickname)}: ${x.hoy.ventas} ventas · ${plata(x.hoy.total)}\n`; }
  const manana = op.pendientes.filter((p) => p.despacho > hoy).length;
  const pend = op.pendientes.filter((p) => p.despacho <= hoy).length;
  t += `\nPara despachar mañana: <b>${manana}</b>`;
  if (pend) t += `\n⚠️ Quedaron ${pend} envíos de hoy sin salir`;
  if (op.preguntas.length) t += `\n❓ Preguntas sin responder: ${op.preguntas.length}`;
  if (op.reclamos.length) t += `\n⚠️ Reclamos abiertos: ${op.reclamos.length}`;
  return t;
}

const items = (p: Pendiente) => p.items.map((i) => (i.cant > 1 ? i.cant + '× ' : '') + corto(i.titulo, 45)).join(' + ');
function lineas<T>(l: T[], fn: (x: T) => string) {
  const out = l.slice(0, MAX).map(fn);
  if (l.length > MAX) out.push(`…y ${l.length - MAX} más (ver panel)`);
  return out.join('\n');
}
export const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const corto = (s: unknown, n: number) => { const x = String(s ?? ''); return x.length > n ? x.slice(0, n - 1) + '…' : x; };
function linkPanel(ruta: string, txt: string) {
  const base = appUrl();
  return base.startsWith('https://') ? `\n<a href="${base}${ruta}">${txt}</a>` : '';
}

export function enSilencio(rango: string, min: number) {
  const [a, b] = String(rango || '').split('-').map(hhmm);
  if (a == null || b == null) return false;
  return a < b ? min >= a && min < b : min >= a || min < b;
}

const sinHtml = (t: string) => t.replace(/<\/?b>/g, '*').replace(/<a href="([^"]+)">([^<]*)<\/a>/g, '$2: $1')
  .replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

export async function enviar(m: Msg, cfg: Config, forzar = false) {
  const r: Record<string, string> = {};
  const intentar = async (canal: string, fn: () => Promise<void>) => {
    try { await fn(); r[canal] = 'OK'; } catch (e) { r[canal] = 'ERROR: ' + (e as Error).message; console.error(canal, e); }
  };
  if (cfg.TELEGRAM_TOKEN && cfg.TELEGRAM_CHAT_ID) {
    await intentar('telegram', async () => {
      for (const chat of cfg.TELEGRAM_CHAT_ID.split(',')) {
        const res = await fetch(`https://api.telegram.org/bot${cfg.TELEGRAM_TOKEN}/sendMessage`, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ chat_id: chat.trim(), text: m.texto, parse_mode: 'HTML', disable_web_page_preview: true }),
        });
        if (!res.ok) throw new Error((await res.text()).slice(0, 150));
      }
    });
  }
  if (cfg.EMAIL && process.env.RESEND_API_KEY && (forzar || m.urgente || cfg.EMAIL_SOLO_URGENTE.toUpperCase() !== 'SI')) {
    await intentar('email', async () => {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'Panel MeLi <onboarding@resend.dev>', to: cfg.EMAIL.split(',').map((x) => x.trim()),
          subject: 'Panel MeLi · ' + m.titulo, text: sinHtml(m.texto),
          html: `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5">${m.texto.replace(/\n/g, '<br>')}</div>`,
        }),
      });
      if (!res.ok) throw new Error((await res.text()).slice(0, 150));
    });
  }
  if (cfg.WHATSAPP_TELEFONO && cfg.WHATSAPP_APIKEY && (forzar || m.urgente || cfg.WHATSAPP_SOLO_URGENTE.toUpperCase() !== 'SI')) {
    await intentar('whatsapp', async () => {
      const u = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(cfg.WHATSAPP_TELEFONO)}&apikey=${encodeURIComponent(cfg.WHATSAPP_APIKEY)}&text=${encodeURIComponent(sinHtml(m.texto).slice(0, 1500))}`;
      const res = await fetch(u);
      if (!res.ok) throw new Error('CallMeBot ' + res.status);
    });
  }
  return r;
}
