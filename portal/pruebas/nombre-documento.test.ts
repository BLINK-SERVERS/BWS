import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nombreDocumento } from "../legal/nombre-documento.ts";
import { PLANTILLAS_ACTUALES } from "../legal/index.ts";

describe("nombre del documento", () => {
  it("incluye documento, tipo de persona, proyecto y cliente", () => {
    assert.equal(
      nombreDocumento("Contrato de servicios", "natural", "Webpage", "Ana Pérez"),
      "CONTRATO_DE_SERVICIOS_BWS_PERSONA_NATURAL_WEBPAGE_ANA_PÉREZ",
    );
  });

  it("conserva completos los títulos actuales", () => {
    for (const doc of PLANTILLAS_ACTUALES) {
      const titulo = doc.titulo.split(" · ")[0].normalize("NFC").toUpperCase().replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "");
      assert.ok(nombreDocumento(doc.titulo.split(" · ")[0], "natural", "Sitio web", "Cliente").startsWith(`${titulo}_BWS_`));
    }
  });

  it("elimina separadores de rutas y caracteres de cabecera", () => {
    const nombre = nombreDocumento("Documento", "juridica", "Sitio web", "Empresa/../\"\r\nOtro");
    assert.match(nombre, /^[\p{L}\p{N}_]+$/u);
    assert.ok(!nombre.includes(".."));
  });

  it("limita cada componente en bytes sin cortar caracteres", () => {
    const nombre = nombreDocumento("Documento", "juridica", "Web", "客户".repeat(100));
    assert.ok(new TextEncoder().encode(nombre).length < 255);
    assert.ok(!nombre.includes("�"));
  });
});
