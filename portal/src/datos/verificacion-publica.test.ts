import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { api, FalloApi } from "./api";
import { rutaDe } from "./rutas";
import {
  compararHuellas,
  compararPdf,
  esDocumentoPublico,
  uuidValido,
  type DocumentoPublico,
} from "./verificacion-publica";

const id = "a1234567-1234-4567-89ab-123456789abc";
const original = "%PDF-1.7\noriginal";
const ajustado = "%PDF-1.7\najustado";
const sha256 = (contenido: string) => createHash("sha256").update(contenido).digest("hex");
const documento: DocumentoPublico = {
  id,
  titular: "Titular de prueba",
  titulo: "Documento de prueba",
  estado: "confirmado",
  hash_archivo: sha256(original),
  hash_ajustado: sha256(ajustado),
};

test("la ruta pública conserva el identificador y no colisiona con el correo", () => {
  assert.equal(rutaDe(`/verify/${id}`), `/verify/${id}`);
  assert.equal(rutaDe(`/verify/${id}/`), `/verify/${id}`);
  assert.equal(rutaDe("/verify/no-es-uuid"), "/verify/no-es-uuid");
  assert.equal(rutaDe("/verify/"), "/verify");
  assert.equal(rutaDe("/verificar"), "/verificar");
  assert.equal(rutaDe("/verificar/extra"), "/");
  assert.equal(uuidValido(id.toUpperCase()), true);
  assert.equal(uuidValido(`${id}/extra`), false);
  assert.equal(uuidValido("no-es-uuid"), false);
});

test("la respuesta solo acepta el registro solicitado con sus campos completos", () => {
  assert.equal(esDocumentoPublico(documento, id), true);
  assert.equal(esDocumentoPublico({ ...documento, id: "00000000-0000-0000-0000-000000000000" }, id), false);
  assert.equal(esDocumentoPublico({ ...documento, estado: "desconocido" }, id), false);
  assert.equal(esDocumentoPublico({ ...documento, hash_archivo: "" }, id), false);
  assert.equal(esDocumentoPublico({ ...documento, hash_ajustado: undefined }, id), false);
  assert.equal(esDocumentoPublico({ ...documento, hash_ajustado: null }, id), true);
});

test("la comparación local distingue original, ajuste y archivo distinto", async () => {
  assert.equal(await compararPdf(new Blob([original]), documento), "original");
  assert.equal(await compararPdf(new Blob([ajustado]), documento), "ajustado");
  assert.equal(await compararPdf(new Blob([`${original} alterado`]), documento), "distinto");
  assert.equal(await compararPdf(new Blob(["No es un PDF"]), documento), "no-pdf");
  assert.equal(await compararPdf(new Blob([ajustado]), { ...documento, hash_ajustado: null }), "distinto");
  assert.equal(compararHuellas(documento.hash_archivo.toUpperCase(), documento.hash_archivo, null), "original");
  assert.equal(compararHuellas(documento.hash_archivo, documento.hash_archivo, documento.hash_archivo), "ajustado");
});

test("la consulta pública no envía credenciales y distingue 404", async () => {
  const fetchOriginal = globalThis.fetch;
  try {
    globalThis.fetch = async (entrada, opciones) => {
      assert.equal(entrada, `/api/documentos/verificacion-publica?id=${id}`);
      assert.equal(opciones?.method, "GET");
      assert.equal(opciones?.credentials, "omit");
      assert.equal(opciones?.cache, "no-store");
      assert.equal(opciones?.body, undefined);
      return new Response(JSON.stringify(documento), { status: 200 });
    };
    assert.deepEqual(await api.verificacionPublica(id), documento);
    globalThis.fetch = async () => new Response("{}", { status: 404 });
    await assert.rejects(api.verificacionPublica(id), (error: unknown) => error instanceof FalloApi && error.estado === 404);
    globalThis.fetch = async () => new Response("{}", { status: 200 });
    await assert.rejects(api.verificacionPublica(id));
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});
