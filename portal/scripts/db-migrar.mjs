/* ============================================================
   Aplica las migraciones de `portal/db/migrations` en orden.
   ------------------------------------------------------------
   · Se conecta como dueño (DATABASE_URL) y usa una tabla
     `migraciones` para no repetir un archivo ya aplicado.
   · Cada archivo se ejecuta dentro de una transacción: si algo
     falla, no queda a medias.
   · No imprime la cadena de conexión ni credenciales.

   node portal/scripts/db-migrar.mjs
   ============================================================ */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import pg from "pg";
import { cargarEnv, exigir } from "./_env.mjs";

const MIGRACIONES = new URL("../db/migrations/", import.meta.url);

async function principal() {
  const variables = cargarEnv();
  const cliente = new pg.Client({
    connectionString: exigir(variables, "DATABASE_URL"),
    application_name: "bws-migraciones",
  });
  await cliente.connect();

  try {
    await cliente.query(`
      create table if not exists migraciones (
        archivo text primary key,
        aplicada timestamptz not null default now()
      )
    `);

    const ya = new Set(
      (await cliente.query("select archivo from migraciones")).rows.map((f) => f.archivo),
    );
    const archivos = (await readdir(MIGRACIONES))
      .filter((f) => f.endsWith(".sql"))
      .sort();

    if (!archivos.length) throw new Error("No hay migraciones en portal/db/migrations");

    for (const archivo of archivos) {
      if (ya.has(archivo)) {
        console.log(`  · ${archivo} ya aplicada`);
        continue;
      }
      const sql = await readFile(join(MIGRACIONES.pathname, archivo), "utf8");
      await cliente.query("begin");
      try {
        await cliente.query(sql);
        await cliente.query("insert into migraciones (archivo) values ($1)", [archivo]);
        await cliente.query("commit");
        console.log(`  ✓ ${archivo}`);
      } catch (error) {
        await cliente.query("rollback");
        throw new Error(`${archivo}: ${error.message}`);
      }
    }
    console.log(`\n✓ ${archivos.length} migraciones al día.`);
  } finally {
    await cliente.end();
  }
}

principal().catch((error) => {
  console.error(`✗ ${error.message}`);
  process.exit(1);
});
