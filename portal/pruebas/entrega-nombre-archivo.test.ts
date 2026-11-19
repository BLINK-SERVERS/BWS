import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, beforeEach, describe, it } from "node:test";
import { neonConfig } from "@neondatabase/serverless";
import { nombreDocumento } from "../legal/nombre-documento.ts";
import { disposicionPdf, nombreArchivoPdf } from "../server/_lib/nombre-archivo.ts";
import { enviarExpediente } from "../server/_lib/envio-expediente.ts";
import type { Sesion } from "../server/_lib/sesion.ts";
import descargar from "../server/documentos/descargar.ts";

const PROYECTO = "01234567-89ab-cdef-0123-456789abcdef";
const USUARIO = "01234567-89ab-cdef-0123-456789abcdea";
const CODIGO = "BWS-CON-009";
const NOMBRE = nombreDocumento("Contrato de servicios", "natural", "Sitio web", "Ana Pérez 中文");
const HASH_ORIGINAL = "a".repeat(64);
const HASH_AJUSTADO = "b".repeat(64);
const HASH_CADENA = "c".repeat(64);
const sesion: Sesion = {
  usuarioId: USUARIO, rol: "cliente", nombre: "Ana", correo: "ana@example.test",
  verificado: true, expira: new Date("2030-01-01T00:00:00Z"),
};

describe("nombre del PDF", () => {
  it("usa el nombre congelado con Unicode, con o sin extensión", () => {
    assert.equal(nombreArchivoPdf(NOMBRE, CODIGO, 2, false), `${NOMBRE}.pdf`);
    assert.equal(nombreArchivoPdf(`${NOMBRE}.pdf`, CODIGO, 2, false), `${NOMBRE}.pdf`);
    assert.equal(nombreArchivoPdf(NOMBRE, CODIGO, 2, true), `${NOMBRE}-ajustado.pdf`);
    assert.ok(new TextEncoder().encode(`${NOMBRE}-ajustado.pdf`).length < 255);
  });

  it("conserva el nombre de expedientes históricos y marca los ajustes", () => {
    assert.equal(nombreArchivoPdf(null, CODIGO, 2, false), "BWS-CON-009-v2.pdf");
    assert.equal(nombreArchivoPdf(null, CODIGO, 2, true), "BWS-CON-009-v2-ajustado.pdf");
  });

  it("rechaza nombres guardados inseguros, incluidos controles al final", () => {
    for (const nombre of ["", "../archivo.pdf", "x\r\nX-Inyectada: si", "CONTRATO\n", "archivo.pdf.exe", "x".repeat(231), "\ud800"]) {
      assert.equal(nombreArchivoPdf(nombre, CODIGO, 2, false), "BWS-CON-009-v2.pdf", nombre);
    }
    assert.equal(nombreArchivoPdf(null, "BWS-CON-009\n", NaN, false), "documento-v0.pdf");
  });

  it("construye Content-Disposition ASCII y UTF-8 sin inyección", () => {
    const nombre = nombreArchivoPdf(`${NOMBRE}.pdf`, CODIGO, 1, true);
    const cabecera = disposicionPdf(nombre);
    assert.match(cabecera, /^attachment; filename="[A-Za-z0-9._-]+"; filename\*=UTF-8''[A-Za-z0-9%._-]+$/);
    assert.match(cabecera, /PEREZ/);
    assert.equal(decodeURIComponent(cabecera.split("filename*=UTF-8''")[1]), nombre);
    assert.equal(new Headers({ "content-disposition": cabecera }).get("content-disposition"), cabecera);
    for (const peligroso of ["archivo.pdf\n", "archivo\r\nX-Inyectada.pdf", "../archivo.pdf", "\ud800.pdf"]) {
      assert.equal(disposicionPdf(peligroso), `attachment; filename="documento.pdf"; filename*=UTF-8''documento.pdf`);
    }
  });

  it("la migración agrega una columna nullable sin modificar los históricos", () => {
    const sql = readFileSync(new URL("../db/migrations/0019_nombre_archivo_documento.sql", import.meta.url), "utf8");
    assert.match(sql, /alter table documentos add column if not exists nombre_archivo text\s*;/i);
    assert.doesNotMatch(sql, /\b(update|default|not null)\b/i);
    const inmutabilidad = readFileSync(new URL("../db/migrations/0002_inmutabilidad.sql", import.meta.url), "utf8");
    assert.match(inmutabilidad, /'documentos'/);
    assert.match(inmutabilidad, /before update or delete/i);
  });
});

type Fila = Record<string, string | null>;
type Consulta = { query: string; params: string[] };
type Correo = { subject: string; text: string; attachments: { filename: string; content: string }[] };
const originalFetch = globalThis.fetch;
const originalNeonFetch = neonConfig.fetchFunction;
const variables = ["DATABASE_URL_APP", "ENTORNO", "CORREO_MODO", "CORREO_API_KEY", "CORREO_DESDE", "APP_ORIGEN"] as const;
const originalEnv = Object.fromEntries(variables.map((nombre) => [nombre, process.env[nombre]]));
let consultas: Consulta[] = [];
let correos: Correo[] = [];
let filasDocumentos: Fila[] = [];
let filasEnvios: Fila[] = [];

function documento(ajustado: boolean, nombre: string | null = NOMBRE): Fila {
  return {
    id: "01234567-89ab-cdef-0123-456789abcd01", plantilla_codigo: CODIGO,
    plantilla_version: "2", orden: "1", titulo: "Contrato de servicios", nombre_archivo: nombre,
    pdf: ajustado ? "\\x255044462d414a" : "\\x255044462d4f52",
    hash_archivo: HASH_ORIGINAL, hash_servido: ajustado ? HASH_AJUSTADO : HASH_ORIGINAL,
    hash_cadena: HASH_CADENA, ajustado: ajustado ? "t" : "f",
  };
}

function resultado(filas: Fila[]) {
  const nombres = filas.length ? Object.keys(filas[0]) : [];
  return {
    fields: nombres.map((name) => ({ name, dataTypeID: name === "pdf" ? 17 : name === "ajustado" ? 16 : 25 })),
    rows: filas.map((fila) => nombres.map((nombre) => fila[nombre])),
  };
}

function ejecutar(consulta: Consulta): ReturnType<typeof resultado> {
  consultas.push(consulta);
  const sql = consulta.query;
  if (sql.includes("bws_sesion_valida")) return resultado([{
    usuario_id: USUARIO, rol: "cliente", nombre: "Ana", correo: "ana@example.test",
    verificado: "t", expira: "2030-01-01T00:00:00Z",
  }]);
  if (sql.includes("from planes_infra")) return resultado([{
    clave: "neon-cloudflare", nivel: "inicial", version: "1", nombre: "Inicial",
    precio_usd: "10", limites: "[]", fuente: "Prueba", fecha: "2026-01-01",
  }]);
  if (sql.includes("from proyectos p") && sql.includes("c.razon_social")) return resultado([{
    id: PROYECTO, nombre: "Proyecto de prueba", estado: "aprobado",
    razon_social: "Ana Pérez", correo: "ana@example.test", contacto: "Ana",
  }]);
  if (sql.includes("from proyectos p")) return resultado([{
    id: PROYECTO, nombre: "Proyecto de prueba", categoria: "Sitio web", dominio: "example.test",
    alcance: "Proyecto", complejidad: "simple", plan_clave: "neon-cloudflare", plan_nivel: "inicial",
    plan_version: "1", estado: "aprobado", creado: "2026-01-01", enviado: "2026-01-02",
  }]);
  if (sql.includes("with doc as (") || sql.includes("join plantillas p")) return resultado(filasDocumentos);
  if (sql.includes("from actos_firma")) return resultado([{
    total: String(filasDocumentos.length * 2), cliente: String(filasDocumentos.length),
    representante: String(filasDocumentos.length),
  }]);
  if (sql.includes("from envios")) return resultado(filasEnvios);
  if (sql.includes("from licencias")) return resultado([{ estado: "activa" }]);
  if (sql.includes("set_config") || sql.includes("insert into") || sql.includes("update proyectos")) return resultado([]);
  throw new Error(`Consulta inesperada: ${sql}`);
}

before(() => {
  process.env.DATABASE_URL_APP = "postgresql://bws_app:prueba@localhost/prueba";
  process.env.ENTORNO = "local";
  process.env.CORREO_MODO = "resend";
  process.env.CORREO_API_KEY = "prueba";
  process.env.CORREO_DESDE = "prueba@example.test";
  process.env.APP_ORIGEN = "https://example.test";
  neonConfig.fetchFunction = async (_url: string, opciones: RequestInit) => {
    const body = JSON.parse(String(opciones.body)) as Consulta | { queries: Consulta[] };
    return Response.json("queries" in body
      ? { results: body.queries.map(ejecutar) }
      : ejecutar(body));
  };
  globalThis.fetch = async (input, opciones) => {
    assert.equal(String(input), "https://api.resend.com/emails");
    correos.push(JSON.parse(String(opciones?.body)) as Correo);
    return Response.json({ id: "correo-prueba" });
  };
});

beforeEach(() => {
  consultas = [];
  correos = [];
  filasDocumentos = [documento(false)];
  filasEnvios = [];
});

after(() => {
  globalThis.fetch = originalFetch;
  neonConfig.fetchFunction = originalNeonFetch;
  for (const nombre of variables) {
    const valor = originalEnv[nombre];
    if (valor === undefined) delete process.env[nombre];
    else process.env[nombre] = valor;
  }
});

describe("descarga y correo con transportes simulados", () => {
  it("no descarga ni consulta sin una sesión", async () => {
    const respuesta = await descargar(new Request(`https://example.test/api/documentos/descargar?codigo=${CODIGO}`));
    assert.equal(respuesta.status, 401);
    assert.equal(consultas.length, 0);
  });

  it("descarga bytes originales o ajustados con nombre congelado y auditoría", async () => {
    for (const ajustado of [false, true]) {
      consultas = [];
      filasDocumentos = [documento(ajustado)];
      const respuesta = await descargar(new Request(`https://example.test/api/documentos/descargar?codigo=${CODIGO}`, {
        headers: { cookie: `bws_sesion=${"x".repeat(43)}` },
      }));
      assert.equal(respuesta.status, 200);
      const nombre = `${NOMBRE}${ajustado ? "-ajustado" : ""}.pdf`;
      assert.equal(respuesta.headers.get("content-disposition"), disposicionPdf(nombre));
      assert.equal(respuesta.headers.get("x-bws-sha256"), ajustado ? HASH_AJUSTADO : HASH_ORIGINAL);
      assert.equal(respuesta.headers.get("x-bws-ajuste"), ajustado ? HASH_ORIGINAL : null);
      assert.equal(Buffer.from(await respuesta.arrayBuffer()).toString(), ajustado ? "%PDF-AJ" : "%PDF-OR");
      const consulta = consultas.find((item) => item.query.includes("with doc as ("));
      assert.ok(consulta);
      assert.match(consulta.query, /d\.nombre_archivo/);
      assert.match(consulta.query, /insert into eventos/);
      assert.match(consulta.query, /hash_servido/);
    }
  });

  it("usa el nombre histórico también en la descarga", async () => {
    filasDocumentos = [documento(true, null)];
    const respuesta = await descargar(new Request(`https://example.test/api/documentos/descargar?codigo=${CODIGO}`, {
      headers: { cookie: `bws_sesion=${"x".repeat(43)}` },
    }));
    assert.equal(respuesta.status, 200);
    assert.equal(respuesta.headers.get("content-disposition"), disposicionPdf("BWS-CON-009-v2-ajustado.pdf"));
  });

  it("usa el fallback seguro en descarga y correo si el nombre guardado fue alterado", async () => {
    filasDocumentos = [documento(false, "contrato\r\nX-Inyectada: si")];
    const respuesta = await descargar(new Request(`https://example.test/api/documentos/descargar?codigo=${CODIGO}`, {
      headers: { cookie: `bws_sesion=${"x".repeat(43)}` },
    }));
    assert.equal(respuesta.status, 200);
    assert.equal(respuesta.headers.get("content-disposition"), disposicionPdf("BWS-CON-009-v2.pdf"));
    assert.equal(respuesta.headers.get("x-inyectada"), null);
    await enviarExpediente(sesion, PROYECTO, null, null);
    assert.equal(correos[0].attachments[0].filename, "BWS-CON-009-v2.pdf");
  });

  it("adjunta nombres congelados e históricos y distingue ajustes sin códigos ni hashes", async () => {
    filasDocumentos = [documento(false), {
      ...documento(true, null), id: "01234567-89ab-cdef-0123-456789abcd02",
      plantilla_codigo: "BWS-CON-010", orden: "2", titulo: "Anexo comercial",
    }];
    const respuesta = await enviarExpediente(sesion, PROYECTO, null, null);
    assert.equal(respuesta.reutilizado, false);
    assert.equal(respuesta.hash_final, HASH_CADENA);
    assert.equal(correos.length, 1);
    const correo = correos[0];
    assert.match(correo.subject, /^Expediente del proyecto/);
    assert.doesNotMatch(correo.subject, /firmad/i);
    assert.deepEqual(correo.attachments.map((adjunto) => adjunto.filename), [
      `${NOMBRE}.pdf`, "BWS-CON-010-v2-ajustado.pdf",
    ]);
    assert.equal(Buffer.from(correo.attachments[1].content, "base64").toString(), "%PDF-AJ");
    assert.match(correo.text, /Contrato de servicios — original firmado/);
    assert.match(correo.text, /Anexo comercial — copia ajustada por Blink/);
    assert.match(correo.text, /firmas registradas no acreditan esas copias/);
    assert.doesNotMatch(correo.text, /BWS-CON-|hash|SHA-256|[a-f0-9]{16,}/i);
    assert.match(consultas.find((item) => item.query.includes("join plantillas p"))?.query ?? "", /d\.nombre_archivo/);
    const envios = consultas.filter((item) => item.query.includes("insert into envios"));
    assert.equal(envios.length, 2);
    assert.ok(envios[0].params.includes(`expediente/${PROYECTO}/${CODIGO}/v2/${HASH_ORIGINAL}`));
    assert.ok(envios[1].params.includes(`expediente/${PROYECTO}/BWS-CON-010/v2/${HASH_AJUSTADO}`));
    const evento = consultas.find((item) => item.query.includes("insert into eventos"));
    assert.ok(evento?.params.some((parametro) => parametro.includes(HASH_CADENA)));
  });

  it("conserva la idempotencia y envía de nuevo si cambia el hash del archivo", async () => {
    filasEnvios = [{ clave_idempotencia: `expediente/${PROYECTO}/${CODIGO}/v2/${HASH_ORIGINAL}`, mensaje_id: "previo" }];
    const repetido = await enviarExpediente(sesion, PROYECTO, null, null);
    assert.equal(repetido.reutilizado, true);
    assert.equal(correos.length, 0);
    filasDocumentos = [documento(true)];
    const nuevo = await enviarExpediente(sesion, PROYECTO, null, null);
    assert.equal(nuevo.reutilizado, false);
    assert.equal(correos.length, 1);
    assert.equal(correos[0].attachments[0].filename, `${NOMBRE}-ajustado.pdf`);
  });

  it("presenta como firmado únicamente el original sin ajustes", async () => {
    await enviarExpediente(sesion, PROYECTO, null, null);
    assert.match(correos[0].subject, /^Expediente firmado/);
    assert.match(correos[0].text, /original firmado/);
    assert.doesNotMatch(correos[0].text, /BWS-CON-|hash|SHA-256|[a-f0-9]{16,}/i);
  });
});
