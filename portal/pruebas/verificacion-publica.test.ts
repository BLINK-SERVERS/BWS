import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { neonConfig } from "@neondatabase/serverless";
import despachar from "../api/[...ruta].ts";

const ID = "01234567-89ab-cdef-0123-456789abcdef";
const URL_API = "https://bws.blink.com.ve/api/documentos/verificacion-publica";
const originalUrl = process.env.DATABASE_URL_APP;
const originalFetch = neonConfig.fetchFunction;
let consultas: { query: string; params: string[] }[] = [];
let filas: Record<string, string | null>[] = [];

before(() => {
  // El driver usa este transporte simulado: no se abre ninguna conexión.
  process.env.DATABASE_URL_APP = "postgresql://bws_app:prueba@localhost/prueba";
  neonConfig.fetchFunction = async (_url: string, opciones: RequestInit) => {
    consultas.push(JSON.parse(String(opciones.body)));
    const nombres = filas.length ? Object.keys(filas[0]) : [];
    return Response.json({
      fields: nombres.map((name) => ({ name, dataTypeID: 25 })),
      rows: filas.map((fila) => nombres.map((nombre) => fila[nombre])),
    });
  };
});

after(() => {
  if (originalUrl === undefined) delete process.env.DATABASE_URL_APP;
  else process.env.DATABASE_URL_APP = originalUrl;
  neonConfig.fetchFunction = originalFetch;
});

test("rechaza UUID inválidos y parámetros ambiguos antes de consultar", async () => {
  consultas = [];
  for (const consulta of [
    "", "?id=", "?id=abc", `?id=${ID}%0A`, `?id=${ID}%20`,
    `?id=${ID}&id=${ID}`, `?id=${encodeURIComponent(`${ID}' OR true --`)}`,
  ]) {
    const respuesta = await despachar(new Request(URL_API + consulta));
    assert.equal(respuesta.status, 400, consulta);
    assert.equal(respuesta.headers.get("cache-control"), "no-store");
  }
  assert.equal(consultas.length, 0);
});

test("rechaza otros métodos sin consultar", async () => {
  consultas = [];
  const respuesta = await despachar(new Request(`${URL_API}?id=${ID}`, { method: "POST" }));
  assert.equal(respuesta.status, 405);
  assert.equal(respuesta.headers.get("allow"), "GET");
  assert.equal(respuesta.headers.get("cache-control"), "no-store");
  assert.equal(consultas.length, 0);
});

test("consulta el UUID con parámetros y responde 404 si no existe", async () => {
  consultas = [];
  filas = [];
  const respuesta = await despachar(new Request(`${URL_API}?id=${ID}`));
  assert.equal(respuesta.status, 404);
  assert.equal(respuesta.headers.get("cache-control"), "no-store");
  assert.equal(consultas.length, 1);
  assert.match(consultas[0].query, /public\.bws_verificacion_publica\(\$1::uuid\)/);
  assert.deepEqual(consultas[0].params, [ID]);
});

test("devuelve solo los seis campos públicos, incluidos valores nulos", async () => {
  consultas = [];
  filas = [{
    id: ID,
    titular: "Titular de prueba",
    titulo: "Título de prueba",
    estado: "confirmado",
    hash_archivo: "a".repeat(64),
    hash_ajustado: null,
    correo: "no-publicar@example.test",
    pdf: "no-publicar",
  }];
  const respuesta = await despachar(new Request(`${URL_API}?id=${ID.toUpperCase()}`));
  assert.equal(respuesta.status, 200);
  assert.equal(respuesta.headers.get("cache-control"), "no-store");
  assert.match(respuesta.headers.get("content-type") ?? "", /^application\/json/);
  assert.deepEqual(await respuesta.json(), {
    id: ID,
    titular: "Titular de prueba",
    titulo: "Título de prueba",
    estado: "confirmado",
    hash_archivo: "a".repeat(64),
    hash_ajustado: null,
  });
  assert.deepEqual(consultas[0].params, [ID.toUpperCase()]);
});
