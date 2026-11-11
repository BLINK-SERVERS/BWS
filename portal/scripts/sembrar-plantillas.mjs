/* ============================================================
   Publica las plantillas legales en la base
   ------------------------------------------------------------
   Las ocho plantillas viven en `portal/legal`. Para que un
   expediente tenga integridad referencial, cada una se publica en
   `plantillas` con su versión numérica, su contenido canónico y su
   SHA-256.

   Una versión publicada no se edita: si el contenido cambió, se
   publica otra versión y la anterior queda apagada. La API se
   niega a generar si la fila activa no coincide con el código.

   Uso:
     node portal/scripts/sembrar-plantillas.mjs
   ============================================================ */

import pg from "pg";
import { cargarEnv, exigir } from "./_env.mjs";
import { DOCUMENTOS } from "../legal/index.ts";
import { contenidoPlantilla } from "../legal/canonica.ts";
import { validarPlantilla } from "../legal/validar.ts";
import { hashPlantilla } from "../render/hash.ts";

export async function sembrarPlantillas(cliente) {
  const problemas = DOCUMENTOS.flatMap((doc) => validarPlantilla(doc));
  if (problemas.length) {
    throw new Error(
      `Plantilla inválida: ${problemas.map((p) => `${p.documento}: ${p.mensaje}`).join("; ")}`,
    );
  }

  let nuevas = 0;
  let vigentes = 0;
  for (const doc of DOCUMENTOS) {
    const version = Number.parseInt(doc.version, 10);
    if (!Number.isInteger(version) || version < 1) {
      throw new Error(`${doc.codigo}: la versión «${doc.version}» no es numérica.`);
    }
    const sha = hashPlantilla(doc);
    const contenido = contenidoPlantilla(doc);

    const publicada = await cliente.query(
      "select version, sha256 from plantillas where codigo = $1 and version = $2",
      [doc.codigo, version],
    );
    if (publicada.rowCount) {
      if (publicada.rows[0].sha256 !== sha) {
        throw new Error(
          `${doc.codigo}: la versión ${version} ya está publicada con otro contenido. ` +
            "Sube la versión de la plantilla en vez de reescribirla.",
        );
      }
      const activa = await cliente.query(
        "select version from plantillas where codigo = $1 and activa",
        [doc.codigo],
      );
      if (!activa.rowCount || Number(activa.rows[0].version) !== version) {
        await activar(cliente, doc.codigo, version);
      }
      vigentes += 1;
      continue;
    }

    await cliente.query(
      "update plantillas set activa = false where codigo = $1 and activa",
      [doc.codigo],
    );
    await cliente.query(
      `insert into plantillas (codigo, version, contenido, sha256, activa)
       values ($1, $2, $3::jsonb, $4, true)`,
      [doc.codigo, version, contenido, sha],
    );
    nuevas += 1;
  }

  return { nuevas, vigentes };
}

async function activar(cliente, codigo, version) {
  const activa = await cliente.query(
    "select codigo, version, contenido, sha256, publicada from plantillas where codigo = $1 and activa",
    [codigo],
  );
  if (activa.rowCount) {
    throw new Error(
      `${codigo}: la versión ${activa.rows[0].version} sigue activa; no se puede activar otra sin apagarla.`,
    );
  }
  // El disparador solo permite apagar, no reactivar; una versión
  // apagada se vuelve a publicar con una fila nueva.
  throw new Error(
    `${codigo}: la versión ${version} está publicada pero apagada. Publica una versión nueva.`,
  );
}

async function principal() {
  const variables = cargarEnv();
  const cliente = new pg.Client({
    connectionString: exigir(variables, "DATABASE_URL"),
    application_name: "bws-plantillas",
  });
  await cliente.connect();
  try {
    const resultado = await sembrarPlantillas(cliente);
    console.log(
      `✓ Plantillas al día: ${resultado.nuevas} nuevas, ${resultado.vigentes} ya publicadas.`,
    );
  } finally {
    await cliente.end();
  }
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  principal().catch((error) => {
    console.error(`✗ ${error.message}`);
    process.exitCode = 1;
  });
}
