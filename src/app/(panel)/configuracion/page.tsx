import { headers } from 'next/headers';
import { getConfig } from '@/lib/config';
import { listaCuentas } from '@/lib/datos';
import { getEstado } from '@/lib/db';
import { redirectUri } from '@/lib/meli';
import { hace } from '@/lib/tiempo';
import { Encabezado, Tarjeta, Aviso, Boton, PuntoRep, nivelRep, Vacio } from '@/components/ui';
import { FormConfig, ProbarAlertas, Copiar } from '@/components/FormConfig';
import { BotonAccion } from '@/components/BotonAccion';
import { desconectarTienda, actualizarTodo } from '@/app/acciones';
import { I } from '@/components/Iconos';

export default async function Configuracion({ searchParams }: { searchParams: Promise<{ conectada?: string; error?: string }> }) {
  const sp = await searchParams;
  const [cfg, cs, op] = await Promise.all([getConfig(), listaCuentas(), getEstado('lento:paso')]);
  const h = await headers();
  const base = (process.env.APP_URL || `https://${h.get('host')}`).replace(/\/$/, '');
  const faltan = ['DATABASE_URL', 'APP_PASSWORD', 'AUTH_SECRET', 'CRON_SECRET', 'MELI_CLIENT_ID', 'MELI_CLIENT_SECRET', 'APP_URL'].filter((k) => !process.env[k]);
  const key = process.env.CRON_SECRET || 'TU_CRON_SECRET';
  return (
    <>
      <Encabezado icono={I.config} titulo="Configuración">
        <BotonAccion accion={actualizarTodo} trabajando="Actualizando todo…">{I.refrescar} Actualizar todo ahora</BotonAccion>
      </Encabezado>
      {sp.conectada && <Aviso tono="ok">✅ {sp.conectada} conectada. En unos minutos aparecen sus ventas y publicaciones.</Aviso>}
      {sp.error && <Aviso tono="bad">No se pudo conectar: {sp.error}</Aviso>}
      {faltan.length > 0 && <Aviso tono="bad">Faltan variables de entorno en Vercel: <b>{faltan.join(', ')}</b>. Ver GUIA.md, paso 3.</Aviso>}

      <Tarjeta titulo="Tiendas de MercadoLibre" accion={<Boton href="/api/meli/connect" tono="pri">+ Conectar tienda</Boton>}>
        {cs.length ? (
          <ul className="divide-y divide-line">{cs.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <PuntoRep color={c.reputacion?.color} />
              <div className="min-w-0 flex-1"><div className="font-semibold">{c.nombre}</div>
                <div className="text-[12px] text-muted">ID {c.id} · reputación {nivelRep(c.reputacion?.color)?.[1] || '–'} · {c.activos} publicaciones activas</div>
                {c.error && <div className="text-[12px] text-bad">{c.error}</div>}</div>
              <form action={desconectarTienda}><input type="hidden" name="id" value={c.id} /><button className="text-[12px] text-muted hover:text-bad">Desconectar</button></form>
            </li>))}
          </ul>
        ) : <Vacio>Ninguna tienda conectada.</Vacio>}
        <p className="border-t border-line px-4 py-3 text-[12px] text-muted"><b className="text-ink">Para conectar otra tienda:</b> cerrá sesión en mercadolibre.com.ar en este navegador y tocá “Conectar tienda”: MeLi te pide entrar con la otra cuenta. URL de redirección para tu app de MeLi: <code className="select-all">{redirectUri()}</code></p>
      </Tarjeta>

      <Tarjeta titulo="Actualización automática">
        <div className="flex flex-col gap-3 p-4 text-[13px]">
          <p className="text-muted">Creá dos tareas en <a className="underline" href="https://cron-job.org" target="_blank" rel="noreferrer">cron-job.org</a> (gratis) con estas direcciones:</p>
          <div className="grid gap-2 md:grid-cols-[150px_1fr] md:items-center"><b>Cada 5 minutos</b><Copiar texto={`${base}/api/cron/rapido?key=${key}`} /></div>
          <div className="grid gap-2 md:grid-cols-[150px_1fr] md:items-center"><b>Cada 1 hora</b><Copiar texto={`${base}/api/cron/lento?key=${key}`} /></div>
          <p className="text-muted">No compartas estas direcciones: incluyen tu clave. Última corrida de tareas lentas: {op ? `hace ${hace(op.actualizado)}` : 'nunca'}.</p>
        </div>
      </Tarjeta>

      <Tarjeta titulo="Probar alertas"><div className="p-4"><ProbarAlertas /></div></Tarjeta>

      <FormConfig valores={cfg} grupos={[
        { titulo: 'Flex y despachos', campos: [
          { k: 'FLEX_CORTE', label: 'Hora de corte Flex', ayuda: 'Lo vendido antes sale hoy; lo de después, mañana. Igual que en MeLi.', ph: '13:00' },
          { k: 'FLEX_DIAS', label: 'Días que despachás Flex', ayuda: '1=lunes … 7=domingo, separados por coma.', ph: '1,2,3,4,5,6' },
          { k: 'FLEX_RECORDATORIOS', label: 'Recordatorios', ayuda: 'Horas en que te recuerda lo pendiente de hoy.', ph: '09:00,11:00,12:30' },
          { k: 'FLEX_ALARMA_MIN', label: 'Alarma fuerte (minutos antes del corte)', ayuda: 'Desde ahí te insiste cada 15 min por todos los canales.' },
        ] },
        { titulo: 'Avisos', campos: [
          { k: 'PREGUNTA_DEMORA_MIN', label: 'Pregunta sin responder (minutos)', ayuda: 'Te avisa si pasa este tiempo.' },
          { k: 'STOCK_MINIMO', label: 'Stock mínimo', ayuda: 'Con este stock o menos, aviso de stock bajo.' },
          { k: 'RESUMEN_HORA', label: 'Resumen diario', ph: '21:00' },
          { k: 'HORARIO_SILENCIO', label: 'Horario de silencio', ayuda: 'No molesta en este rango (salvo la alarma del corte).', ph: '23:00-08:00' },
          { k: 'COMPETENCIA_ALERTAS', label: 'Avisos de competencia', tipo: 'si-no' },
        ] },
        { titulo: 'Canales', campos: [
          { k: 'TELEGRAM_TOKEN', label: 'Telegram: token del bot', tipo: 'password', ayuda: 'Lo da @BotFather.' },
          { k: 'TELEGRAM_CHAT_ID', label: 'Telegram: chat id', ayuda: 'Varios separados por coma.' },
          { k: 'EMAIL', label: 'Email para alertas', ayuda: process.env.RESEND_API_KEY ? 'Se envía con Resend.' : 'Falta RESEND_API_KEY en Vercel para mandar emails.' },
          { k: 'EMAIL_SOLO_URGENTE', label: 'Email: solo lo urgente', tipo: 'si-no' },
          { k: 'WHATSAPP_TELEFONO', label: 'WhatsApp: tu número', ph: '5491122334455', ayuda: 'Con código de país, sin + ni espacios (CallMeBot).' },
          { k: 'WHATSAPP_APIKEY', label: 'WhatsApp: apikey de CallMeBot', tipo: 'password' },
          { k: 'WHATSAPP_SOLO_URGENTE', label: 'WhatsApp: solo lo urgente', tipo: 'si-no' },
        ] },
        { titulo: 'Ganancia y respuestas', campos: [
          { k: 'IMPUESTOS_PCT', label: 'Impuestos sobre la venta (%)', ayuda: 'IIBB, retenciones, etc. Se descuentan de la ganancia.' },
          { k: 'RESPUESTAS_RAPIDAS', label: 'Respuestas rápidas', tipo: 'area', ayuda: 'Separadas por | (barra vertical). Aparecen como botones al responder preguntas.' },
        ] },
      ]} />
    </>
  );
}
