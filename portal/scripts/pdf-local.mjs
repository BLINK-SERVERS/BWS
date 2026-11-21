/* ============================================================
   Genera y verifica sin red las doce muestras del contrato.
   Las firmas y los datos son ficticios, y el QR usa un dominio
   reservado .invalid. Cada ejecución ocupa una carpeta nueva dentro
   de tmp/muestras-legales-actualizadas, sin tocar entregas previas.

   Desde portal: node --import tsx scripts/pdf-local.mjs
   Requiere pdftotext, pdfinfo, pdffonts, pdfimages, pdftoppm y zbarimg.
   ============================================================ */

import { execFileSync } from "node:child_process";
import { lstat, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { CATEGORIAS_CONTRATO, CONTRATOS, PLANTILLAS_ACTUALES, datosDePrueba } from "../legal/index.ts";
import { nombreDocumento } from "../legal/nombre-documento.ts";
import { resolver, validarPlantilla, variablesUsadas } from "../legal/validar.ts";
import { PRESETS } from "../legal/planes.ts";
import { hashCadena, hashPlantilla, selloDeContenido } from "../render/hash.ts";
import { lectorNodo } from "../render/fuentes-nodo.ts";
import { generarPDF } from "../render/pdf.ts";
import { firmaPNG } from "./firma-png.mjs";

const MUESTRAS = fileURLToPath(new URL("../tmp/muestras-legales-actualizadas", import.meta.url));
const UTC = "2026-11-11T14:30:00.000Z";
const FECHA = new Date(UTC);
const MARCA = "MUESTRA SIN VALIDEZ";
const errores = [];

function ejecutar(comando, args, opciones = {}) {
  try {
    return execFileSync(comando, args, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      maxBuffer: 20 * 1024 * 1024,
      ...opciones,
    });
  } catch (error) {
    const detalle = error.code === "ENOENT" ? "no está instalado" : String(error.stderr || error.message).trim();
    throw new Error(`${comando}: ${detalle}`);
  }
}

function verificarHerramientas() {
  for (const comando of ["pdftotext", "pdfinfo", "pdffonts", "pdfimages", "pdftoppm"]) {
    ejecutar(comando, ["-v"]);
  }
  ejecutar("zbarimg", ["--version"]);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function urlDeMuestra(doc) {
  // UUID de prueba estable y distinto para cada contrato, nunca registrado.
  const numero = doc.codigo.slice(-3);
  const uuid = `00000000-0000-4000-8000-${numero.padStart(12, "0")}`;
  return `https://muestra.invalid/verificar/${uuid}`;
}

function datosDeMuestra(opciones) {
  const datos = datosDePrueba(opciones);
  datos.variables.cliente_razon_social = opciones.persona === "natural"
    ? `${MARCA} Cliente de prueba`
    : `${MARCA} Cliente de prueba, C.A.`;
  datos.variables.proyecto_nombre = `${MARCA} Tienda Ejemplo`;
  // El dato de prueba original contiene punto y coma, no la plantilla.
  datos.variables.proyecto_alcance = "Catálogo de productos con fotografías, carrito de compras, pago con referencia bancaria, panel de pedidos y cinco correos corporativos. La administración de contenidos se limita a productos, precios y pedidos. No incluye facturación fiscal automática ni integración con inventario externo.";
  return datos;
}

function verificarTexto(ruta, doc, paginasEsperadas) {
  const bruto = ejecutar("pdftotext", ["-layout", ruta, "-"]);
  const paginas = bruto.split("\f");
  if (!paginas.at(-1).trim()) paginas.pop();
  const texto = bruto.replace(/\s+/g, " ");
  const desnudo = (valor) => valor.normalize("NFC").toUpperCase().replace(/[^\p{L}\p{N}]/gu, "");
  const fallo = (mensaje) => errores.push(`${doc.codigo}: ${mensaje}`);

  if (paginas.length !== paginasEsperadas) fallo("el texto extraído no coincide con el número de páginas");
  if (texto.includes("{{")) fallo("quedaron marcadores sin resolver");
  if (/\bBWS\s*[-–]\s*[A-Z]{3}\s*[-–]\s*\d{3}\b/i.test(texto)) fallo("aparece un código de documento visible");
  if (/[;«»·]/.test(texto)) fallo("aparece punto y coma, comilla angular o punto medio");
  if (/\b(?:undefined|null)\b/.test(texto)) fallo("el texto contiene undefined/null");
  if (/constancia\s+de\s+evidencia/i.test(texto)) fallo("aparece la página de evidencia");
  if (!desnudo(paginas[0] ?? "").includes(desnudo(doc.titulo))) fallo("falta el título completo del documento");
  if (doc.codigo.startsWith("BWS-CON-") && !texto.includes("Powered by Blink")) fallo("falta el crédito Powered by Blink");
  if (!paginas[0]?.replace(/\s+/g, " ").includes(MARCA)) fallo("la primera página no identifica la muestra");

  for (const [indice, pagina] of paginas.entries()) {
    const normalizada = pagina.replace(/\s+/g, " ");
    for (const linea of ["Blink Technology Corporation", "División: Blink Web Services (BWS)", "RIF: J-50898639-3"]) {
      if (!normalizada.includes(linea)) fallo(`falta el membrete en la página ${indice + 1}: ${linea}`);
    }
  }

  const firmas = paginas.at(-1)?.replace(/\s+/g, " ") ?? "";
  for (const textoFirma of [
    "Firmas",
    "Firma representante legal",
    "Firma cliente",
    MARCA,
  ]) {
    if (!firmas.includes(textoFirma)) fallo(`falta ${textoFirma} en la última página de firmas`);
  }

  const paginaI = paginas.findIndex((p) => /^[ \t]*CAP[IÍ]TULO[ \t]+I[ \t]*$/mi.test(p));
  const paginaII = paginas.findIndex((p) => /^[ \t]*CAP[IÍ]TULO[ \t]+II[ \t]*$/mi.test(p));
  if (doc.codigo.startsWith("BWS-CON-") && (paginaI < 0 || paginaII !== paginaI + 1)) fallo("el capítulo II no comienza en la página siguiente al capítulo I");
}

function verificarInfo(ruta, doc) {
  const info = ejecutar("pdfinfo", [ruta]);
  const paginas = Number(/Pages:\s+(\d+)/.exec(info)?.[1] ?? 0);
  if (!paginas) throw new Error(`${doc.codigo}: pdfinfo no reporta páginas`);
  const version = /PDF version:\s+([\d.]+)/.exec(info)?.[1];
  if (version !== "1.7") errores.push(`${doc.codigo}: versión PDF ${version ?? "desconocida"}, se esperaba 1.7`);

  const detalle = ejecutar("pdfinfo", ["-f", "1", "-l", String(paginas), ruta]);
  const tamanos = [...detalle.matchAll(/Page\s+(\d+)\s+size:\s+([\d.]+)\s+x\s+([\d.]+)\s+pts/g)];
  if (tamanos.length !== paginas) errores.push(`${doc.codigo}: no se pudo verificar el tamaño de todas las páginas`);
  for (const [, numero, ancho, alto] of tamanos) {
    if (Math.abs(Number(ancho) - 595.28) > 0.05 || Math.abs(Number(alto) - 841.89) > 0.05) {
      errores.push(`${doc.codigo}: la página ${numero} no es A4 (${ancho} x ${alto} pts)`);
    }
  }
  return paginas;
}

function verificarFuentes(ruta, doc) {
  const salida = ejecutar("pdffonts", [ruta]);
  const lineas = salida.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("name") && !l.startsWith("-"));
  if (!lineas.length) errores.push(`${doc.codigo}: pdffonts no reporta fuentes`);
  for (const linea of lineas) {
    // Las columnas finales son emb, sub, uni, object ID, incluso con tipos de varias palabras.
    if (!/\s+yes\s+(?:yes|no)\s+(?:yes|no)\s+\d+\s+\d+\s*$/.test(linea)) {
      errores.push(`${doc.codigo}: fuente sin incrustar o salida inesperada (${linea})`);
    }
  }
  if (doc.estilo === "clasico" && !/Inter/.test(salida)) errores.push(`${doc.codigo}: el estilo clásico debe usar Inter`);
}

function verificarFirmasYQR(ruta, doc, paginas, url) {
  const imagenes = ejecutar("pdfimages", ["-list", ruta]);
  const firmas = [...imagenes.matchAll(/^\s*(\d+)\s+\d+\s+image\s+/gm)]
    .filter((match) => Number(match[1]) === paginas);
  if (firmas.length < 2) errores.push(`${doc.codigo}: faltan las dos imágenes de firma en la última página`);

  try {
    const imagen = ejecutar("pdftoppm", ["-f", String(paginas), "-l", String(paginas), "-r", "150", "-singlefile", "-png", ruta], { encoding: null });
    const leida = ejecutar("zbarimg", ["--nodbus", "--quiet", "--raw", "-"], { input: imagen }).trim();
    if (leida !== url) errores.push(`${doc.codigo}: el QR no contiene la URL de muestra esperada`);
  } catch (error) {
    errores.push(`${doc.codigo}: no se pudo leer el QR de muestra (${error.message})`);
  }
}

async function generar(doc, datos, firmas, evidencia, urlVerificacion) {
  return generarPDF({
    doc: resolver(doc, datos),
    datos,
    firmas,
    evidencia,
    urlVerificacion,
    fechaCreacion: FECHA,
    leerFuente: lectorNodo,
  });
}

async function crearDirectorioDeEjecucion() {
  try {
    await mkdir(MUESTRAS);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
  const info = await lstat(MUESTRAS);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("El directorio de muestras no es un directorio real");
  return mkdtemp(join(MUESTRAS, "ejecucion-"));
}

async function principal() {
  verificarHerramientas();
  const codigosEsperados = Array.from({ length: 12 }, (_, i) => `BWS-CON-${String(i + 9).padStart(3, "0")}`);
  if (CONTRATOS.length !== 12 || [...CONTRATOS.map((doc) => doc.codigo)].sort().join() !== codigosEsperados.join()) {
    throw new Error("Se esperaban exactamente las doce variantes BWS-CON-009 a BWS-CON-020");
  }

  for (const doc of CONTRATOS) {
    for (const problema of validarPlantilla(doc)) errores.push(`plantilla ${problema.documento}: ${problema.mensaje}`);
  }

  // Solo se comprueban los campos de plan que la plantilla todavía utiliza.
  for (const preset of PRESETS) {
    for (const nivel of preset.niveles) {
      for (const [i, doc] of CONTRATOS.entries()) {
        const persona = i % 2 === 0 ? "natural" : "juridica";
        const datos = datosDeMuestra({ preset: preset.clave, nivel: nivel.clave, persona });
        try {
          const texto = JSON.stringify(resolver(doc, datos).bloques);
          const usadas = new Set(variablesUsadas(doc));
          for (const campo of ["plan_nombre", "plan_precio", "plan_fuente", "plan_fecha"]) {
            if (usadas.has(campo) && !texto.includes(datos.variables[campo])) {
              errores.push(`${doc.codigo}: ${preset.clave}/${nivel.clave} no resuelve ${campo}`);
            }
          }
        } catch (error) {
          errores.push(`${doc.codigo}: ${preset.clave}/${nivel.clave} no resuelve (${error.message})`);
        }
      }
    }
  }
  if (errores.length) throw new Error(`Validación previa fallida:\n${errores.join("\n")}`);

  const salida = await crearDirectorioDeEjecucion();
  console.log(`Muestras sin validez en ${salida}`);
  const pngRep = firmaPNG("representante");
  const pngCli = firmaPNG("cliente");
  await writeFile(join(salida, "representante.png"), pngRep, { flag: "wx" });
  await writeFile(join(salida, "cliente.png"), pngCli, { flag: "wx" });

  function firmasDe(datos) {
    return {
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
  }

  const resumen = [];
  let anterior = "GENESIS";
  const documentos = [...CONTRATOS, ...PLANTILLAS_ACTUALES.filter((doc) => !doc.codigo.startsWith("BWS-CON-"))];
  for (const [indice, doc] of documentos.entries()) {
    const persona = indice < CONTRATOS.length && indice % 2 === 1 ? "juridica" : "natural";
    const categoria = indice < CONTRATOS.length ? CATEGORIAS_CONTRATO[Math.floor(indice / 2)].categoria : "Sitio web";
    const datos = datosDeMuestra({ persona });
    datos.variables.proyecto_categoria = categoria;
    const firmas = firmasDe(datos);
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

    const url = urlDeMuestra(doc);
    const nombreBase = nombreDocumento(doc.titulo, persona, categoria, datos.variables.cliente_razon_social);
    const bytes = await generar(doc, datos, firmas, evidencia, url);
    const segunda = await generar(doc, datos, firmas, evidencia, url);
    const hash = sha256(bytes);
    if (hash !== sha256(segunda)) errores.push(`${doc.codigo}: el PDF no es reproducible`);

    const ruta = join(salida, `${nombreBase}.pdf`);
    await writeFile(ruta, bytes, { flag: "wx" });
    const paginas = verificarInfo(ruta, doc);
    verificarTexto(ruta, doc, paginas);
    verificarFuentes(ruta, doc);
    verificarFirmasYQR(ruta, doc, paginas, url);

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
      url_muestra_no_funcional: url,
    });
    anterior = cadena;
    console.log(`  ${doc.codigo}: ${paginas} páginas, sha256 ${hash.slice(0, 12)}…`);
  }

  await writeFile(join(salida, "resumen.json"), JSON.stringify({ tipo: MARCA, documentos: resumen }, null, 2) + "\n", { flag: "wx" });
  if (errores.length) throw new Error(`${errores.length} problemas:\n${errores.join("\n")}`);
  console.log(`✓ ${resumen.length} PDF de muestra verificados sin red en ${salida}`);
}

principal().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
