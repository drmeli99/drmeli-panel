import postgres from 'postgres';

declare global {
  // eslint-disable-next-line no-var
  var __sql: ReturnType<typeof postgres> | undefined;
  // eslint-disable-next-line no-var
  var __schemaOk: Promise<void> | undefined;
}

function client() {
  if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL (ver GUIA.md)');
  if (!global.__sql) {
    const local = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL);
    global.__sql = postgres(process.env.DATABASE_URL, {
      max: 3,
      idle_timeout: 20,
      prepare: false, // compatible con poolers (Neon/Supabase)
      ssl: local ? false : 'require',
      onnotice: () => {},
    });
  }
  return global.__sql;
}

/** Cliente SQL listo para usar (crea las tablas la primera vez). */
export async function db() {
  const sql = client();
  if (!global.__schemaOk) global.__schemaOk = crearTablas(sql).catch((e) => { global.__schemaOk = undefined; throw e; });
  await global.__schemaOk;
  return sql;
}

async function crearTablas(sql: ReturnType<typeof postgres>) {
  await sql.unsafe(`
    create table if not exists cuentas (
      user_id text primary key,
      nickname text not null,
      tokens text not null,
      expira timestamptz not null,
      reputacion jsonb,
      activos int default 0,
      error text default '',
      conectada timestamptz default now(),
      backfill boolean default false
    );
    create table if not exists config (clave text primary key, valor text not null);
    create table if not exists ventas (
      order_id text primary key,
      cuenta_id text not null,
      fecha timestamptz not null,
      estado text not null,
      producto text,
      cantidad int default 1,
      total numeric default 0,
      comision numeric default 0,
      envio_costo numeric default 0,
      tipo_envio text,
      estado_envio text,
      shipment_id text,
      detalle jsonb default '[]'
    );
    create index if not exists ventas_fecha on ventas (fecha);
    create index if not exists ventas_cuenta on ventas (cuenta_id, fecha);
    create table if not exists costos (clave text primary key, costo numeric not null, nota text default '');
    create table if not exists items (
      item_id text primary key,
      cuenta_id text not null,
      titulo text,
      precio numeric,
      stock int,
      vendidos int default 0,
      estado text,
      sku text,
      permalink text,
      thumbnail text,
      category_id text,
      listing_type text,
      catalog_product_id text,
      catalog_listing boolean default false,
      tiene_variaciones boolean default false,
      envio_gratis boolean default false,
      logistica text,
      comision_pct numeric,
      comision_fija numeric,
      actualizado timestamptz default now()
    );
    create index if not exists items_cuenta on items (cuenta_id);
    create table if not exists estado (clave text primary key, datos jsonb not null, actualizado timestamptz default now());
    create table if not exists alertas_enviadas (clave text primary key, fecha timestamptz default now());
    create table if not exists vigilancia (
      id serial primary key,
      tipo text not null,           -- 'mio' (mi publicación en catálogo) | 'externo' (publicación de otro)
      item_id text not null unique,
      cuenta_id text,
      nota text default '',
      ultimo jsonb,
      creado timestamptz default now()
    );
    create table if not exists vigilancia_hist (
      id bigserial primary key,
      vigilancia_id int references vigilancia(id) on delete cascade,
      fecha timestamptz default now(),
      precio numeric,
      datos jsonb
    );
    create table if not exists competidores (
      seller_id text primary key,
      nickname text,
      nota text default '',
      ultimo jsonb,
      creado timestamptz default now()
    );
    create table if not exists acciones_masivas (
      id bigserial primary key,
      fecha timestamptz default now(),
      tipo text,
      item_id text,
      cuenta_id text,
      ok boolean,
      detalle text
    );
  `);
}

/** Guarda un JSON con nombre en la tabla estado. */
export async function setEstado(clave: string, datos: unknown) {
  const sql = await db();
  await sql`insert into estado (clave, datos, actualizado) values (${clave}, ${sql.json(datos as never)}, now())
    on conflict (clave) do update set datos = excluded.datos, actualizado = now()`;
}

export async function getEstado<T>(clave: string): Promise<{ datos: T; actualizado: Date } | null> {
  const sql = await db();
  const r = await sql`select datos, actualizado from estado where clave = ${clave}`;
  return r.length ? { datos: r[0].datos as T, actualizado: r[0].actualizado as Date } : null;
}
