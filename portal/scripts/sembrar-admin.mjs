/* ============================================================
   Alta de la cuenta de administración
   ------------------------------------------------------------
   No hay registro público de administradores: la cuenta se crea
   a mano desde esta máquina, con la conexión de dueño, y la clave
   nunca se imprime.

   · ADMIN_CORREO y ADMIN_CLAVE salen del entorno o de
     `portal/.env.local`; la clave cumple las mismas reglas que el
     registro.
   · Un correo que ya existe como cliente no se promueve: se
     rechaza para no dar acceso a expedientes ajenos por error.
   · Sin `--confirmar` solo comprueba los datos; no escribe.
   · `--pruebas` usa `DATABASE_URL_PRUEBAS` en vez de `DATABASE_URL`.

   npx tsx scripts/sembrar-admin.mjs [--pruebas] [--confirmar]
   ============================================================ */

import pg from "pg";
import { cargarEnv } from "./_env.mjs";
import { hashearClave } from "../api/_lib/clave.ts";
import { correoNormalizado, mensajeClave } from "../legal/identidad.ts";

async function principal() {
  const variables = cargarEnv();
  const correo = correoNormalizado(process.env.ADMIN_CORREO ?? variables.ADMIN_CORREO ?? "");
  const clave = process.env.ADMIN_CLAVE ?? variables.ADMIN_CLAVE ?? "";
  const nombre = (process.env.ADMIN_NOMBRE ?? variables.ADMIN_NOMBRE ?? "Administración Blink").trim();

  if (!correo) {
    throw new Error("Falta ADMIN_CORREO con un correo válido.");
  }
  const problema = mensajeClave(clave);
  if (problema) {
    throw new Error(`ADMIN_CLAVE no cumple: ${problema}`);
  }

  const pruebas = process.argv.includes("--pruebas");
  const confirmar = process.argv.includes("--confirmar");
  const nombreCadena = pruebas ? "DATABASE_URL_PRUEBAS" : "DATABASE_URL";
  const cadena = process.env[nombreCadena] ?? variables[nombreCadena];
  if (!cadena) {
    throw new Error(`Falta ${nombreCadena} para escribir la cuenta.`);
  }

  const rama = pruebas ? "la rama de pruebas" : "la base principal";
  if (!confirmar) {
    console.log(`  · Comprobado: ${correo} sería administrador en ${rama}.`);
    console.log("  · No se escribió nada. Repite con --confirmar para aplicarlo.");
    return;
  }

  const cliente = new pg.Client({ connectionString: cadena, application_name: "bws-sembrar-admin" });
  await cliente.connect();
  try {
    const existente = await cliente.query(
      "select id, rol from usuarios where lower(correo) = lower($1)",
      [correo],
    );
    const fila = existente.rows[0];

    if (fila && fila.rol !== "admin") {
      throw new Error(`El correo ${correo} ya existe como cliente: no se promueve.`);
    }

    const hash = await hashearClave(clave);
    if (fila) {
      await cliente.query(
        `update usuarios
         set clave_hash = $2, nombre = $3, correo_verificado = true, bloqueado = false
         where id = $1 and rol = 'admin'`,
        [fila.id, hash, nombre],
      );
      console.log(`  · Clave actualizada para la administración ${correo} en ${rama}.`);
    } else {
      await cliente.query(
        `insert into usuarios (correo, clave_hash, nombre, rol, correo_verificado)
         values ($1, $2, $3, 'admin', true)`,
        [correo, hash, nombre],
      );
      console.log(`  · Administración ${correo} creada en ${rama}.`);
    }
  } finally {
    await cliente.end();
  }
}

principal().catch((error) => {
  console.error(`✗ ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
