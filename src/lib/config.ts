import { db } from './db';

/** Ajustes editables desde la pantalla Configuración. */
export const CONFIG_DEFAULT = {
  FLEX_CORTE: '13:00',
  FLEX_DIAS: '1,2,3,4,5,6',
  FLEX_RECORDATORIOS: '09:00,11:00,12:30',
  FLEX_ALARMA_MIN: '60',
  PREGUNTA_DEMORA_MIN: '60',
  STOCK_MINIMO: '3',
  RESUMEN_HORA: '21:00',
  HORARIO_SILENCIO: '23:00-08:00',
  TELEGRAM_TOKEN: '',
  TELEGRAM_CHAT_ID: '',
  EMAIL: '',
  EMAIL_SOLO_URGENTE: 'SI',
  WHATSAPP_TELEFONO: '',
  WHATSAPP_APIKEY: '',
  WHATSAPP_SOLO_URGENTE: 'SI',
  IMPUESTOS_PCT: '0',
  RESPUESTAS_RAPIDAS: 'Hola! Sí, tenemos stock disponible. Podés comprar ahora y sale hoy mismo. Saludos!|Hola! Hacemos envíos a todo el país por Mercado Envíos. Saludos!|Hola! Sí, es nuevo, original y con factura. Saludos!',
  COMPETENCIA_ALERTAS: 'SI',
};
export type Config = typeof CONFIG_DEFAULT;
export type ClaveConfig = keyof Config;

export const SECRETOS: ClaveConfig[] = ['TELEGRAM_TOKEN', 'WHATSAPP_APIKEY'];

export async function getConfig(): Promise<Config> {
  const sql = await db();
  const rows = await sql`select clave, valor from config`;
  const out = { ...CONFIG_DEFAULT };
  for (const r of rows) if (r.clave in out) (out as Record<string, string>)[r.clave] = r.valor;
  return out;
}

export async function setConfig(valores: Partial<Config>) {
  const sql = await db();
  for (const [k, v] of Object.entries(valores)) {
    if (!(k in CONFIG_DEFAULT) || v === undefined) continue;
    await sql`insert into config (clave, valor) values (${k}, ${String(v).trim()})
      on conflict (clave) do update set valor = excluded.valor`;
  }
}
