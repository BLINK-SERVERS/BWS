/* Ramas HTTP y protocolo transaccional con el transporte Neon simulado: sin red ni DB. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { after, before, beforeEach, test } from "node:test";
import { neonConfig } from "@neondatabase/serverless";
import firmar from "../server/documentos/firmar.ts";
import ajustar from "../server/admin/documentos/ajustar.ts";

const proyecto = "11111111-1111-4111-8111-111111111111";
const otroProyecto = "22222222-2222-4222-8222-222222222222";
const cliente = "33333333-3333-4333-8333-333333333333";
const admin = "44444444-4444-4444-8444-444444444444";
const firma = "55555555-5555-4555-8555-555555555555";
const doc1 = "66666666-6666-4666-8666-666666666666";
const doc2 = "77777777-7777-4777-8777-777777777777";
const docOtro = "88888888-8888-4888-8888-888888888888";
const tokenCliente = "c".repeat(43);
const tokenAdmin = "a".repeat(43);
const hash = (datos: string | Buffer) => createHash("sha256").update(datos).digest("hex");
const original = Buffer.from(`%PDF-1.7\n${"O".repeat(1100)}\n%%EOF`);
const ajustado = Buffer.from(`%PDF-1.7\n${"A".repeat(1100)}\n%%EOF`);
const hashOriginal = hash(original);
const hashAjustado = hash(ajustado);

type Documento = {
  id: string; proyecto: string; sello: string; original: string;
  ajustes: string[]; representante: boolean; cliente: boolean;
};
type Consulta = { query: string; params: string[] };
type Fila = Record<string, string | number | boolean | null>;
let documentos: Documento[] = [];
let eventos: string[] = [];
let aprobado = false;
let enviado = false;
let aislamientoSeguro = true;
let envioIntentos = 0;
let lotes: Consulta[][] = [];
let anterior: Promise<void> = Promise.resolve();
let pausa: { tipo: "firma" | "ajuste"; adquirida: () => void; liberar: Promise<void> } | undefined;
let llegada: (() => void) | undefined;

function diferido() {
  let resolver!: () => void;
  const promesa = new Promise<void>((resolve) => { resolver = resolve; });
  return { promesa, resolver };
}

function respuesta(filas: Fila[]) {
  const nombres = filas.length ? Object.keys(filas[0]) : [];
  return {
    fields: nombres.map((name) => ({
      name,
      dataTypeID: typeof filas[0][name] === "boolean" ? 16 : typeof filas[0][name] === "number" ? 23 : 25,
    })),
    rows: filas.map((fila) => nombres.map((nombre) => {
      const valor = fila[nombre];
      return valor === null ? null : typeof valor === "boolean" ? (valor ? "t" : "f") : String(valor);
    })),
  };
}

function comprobarProtocolo(lote: Consulta[], tipo: "firma" | "ajuste") {
  // set_config de identidad de enTransaccion, inicialización, bloqueo y mutación:
  assert.equal(lote.length, 4);
  assert.match(lote[0].query, /set_config\('app\.usuario_id'/);
  assert.equal(lote[0].params[1], tipo === "firma" ? "cliente" : "admin");
  assert.match(lote[1].query, /set_config\('app\.expediente_bloqueado', '', true\)/);
  assert.match(lote[2].query, /from proyectos p[\s\S]*for no key update of p/i);
  assert.match(lote[2].query, /set_config\('app\.expediente_bloqueado', id::text, true\)/);
  const sql = lote[3].query;
  assert.match(sql, /current_setting\('app\.expediente_bloqueado', true\) = p\.id::text/);
  assert.match(sql, /current_setting\('transaction_isolation'\) = 'read committed'/);
  assert.match(sql, /insert into eventos/);
  if (tipo === "firma") {
    assert.match(sql, /from documentos_ajustados aj[\s\S]*join documentos d on d\.id = aj\.documento_id[\s\S]*d\.proyecto_id = \$\d+::uuid[\s\S]*aj\.sha256_ajustado is distinct from d\.hash_archivo/);
    assert.doesNotMatch(sql, /order by aj\.utc/i);
    assert.match(sql, /where e\.aislamiento_seguro and not e\.ajuste_distinto[\s\S]*e\.representantes = e\.documentos[\s\S]*not d\.cliente/);
    assert.match(sql, /select d\.id, 'cliente', \$\d+::uuid, d\.sello/);
    assert.match(sql, /from nuevos\s+having count\(\*\) > 0/);
    assert.match(sql, /update proyectos p set estado = 'aprobado'[\s\S]*\(select count\(\*\) from nuevos\) > 0/);
  } else {
    assert.match(sql, /m\.proyecto_id = d\.proyecto_id and a\.firmante = 'cliente'/);
    assert.match(sql, /where e\.aislamiento_seguro and not e\.enviado and not e\.confirmado[\s\S]*not e\.repetido and e\.hash_archivo <>/);
    assert.match(sql, /insert into documentos_ajustados[\s\S]*e\.hash_archivo/);
    assert.match(sql, /from nueva\s+returning 1/);
    assert.doesNotMatch(sql, /insert into actos_firma|update documentos_ajustados/);
  }
}

function ejecutar(consulta: Consulta, tipo?: "firma" | "ajuste") {
  const sql = consulta.query;
  if (sql.includes("bws_sesion_valida")) {
    const esAdmin = consulta.params[0] === hash(tokenAdmin);
    return respuesta([{ usuario_id: esAdmin ? admin : cliente, rol: esAdmin ? "admin" : "cliente",
      nombre: "Prueba", correo: "prueba@example.test", verificado: true, expira: "2035-01-01" }]);
  }
  if (sql.includes("from planes_infra")) return respuesta([{
    clave: "neon-cloudflare", nivel: "inicial", version: 1, nombre: "Inicial",
    precio_usd: 10, limites: "[]", fuente: "Prueba", fecha: "2026-01-01",
  }]);
  if (sql.includes("from proyectos p") && sql.includes("c.razon_social")) {
    envioIntentos++;
    throw new Error("El correo está deshabilitado en la prueba");
  }
  if (sql.includes("with bloqueado as materialized")) {
    const existe = tipo === "firma" || documentos.some((d) => d.id === consulta.params[0]);
    return respuesta(existe ? [{ id: tipo === "firma" ? proyecto : documentos.find((d) => d.id === consulta.params[0])!.proyecto }] : []);
  }
  if (sql.includes("with docs as materialized")) {
    const docs = documentos.filter((d) => d.proyecto === proyecto);
    const representantes = docs.filter((d) => d.representante).length;
    const clientes = docs.filter((d) => d.cliente).length;
    const ajusteDistinto = docs.some((d) => d.ajustes.some((h) => h !== d.original));
    let actos = 0;
    if (aislamientoSeguro && !ajusteDistinto && docs.length > 0 && representantes === docs.length) {
      for (const d of docs) if (!d.cliente) { d.cliente = true; actos++; }
      if (actos) { eventos.push("expediente.firmado"); aprobado = clientes + actos === docs.length; }
    }
    return respuesta([{ documentos: docs.length, representantes, clientes, ajuste_distinto: ajusteDistinto,
      aislamiento_seguro: aislamientoSeguro, actos }]);
  }
  if (sql.includes("with estado as materialized")) {
    const d = documentos.find((item) => consulta.params.includes(item.id));
    if (!d) return respuesta([]);
    const nuevoHash = consulta.params.find((valor) => valor === hashAjustado || valor === hashOriginal)!;
    const repetido = d.ajustes.includes(nuevoHash);
    const confirmado = documentos.some((item) => item.proyecto === d.proyecto && item.cliente);
    let id: string | null = null;
    if (aislamientoSeguro && !enviado && !confirmado && !repetido && nuevoHash !== d.original) {
      d.ajustes.push(nuevoHash); eventos.push("documento.ajustado"); id = "99999999-9999-4999-8999-999999999999";
    }
    return respuesta([{ proyecto_id: d.proyecto, hash_archivo: d.original, aislamiento_seguro: aislamientoSeguro,
      repetido, confirmado, enviado, id, sha256_ajustado: id ? nuevoHash : null,
      sha256_original: id ? d.original : null, tamano: id ? ajustado.length : null,
      utc: id ? "2026-01-01T00:00:00Z" : null }]);
  }
  if (sql.includes("from proyectos p")) return respuesta([{
    id: proyecto, cliente_id: cliente, nombre: "Proyecto", categoria: "Sitio web", dominio: "example.test",
    buzones: "[]", alcance: "Proyecto", complejidad: "simple", plan_clave: "neon-cloudflare", plan_nivel: "inicial",
    plan_version: 1, estado: "en_revision", creado: "2026-01-01", enviado: "2026-01-02",
  }]);
  if (sql.includes("from firmas_cliente f")) return respuesta([{
    id: firma, png: "", sha256: hashOriginal, utc: "2026-01-01", metodo: "simple_reforzada", ip: null, agente: null,
  }]);
  if (sql.includes("set_config")) return respuesta([]);
  throw new Error(`Consulta inesperada en prueba: ${sql}`);
}

const fetchOriginal = neonConfig.fetchFunction;
const entornoOriginal = process.env.ENTORNO;
const urlOriginal = process.env.DATABASE_URL_APP;
const origenOriginal = process.env.APP_ORIGEN;
before(() => {
  process.env.ENTORNO = "local";
  process.env.DATABASE_URL_APP = "postgresql://bws_app:prueba@localhost/prueba";
  process.env.APP_ORIGEN = "https://portal.test";
  neonConfig.fetchFunction = async (_url: string, opciones: RequestInit) => {
    const cuerpo = JSON.parse(String(opciones.body)) as Consulta | { queries: Consulta[] };
    if (!("queries" in cuerpo)) return Response.json(ejecutar(cuerpo));
    const lote = cuerpo.queries;
    lotes.push(lote);
    const tipo = lote.some((q) => q.query.includes("with docs as materialized")) ? "firma"
      : lote.some((q) => q.query.includes("with estado as materialized")) ? "ajuste" : undefined;
    if (!tipo) return Response.json({ results: lote.map((q) => ejecutar(q)) });
    comprobarProtocolo(lote, tipo);
    const esperaAnterior = anterior;
    const fin = diferido();
    anterior = fin.promesa;
    llegada?.();
    llegada = undefined;
    await esperaAnterior;
    try {
      if (pausa?.tipo === tipo) {
        const actual = pausa; pausa = undefined; actual.adquirida(); await actual.liberar;
      }
      return Response.json({ results: lote.map((q) => ejecutar(q, tipo)) });
    } finally { fin.resolver(); }
  };
});
beforeEach(() => {
  documentos = [doc1, doc2].map((id) => ({ id, proyecto, sello: `sello-${id}`, original: hashOriginal,
    ajustes: [], representante: true, cliente: false }));
  eventos = []; aprobado = false; enviado = false; aislamientoSeguro = true; envioIntentos = 0; lotes = [];
  anterior = Promise.resolve(); pausa = undefined; llegada = undefined;
});
after(() => {
  neonConfig.fetchFunction = fetchOriginal;
  for (const [nombre, valor] of [["ENTORNO", entornoOriginal], ["DATABASE_URL_APP", urlOriginal], ["APP_ORIGEN", origenOriginal]]) {
    if (valor === undefined) delete process.env[nombre!]; else process.env[nombre!] = valor;
  }
});
function peticion(token: string, cuerpo?: unknown) {
  return new Request("https://portal.test/api", { method: "POST", headers: {
    origin: "https://portal.test", cookie: `bws_sesion=${token}`, "content-type": "application/json",
  }, body: JSON.stringify(cuerpo ?? {}) });
}
function pedirFirma() { return firmar(peticion(tokenCliente)); }
function pedirAjuste(id = doc1, pdf = ajustado) {
  return ajustar(peticion(tokenAdmin, { documento_id: id, pdf: pdf.toString("base64"), nota: "Revisión" }));
}
async function error(respuestaHttp: Response, estado: number, codigo: string) {
  assert.equal(respuestaHttp.status, estado);
  const cuerpo = await respuestaHttp.json();
  assert.equal(cuerpo.codigo, codigo);
  return cuerpo;
}

test("firma originales y conserva la idempotencia y los actos parciales", async () => {
  documentos[0].cliente = true;
  const respuestaHttp = await pedirFirma();
  assert.deepEqual(await respuestaHttp.json(), { ok: true, actos: 1, documentos: 2, envio: "pendiente" });
  assert.equal(respuestaHttp.status, 200);
  assert.equal(aprobado, true);
  assert.deepEqual(eventos, ["expediente.firmado"]);
  assert.equal(envioIntentos, 1);
  await error(await pedirFirma(), 409, "expediente_firmado");
  assert.deepEqual(eventos, ["expediente.firmado"]);
});

test("bloquea un ajuste distinto en cualquier documento, incluso histórico no vigente", async () => {
  documentos[1].ajustes.push(hashAjustado, hashOriginal);
  const antes = structuredClone(documentos);
  const cuerpo = await error(await pedirFirma(), 409, "expediente_ajustado");
  assert.match(cuerpo.error, /ajustado distinto del original/i);
  assert.deepEqual(documentos, antes);
  assert.deepEqual(eventos, []);
  assert.equal(aprobado, false);
  assert.equal(envioIntentos, 0);
});

test("un ajuste idéntico histórico u otro proyecto no bloquea la firma", async () => {
  documentos[0].ajustes.push(hashOriginal);
  documentos.push({ id: docOtro, proyecto: otroProyecto, sello: "otro", original: hashOriginal,
    ajustes: [hashAjustado], representante: true, cliente: false });
  assert.equal((await pedirFirma()).status, 200);
  assert.equal(documentos[2].cliente, false);
});

test("no firma un expediente inexistente o incompleto", async () => {
  documentos = [];
  await error(await pedirFirma(), 409, "sin_expediente");
  documentos = [{ id: doc1, proyecto, sello: "sello", original: hashOriginal, ajustes: [], representante: false, cliente: false }];
  await error(await pedirFirma(), 409, "expediente_incompleto");
  assert.deepEqual(eventos, []);
  assert.equal(aprobado, false);
});

test("el ajuste se agrega una vez y no se presenta como acto firmado", async () => {
  const respuestaHttp = await pedirAjuste();
  assert.equal(respuestaHttp.status, 201);
  const cuerpo = await respuestaHttp.json();
  assert.equal(cuerpo.ajuste.sha256_original, hashOriginal);
  assert.equal(cuerpo.ajuste.sha256_ajustado, hashAjustado);
  assert.deepEqual(documentos[0].ajustes, [hashAjustado]);
  assert.equal(documentos[0].cliente, false);
  assert.deepEqual(eventos, ["documento.ajustado"]);
  const repetida = await pedirAjuste();
  assert.equal(repetida.status, 200);
  assert.equal((await repetida.json()).reutilizado, true);
  assert.deepEqual(eventos, ["documento.ajustado"]);
  await error(await pedirAjuste(doc1, original), 400, "identico");
});

test("rechaza ajustes después de cualquier acto del cliente o envío", async () => {
  documentos[1].cliente = true;
  await error(await pedirAjuste(), 409, "ya_confirmado");
  documentos[1].cliente = false; enviado = true;
  await error(await pedirAjuste(), 409, "ya_enviado");
  assert.deepEqual(documentos[0].ajustes, []);
  assert.deepEqual(eventos, []);
});

test("sin aislamiento READ COMMITTED falla cerrado en ambos endpoints", async () => {
  aislamientoSeguro = false;
  await error(await pedirFirma(), 503, "aislamiento");
  await error(await pedirAjuste(), 503, "aislamiento");
  assert.deepEqual(eventos, []);
  assert.equal(aprobado, false);
  assert.equal(documentos.some((d) => d.cliente || d.ajustes.length), false);
});

test("mantiene las comprobaciones de origen, sesión y permisos", async () => {
  const sinSesion = new Request("https://portal.test/api", { method: "POST", headers: { origin: "https://portal.test" } });
  await error(await firmar(sinSesion), 401, "sesion");
  await error(await firmar(peticion(tokenAdmin)), 403, "rol");
  await error(await ajustar(peticion(tokenCliente, { documento_id: doc1, pdf: ajustado.toString("base64") })), 403, "rol");
  const malOrigen = new Request("https://portal.test/api", { method: "POST", headers: { origin: "https://otro.test" } });
  await error(await firmar(malOrigen), 403, "origen");
  assert.equal(lotes.length, 0);
});

async function carrera(primero: "firma" | "ajuste") {
  const adquirida = diferido(); const liberar = diferido(); const segundaLlegada = diferido();
  pausa = { tipo: primero, adquirida: adquirida.resolver, liberar: liberar.promesa };
  const primera = primero === "firma" ? pedirFirma() : pedirAjuste();
  await adquirida.promesa;
  llegada = segundaLlegada.resolver;
  const segunda = primero === "firma" ? pedirAjuste() : pedirFirma();
  await segundaLlegada.promesa;
  liberar.resolver();
  return Promise.all([primera, segunda]);
}

test("carrera simulada: si el ajuste obtiene el bloqueo primero, no se firma", async () => {
  const [ajuste, firmaRespuesta] = await carrera("ajuste");
  assert.equal(ajuste.status, 201);
  await error(firmaRespuesta, 409, "expediente_ajustado");
  assert.equal(documentos.some((d) => d.cliente), false);
  assert.deepEqual(eventos, ["documento.ajustado"]);
});

test("carrera simulada: si la firma obtiene el bloqueo primero, no se agrega el ajuste", async () => {
  const [firmaRespuesta, ajuste] = await carrera("firma");
  assert.equal(firmaRespuesta.status, 200);
  await error(ajuste, 409, "ya_confirmado");
  assert.deepEqual(documentos[0].ajustes, []);
  assert.deepEqual(eventos, ["expediente.firmado"]);
});
