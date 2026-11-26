import { readFile } from "node:fs/promises";
import pg from "pg";

const archivo = process.env.RUTA_NEON_FILE ?? "/home/prodz/.config/ruta/neon.json";
const config = JSON.parse(await readFile(archivo, "utf8"));
if (!config.ownerDirect || !config.appPassword) throw new Error("Falta la configuración local de Neon.");

const cliente = new pg.Client({ connectionString: config.ownerDirect });
await cliente.connect();

try {
  await cliente.query("begin");
  await cliente.query("select set_config('ruta.app_password', $1, false)", [config.appPassword]);
  await cliente.query(`
    do $do$
    begin
      if not exists (select 1 from pg_roles where rolname = 'ruta_app') then
        execute format(
          'create role ruta_app login nosuperuser nocreatedb nocreaterole noreplication nobypassrls password %L',
          current_setting('ruta.app_password')
        );
      else
        execute format(
          'alter role ruta_app login nosuperuser nocreatedb nocreaterole noreplication nobypassrls password %L',
          current_setting('ruta.app_password')
        );
      end if;
    end
    $do$;
  `);
  await cliente.query("create schema if not exists ruta");
  await cliente.query(`
    create table if not exists ruta.migraciones (
      nombre text primary key,
      aplicada_en timestamptz not null default now()
    )
  `);

  const sql = await readFile(new URL("../migrations/0001_cuentas.sql", import.meta.url), "utf8");
  const aplicada = await cliente.query("select 1 from ruta.migraciones where nombre = $1", ["0001_cuentas.sql"]);
  if (aplicada.rowCount === 0) {
    await cliente.query(sql);
    await cliente.query("insert into ruta.migraciones (nombre) values ($1)", ["0001_cuentas.sql"]);
  }
  await cliente.query("commit");
} catch (error) {
  await cliente.query("rollback");
  throw error;
} finally {
  await cliente.end();
}

const verificacion = new pg.Client({ connectionString: config.ownerDirect });
await verificacion.connect();
try {
  const rol = await verificacion.query(`
    select rolsuper, rolbypassrls, rolcanlogin
    from pg_roles
    where rolname = 'ruta_app'
  `);
  console.log(`Migración aplicada; rol ruta_app: ${JSON.stringify(rol.rows[0])}`);
} finally {
  await verificacion.end();
}
