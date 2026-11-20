import crypto from 'node:crypto';

/** Dirección pública del panel. En Vercel se detecta sola; APP_URL solo hace falta con dominio propio. */
export function appUrl() {
  const u = process.env.APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '');
  return u.replace(/\/$/, '');
}

/** Conexión a Postgres. La integración de Neon en Vercel crea DATABASE_URL (y POSTGRES_URL). */
export function databaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
}

/** Clave de las tareas automáticas. Si no se configura CRON_SECRET, se deriva de AUTH_SECRET. */
export function cronSecret() {
  if (process.env.CRON_SECRET) return process.env.CRON_SECRET;
  if (!process.env.AUTH_SECRET) return '';
  return crypto.createHmac('sha256', process.env.AUTH_SECRET).update('cron').digest('hex').slice(0, 32);
}

/** Variables obligatorias que faltan. */
export function faltantes() {
  const f: string[] = [];
  if (!databaseUrl()) f.push('base de datos (Storage → Neon)');
  for (const k of ['APP_PASSWORD', 'AUTH_SECRET', 'MELI_CLIENT_ID', 'MELI_CLIENT_SECRET']) {
    if (!process.env[k] || process.env[k] === 'pendiente') f.push(k);
  }
  return f;
}
