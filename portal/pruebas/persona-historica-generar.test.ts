import assert from "node:assert/strict";
import { mock, test } from "node:test";

if (typeof mock.module !== "function") {
  test("generación protegida", { skip: "Requiere --experimental-test-module-mocks" }, () => {});
} else {
  type Consulta = { sql: string; valores: unknown[] };
  const llamadas: Consulta[][] = [];
  let respuestas: Record<string, unknown>[][][] = [];
  let falloFinal = false;
  let persona: "natural" | null = "natural";
  let seleccionados = 0;
  const proyectoId = "33333333-3333-4333-8333-333333333333";
  const usuarioId = "11111111-1111-4111-8111-111111111111";
  const clienteId = "22222222-2222-4222-8222-222222222222";
  const doc = { codigo: "PRUEBA", version: "1", titulo: "Contrato", bloques: [] };
  mock.module(new URL("../server/_lib/db.ts", import.meta.url), { namedExports: {
    enTransaccion: async (_id: unknown, _rol: unknown,
      construir: (txn: (cadenas: TemplateStringsArray, ...valores: unknown[]) => Consulta) => Consulta[]) => {
      const consultas = construir((cadenas, ...valores) => ({ sql: cadenas.join("?"), valores }));
      llamadas.push(consultas);
      if (falloFinal && consultas[0].sql.includes("bws_exigir_generacion_proyecto")) throw { code: "P2101" };
      const resultado = respuestas.shift();
      if (!resultado) throw new Error("Consulta no simulada");
      return resultado;
    },
  } });
  mock.module(new URL("../server/_lib/sesion.ts", import.meta.url), { namedExports: {
    leerSesion: async () => ({ usuarioId, rol: "admin" }), exigirAdmin: (sesion: unknown) => sesion,
  } });
  mock.module(new URL("../server/_lib/csrf.ts", import.meta.url), { namedExports: { exigirOrigen: () => undefined } });
  mock.module(new URL("../server/_lib/expediente.ts", import.meta.url), { namedExports: {
    proyectoDeExpediente: async () => ({ fila: { cliente_id: clienteId }, vista: {
      estado: "enviado", categoria: "Otro", persona_tipo: persona,
      cliente_rep_nombre: null, cliente_rep_documento: null,
    } }),
    clienteDeExpediente: async () => ({ id: clienteId, verificado: true, razon_social: "Cliente" }),
    firmaDeExpediente: async () => ({ png: new Uint8Array([1]), sha256: "hash" }),
    representanteDeExpediente: async () => ({ id: usuarioId, nombre: "Diego Beleno",
      documento: "V-34201580", png: new Uint8Array([1]), sha256: "hash" }),
    datosDeExpediente: () => ({}), firmasDeExpediente: () => ({ representante: {}, cliente: {} }),
  } });
  mock.module(new URL("../legal/index.ts", import.meta.url), { namedExports: {
    documentosDeExpediente: () => { seleccionados += 1; return [doc]; },
  } });
  mock.module(new URL("../legal/nombre-documento.ts", import.meta.url), { namedExports: { nombreDocumento: () => "contrato" } });
  mock.module(new URL("../legal/validar.ts", import.meta.url), { namedExports: { resolver: () => doc } });
  mock.module(new URL("../render/hash.ts", import.meta.url), { namedExports: {
    contextoDeSello: () => ({}), hashCadena: () => "cadena", hashPlantilla: () => "plantilla",
    selloDeContenido: () => "sello", sha256Hex: () => "hash",
  } });
  mock.module(new URL("../render/pdf.ts", import.meta.url), { namedExports: { generarPDF: async () => new Uint8Array([1]) } });
  const { default: generar } = await import("../server/documentos/generar.ts");
  const peticion = () => new Request("https://portal.test/api/documentos/generar", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ proyecto_id: proyectoId }),
  });
  const estados = [[{}]];
  const plantillas = [[{ codigo: "PRUEBA", version: 1, sha256: "plantilla" }]];
  const existente = { plantilla_codigo: "ANTERIOR", orden: 1, sello: "original", hash_archivo: "archivo",
    hash_anterior: "GENESIS", hash_cadena: "cadena", estado: "firmado" };

  test("reutiliza documentos históricos antes de exigir persona", async () => {
    persona = null; seleccionados = 0; llamadas.length = 0;
    respuestas = [estados, [[existente]]];
    const respuesta = await generar(peticion());
    const cuerpo = await respuesta.json();
    assert.equal(respuesta.status, 200);
    assert.equal(cuerpo.reutilizado, true);
    assert.equal(cuerpo.documentos[0].sello, "original");
    assert.equal(seleccionados, 0);
    assert.equal(llamadas.length, 2);
  });

  test("la revalidación precede a todos los insertos y un conflicto responde 409", async () => {
    persona = "natural"; falloFinal = true; llamadas.length = 0;
    respuestas = [estados, [[]], plantillas];
    const respuesta = await generar(peticion());
    assert.equal(respuesta.status, 409);
    assert.equal((await respuesta.json()).codigo, "proyecto_cambiado");
    const ultima = llamadas.at(-1)!;
    assert.match(ultima[0].sql, /bws_exigir_generacion_proyecto/);
    assert.deepEqual(ultima[0].valores, [proyectoId, "natural", null, null]);
    assert.match(ultima[1].sql, /insert into documentos/i);
    falloFinal = false;
  });
}
