/* ============================================================
   Genera los ocho PDF de muestra y los verifica sin red.
   ------------------------------------------------------------
   · Valida que cada plantilla use solo variables declaradas.
   · Resuelve los datos de prueba y genera A4 con fuentes embebidas.
   · Comprueba con pdftotext / pdfinfo / pdffonts (si están).
   · Vuelve a generar cada PDF y compara el hash: el mismo insumo
     debe producir el mismo archivo.
   · Encadena los documentos con GENESIS y guarda el resumen.

   npx tsx scripts/pdf-local.mjs
   ============================================================ */

import { execFileSync } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { DOCUMENTOS, datosDePrueba } from "../legal/index.ts";
import { resolver, validarPlantilla } from "../legal/validar.ts";
import { PRESETS } from "../legal/planes.ts";
import { hashCadena, hashPlantilla, selloDeContenido, sha256Hex } from "../render/hash.ts";
import { lectorNodo } from "../render/fuentes-nodo.ts";
import { generarPDF } from "../render/pdf.ts";
import { firmaPNG } from "./firma-png.mjs";

const RAIZ = new URL("..", import.meta.url);
const TMP = new URL("tmp/", RAIZ);
const SALIDA = new URL("tmp/pdf/", RAIZ);
const FIRMAS = new URL("tmp/firmas/", RAIZ);
const UTC = "2026-11-11T14:30:00.000Z";
const FECHA = new Date(UTC);

const errores = [];
const avisos = [];

function ejecutar(comando, args) {
  try {
    return execFileSync(comando, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    if (error.code === "ENOENT") return null;
    return typeof error.stdout === "string" ? error.stdout : null;
  }
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function verificarTexto(ruta, doc) {
  const texto = ejecutar("pdftotext", ["-layout", ruta, "-"]);
  if (texto === null) {
    avisos.push("pdftotext no está disponible: se omite la revisión del texto");
    return;
  }
  if (texto.includes("{{")) errores.push(`${doc.codigo}: quedaron marcadores {{ en el PDF`);
  if (!texto.includes(doc.codigo)) errores.push(`${doc.codigo}: el código no aparece en el texto`);
  if (!texto.includes(doc.titulo.slice(0, 24))) errores.push(`${doc.codigo}: el título no aparece en el texto`);
  if (!texto.includes("Firmas")) errores.push(`${doc.codigo}: falta la página de firmas`);
  if (!texto.includes("Constancia de evidencia")) errores.push(`${doc.codigo}: falta la página de evidencia`);
  if (!texto.includes("Powered by Blink")) errores.push(`${doc.codigo}: falta el crédito en el pie`);
  if (/undefined|null/.test(texto)) errores.push(`${doc.codigo}: el texto contiene undefined/null`);
}

function verificarInfo(ruta, doc) {
  const info = ejecutar("pdfinfo", [ruta]);
  if (info === null) {
    avisos.push("pdfinfo no está disponible: se omite la revisión de tamaño y versión");
    return 0;
  }
  const paginas = Number(/Pages:\s+(\d+)/.exec(info)?.[1] ?? 0);
  if (!paginas) errores.push(`${doc.codigo}: pdfinfo no reporta páginas`);
  if (!/595\.(28|27|276)\s+x\s+841\.(89|88)/.test(info)) {
    errores.push(`${doc.codigo}: la página no es A4 (${info.split("\n").find((l) => l.includes("Page size")) ?? "sin dato"})`);
  }
  const version = /PDF version:\s+([\d.]+)/.exec(info)?.[1];
  if (version !== "1.7") errores.push(`${doc.codigo}: versión PDF ${version ?? "desconocida"}, se esperaba 1.7`);
  return paginas;
}

function verificarFuentes(ruta, doc) {
  const salida = ejecutar("pdffonts", [ruta]);
  if (salida === null) {
    avisos.push("pdffonts no está disponible: se omite la revisión de fuentes");
    return;
  }
  const lineas = salida
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("name") && !l.startsWith("-"));
  if (!lineas.length) {
    errores.push(`${doc.codigo}: pdffonts no reporta fuentes`);
    return;
  }
  for (const linea of lineas) {
    const columnas = linea.split(/\s+/);
    // pdffonts: nombre, tipo, codificación, incrustada, subconjunto, unicode…
    const incrustada = columnas[4] ?? "";
    if (incrustada !== "yes") {
      errores.push(`${doc.codigo}: fuente sin incrustar (${linea})`);
    }
  }
}

async function generar(doc, datos, firmas, evidencia) {
  const resuelto = resolver(doc, datos);
  return generarPDF({
    doc: resuelto,
    datos,
    firmas,
    evidencia,
    fechaCreacion: FECHA,
    leerFuente: lectorNodo,
  });
}

async function principal() {
  await rm(TMP, { recursive: true, force: true });
  await mkdir(SALIDA, { recursive: true });
  await mkdir(FIRMAS, { recursive: true });

  // 1. Plantillas
  for (const doc of DOCUMENTOS) {
    const problemas = validarPlantilla(doc);
    for (const p of problemas) errores.push(`plantilla ${p.documento}: ${p.mensaje}`);
  }
  if (errores.length) {
    console.error("✗ Las plantillas tienen problemas:");
    errores.forEach((e) => console.error("  " + e));
    process.exit(1);
  }

  // 2. Variantes de plan: el anexo B debe resolverse con ambos presets.
  for (const preset of PRESETS) {
    for (const nivel of preset.niveles) {
      const datos = datosDePrueba({ preset: preset.clave, nivel: nivel.clave });
      const con = DOCUMENTOS.find((d) => d.codigo === "BWS-CON-004");
      try {
        const resuelto = resolver(con, datos);
        const texto = JSON.stringify(resuelto.bloques);
        if (!texto.includes(nivel.nombre) || !texto.includes(nivel.fuente)) {
          errores.push(`anexo B: ${preset.clave}/${nivel.clave} no imprime el plan elegido`);
        }
      } catch (error) {
        errores.push(`anexo B: ${preset.clave}/${nivel.clave} no resuelve (${error.message})`);
      }
    }
  }

  // 3. Firmas de muestra
  const pngRep = firmaPNG("representante");
  const pngCli = firmaPNG("cliente");
  await writeFile(new URL("representante.png", FIRMAS), pngRep);
  await writeFile(new URL("cliente.png", FIRMAS), pngCli);

  const datos = datosDePrueba();
  const firmas = {
    representante: {
      png: pngRep,
      nombre: datos.variables.representante_nombre,
      documento: datos.variables.representante_documento,
      correo: datos.variables.bws_correo,
      utc: UTC,
      ip: "127.0.0.1",
      agente: "Generación local de muestra",
      metodo: "simple_reforzada",
    },
    cliente: {
      png: pngCli,
      nombre: datos.variables.cliente_razon_social,
      documento: datos.variables.cliente_documento_numero,
      correo: datos.variables.cliente_correo,
      utc: UTC,
      ip: "127.0.0.1",
      agente: "Generación local de muestra",
      metodo: "simple_reforzada",
    },
  };

  // 4. Generación y verificación
  const resumen = [];
  let anterior = "GENESIS";

  for (const [indice, doc] of DOCUMENTOS.entries()) {
    const orden = indice + 1;
    const sello = selloDeContenido({ doc, datos, firmas: [firmas.representante, firmas.cliente], utc: UTC });
    const cadena = hashCadena(anterior, sello, orden);
    const evidencia = {
      sello,
      hashPlantilla: hashPlantilla(doc),
      hashCadena: cadena,
      hashAnterior: anterior,
      orden,
      utc: UTC,
      ip: "127.0.0.1",
      agente: "Generación local de muestra",
    };

    const bytes = await generar(doc, datos, firmas, evidencia);
    const segunda = await generar(doc, datos, firmas, evidencia);
    const hash = sha256(bytes);
    const hashSegunda = sha256(segunda);
    if (hash !== hashSegunda) {
      errores.push(`${doc.codigo}: el PDF no es reproducible (${hash.slice(0, 12)} ≠ ${hashSegunda.slice(0, 12)})`);
    }

    const ruta = join(SALIDA.pathname, `${doc.codigo}.pdf`);
    await writeFile(ruta, bytes);
    verificarTexto(ruta, doc);
    const paginas = verificarInfo(ruta, doc);
    verificarFuentes(ruta, doc);

    resumen.push({
      codigo: doc.codigo,
      titulo: doc.titulo,
      version: doc.version,
      paginas,
      bytes: bytes.length,
      archivo_sha256: hash,
      plantilla_sha256: evidencia.hashPlantilla,
      sello,
      cadena,
      anterior,
    });
    anterior = cadena;
    console.log(
      `  ${doc.codigo.padEnd(12)} ${String(paginas).padStart(2)} pág.  ${(bytes.length / 1024).toFixed(0).padStart(4)} KB  sello ${sello.slice(0, 12)}…`,
    );
  }

  await writeFile(new URL("resumen.json", SALIDA), JSON.stringify(resumen, null, 2) + "\n");

  if (avisos.length) {
    console.log("\nAvisos:");
    avisos.forEach((a) => console.log("  · " + a));
  }
  if (errores.length) {
    console.error(`\n✗ ${errores.length} problemas:`);
    errores.forEach((e) => console.error("  " + e));
    process.exit(1);
  }
  console.log(
    `\n✓ ${DOCUMENTOS.length} PDF generados en portal/tmp/pdf, A4, fuentes embebidas, reproducibles y con cadena desde GENESIS.`,
  );
}

principal().catch((error) => {
  console.error(error);
  process.exit(1);
});
