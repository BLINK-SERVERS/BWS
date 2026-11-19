import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { datosDePrueba, documentosDeExpediente } from "../legal/index.ts";
import { validarTextoDinamico } from "../legal/texto-dinamico.ts";
import type { Bloque, DatosExpediente, DocumentoLegal, FirmaCapturada } from "../legal/tipos.ts";

function documento(campos: string[] = [], bloques: Bloque[] = []): DocumentoLegal {
  return {
    codigo: "BWS-TST-001",
    titulo: "Prueba",
    version: "1.0",
    fecha: "2026-11-18",
    firma: "proyecto",
    resumen: "Prueba",
    campos,
    bloques,
  };
}

function datos(variables: Record<string, string> = {}): DatosExpediente {
  return { variables, buzones: [], limites: [] };
}

function firma(cambios: Partial<FirmaCapturada> = {}): FirmaCapturada {
  return {
    png: null,
    nombre: "Nombre de firma",
    documento: "V-12345678",
    correo: "cliente@ejemplo.com",
    utc: "2026-11-18T12:00:00Z",
    metodo: "papel",
    ...cambios,
  };
}

describe("validarTextoDinamico", () => {
  for (const signo of [";", "«", "»", "•", "**"]) {
    it(`detecta ${JSON.stringify(signo)} en las variables exigidas`, () => {
      const doc = documento(["proyecto_alcance"], [{ tipo: "parrafo", texto: "{{proyecto_alcance}}" }]);
      for (const valor of [`${signo}inicio`, `antes${signo}después`, `final${signo}`]) {
        assert.deepEqual(validarTextoDinamico([doc], datos({ proyecto_alcance: valor }), firma()), ["proyecto_alcance"]);
      }
    });
  }

  it("admite texto normal, puntuación y asteriscos aislados", () => {
    const doc = documento(["proyecto_alcance"], [{ tipo: "parrafo", texto: "**{{proyecto_alcance}}**" }]);
    const expediente = datos({ proyecto_alcance: "Árbol, niño: 50% (3 * 2) - diseño web. ¿Sí? ¡Claro!" });
    assert.deepEqual(validarTextoDinamico([doc], expediente, firma()), []);
  });

  it("reúne las claves de todos los documentos sin repetir e ignora las demás variables", () => {
    const primero = documento(["nombre", "comun"], [{ tipo: "parrafo", texto: "{{nombre}} {{comun}}" }]);
    const segundo = documento(["comun", "alcance"], [{ tipo: "parrafo", texto: "{{comun}} {{alcance}}" }]);
    const expediente = datos({ nombre: "Ana;", comun: "«Común»", alcance: "**web", no_usada: "•" });
    assert.deepEqual(validarTextoDinamico([primero, segundo, primero], expediente, firma()), ["nombre", "comun", "alcance"]);
    assert.deepEqual(validarTextoDinamico([], expediente, firma()), []);
  });

  it("no inspecciona datos ajenos al texto solicitado ni fechas, IP o agente", () => {
    const inaccesibles = new Set(["fecha_documento", "plan_fecha", "tasa_bcv_fecha", "firma_utc", "ip", "agente", "sin_usar"]);
    const variables = new Proxy({ nombre: "Válido" } as Record<string, string>, {
      get(objeto, propiedad) {
        if (typeof propiedad === "string" && inaccesibles.has(propiedad)) throw new Error(`No leer ${propiedad}`);
        return Reflect.get(objeto, propiedad);
      },
    });
    const expediente: DatosExpediente = {
      variables,
      get buzones(): DatosExpediente["buzones"] { throw new Error("No leer buzones"); },
      get limites(): DatosExpediente["limites"] { throw new Error("No leer límites"); },
    };
    const doc = documento(["nombre", "fecha_documento", "plan_fecha", "tasa_bcv_fecha", "firma_utc", "ip", "agente"]);
    assert.deepEqual(validarTextoDinamico([doc], expediente, firma()), []);
  });

  it("revisa cada campo y cada índice de buzones solo si algún documento incluye el bloque", () => {
    const expediente: DatosExpediente = {
      variables: {},
      buzones: [
        { correo: "uno;@ejemplo.com", uso: "Uso válido" },
        { correo: "dos@ejemplo.com", uso: "Atención • ventas" },
        { correo: "**tres@ejemplo.com", uso: "«interno»" },
      ],
      limites: [{ concepto: "No revisar;", valor: "No revisar**" }],
    };
    const normal = documento();
    const conBuzones = documento([], [{ tipo: "buzones" }]);
    assert.deepEqual(validarTextoDinamico([normal], expediente, firma()), []);
    assert.deepEqual(validarTextoDinamico([normal, conBuzones, conBuzones], expediente, firma()), [
      "buzones[0].correo", "buzones[1].uso", "buzones[2].correo", "buzones[2].uso",
    ]);
  });

  it("revisa concepto y valor de cada límite solo si algún documento incluye el bloque", () => {
    const expediente: DatosExpediente = {
      variables: {},
      buzones: [{ correo: "No revisar;", uso: "No revisar**" }],
      limites: [
        { concepto: "Transferencia»", valor: "10 GB" },
        { concepto: "Almacenamiento", valor: "20; GB" },
        { concepto: "• Uso", valor: "**ilimitado**" },
      ],
    };
    const normal = documento();
    const conLimites = documento([], [{ tipo: "limites" }]);
    assert.deepEqual(validarTextoDinamico([normal], expediente, firma()), []);
    assert.deepEqual(validarTextoDinamico([normal, conLimites], expediente, firma()), [
      "limites[0].concepto", "limites[1].valor", "limites[2].concepto", "limites[2].valor",
    ]);
    assert.deepEqual(validarTextoDinamico([conLimites, documento([], [{ tipo: "buzones" }])], datos(), firma()), []);
  });

  it("inspecciona el documento y el correo visibles de la firma del cliente", () => {
    const doc = documento();
    const expediente = datos({ cliente_razon_social: "Cliente válido", cliente_correo: "no;visible@ejemplo.com" });
    assert.deepEqual(validarTextoDinamico([doc], expediente, firma({ documento: "V-1**2", correo: "correo•@ejemplo.com" })), [
      "firmas.cliente.documento", "firmas.cliente.correo",
    ]);
    assert.deepEqual(validarTextoDinamico([doc], expediente, firma()), []);
    assert.deepEqual(validarTextoDinamico([doc], expediente, firma({ correo: " " })), []);
    assert.deepEqual(validarTextoDinamico([], expediente, firma({ documento: "V-1;" })), []);
  });

  it("inspecciona el nombre y el correo alternativo realmente visibles en la hoja de firmas", () => {
    const doc = documento(["cliente_razon_social"], [{ tipo: "parrafo", texto: "{{cliente_razon_social}}" }]);
    const expediente = datos({ cliente_razon_social: "Cliente «Ejemplo»", cliente_correo: "correo;@ejemplo.com" });
    for (const correo of [undefined, ""]) {
      assert.deepEqual(validarTextoDinamico([doc], expediente, firma({ correo })), [
        "cliente_razon_social", "cliente_correo",
      ]);
    }
    assert.deepEqual(validarTextoDinamico([documento()], expediente, firma({ correo: undefined })), [
      "cliente_razon_social", "cliente_correo",
    ]);
  });

  it("no lee el nombre capturado, la IP, el agente, la fecha ni los metadatos de la firma", () => {
    const inaccesibles = new Set(["nombre", "ip", "agente", "utc", "metodo", "png"]);
    const firmaCliente = new Proxy(firma(), {
      get(objeto, propiedad) {
        if (typeof propiedad === "string" && inaccesibles.has(propiedad)) throw new Error(`No leer ${propiedad}`);
        return Reflect.get(objeto, propiedad);
      },
    });
    assert.deepEqual(validarTextoDinamico([documento()], datos({ cliente_razon_social: "Cliente" }), firmaCliente), []);
  });

  it("no modifica documentos, datos ni firma", () => {
    const doc = documento(["nombre"], [{ tipo: "parrafo", texto: "{{nombre}}" }, { tipo: "buzones" }, { tipo: "limites" }]);
    const expediente: DatosExpediente = {
      variables: { nombre: "  Ana;  ", cliente_razon_social: "Cliente", cliente_correo: "correo@ejemplo.com" },
      buzones: [{ correo: "  correo•@ejemplo.com  ", uso: "Uso" }],
      limites: [{ concepto: "«Memoria»", valor: "10 GB" }],
    };
    const firmaCliente = firma({ documento: "V-**123" });
    const original = structuredClone({ doc, expediente, firmaCliente });
    Object.freeze(doc.campos);
    doc.bloques.forEach(Object.freeze);
    Object.freeze(doc.bloques);
    Object.freeze(doc);
    Object.freeze(expediente.variables);
    expediente.buzones.forEach(Object.freeze);
    expediente.limites.forEach(Object.freeze);
    Object.freeze(expediente.buzones);
    Object.freeze(expediente.limites);
    Object.freeze(expediente);
    Object.freeze(firmaCliente);
    assert.deepEqual(validarTextoDinamico([doc], expediente, firmaCliente), [
      "nombre", "buzones[0].correo", "limites[0].concepto", "firmas.cliente.documento",
    ]);
    assert.deepEqual({ doc, expediente, firmaCliente }, original);
  });

  it("funciona con expedientes nuevos de persona natural y jurídica", () => {
    for (const persona of ["natural", "juridica"] as const) {
      const docs = documentosDeExpediente("Sitio web", persona);
      const expediente = datosDePrueba({ persona });
      expediente.variables.proyecto_alcance = "Catálogo y panel de pedidos.";
      expediente.variables.tasa_bcv_valor = "tasa no usada;";
      expediente.variables.fecha_documento = "fecha **no inspeccionada**";
      if (persona === "natural") expediente.variables.cliente_rep_nombre = "no usado;";
      assert.deepEqual(validarTextoDinamico(docs, expediente, firma()), []);
      expediente.variables.proyecto_alcance = "Catálogo **y panel**";
      expediente.buzones[0].uso = "Administración;";
      assert.deepEqual(validarTextoDinamico(docs, expediente, firma()), ["proyecto_alcance", "buzones[0].uso"]);
    }
  });
});
