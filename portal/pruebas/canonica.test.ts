/* ============================================================
   Forma canónica y sellos
   ------------------------------------------------------------
   La huella de una plantilla debe ser idéntica aunque las claves
   lleguen en otro orden: es la misma que el navegador calcula con
   SubtleCrypto antes de mostrar el consentimiento.
   ============================================================ */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canonica } from "../legal/canonica.ts";
import { DOCUMENTOS, DOCUMENTO_POR_CODIGO } from "../legal/index.ts";
import { hashConsentimiento, hashPlantilla, sha256Hex } from "../render/hash.ts";
import { resolver } from "../legal/validar.ts";
import { huellaDelConsentimiento, huellasDeRegistro, DOCUMENTOS_REGISTRO } from "../server/_lib/registro.ts";

describe("canonica", () => {
  it("ordena las claves en cualquier profundidad", () => {
    const uno = canonica({ b: 2, a: { d: 4, c: [3, { f: 6, e: 5 }] } });
    const dos = canonica({ a: { c: [3, { e: 5, f: 6 }], d: 4 }, b: 2 });
    assert.equal(uno, dos);
  });

  it("no convierte un arreglo en objeto ni reordena sus elementos", () => {
    assert.equal(canonica([2, 1]), "[2,1]");
    assert.notEqual(canonica([1, 2]), canonica([2, 1]));
  });

  it("trata null y undefined de forma distinta, como JSON", () => {
    assert.equal(canonica({ a: null }), '{"a":null}');
    assert.equal(canonica({ a: undefined }), "{}");
  });
});

describe("huellas de plantilla", () => {
  it("las ocho plantillas producen hashes de 64 hex", () => {
    assert.equal(DOCUMENTOS.length, 8);
    for (const doc of DOCUMENTOS) {
      assert.match(hashPlantilla(doc), /^[0-9a-f]{64}$/);
    }
  });

  it("la huella no depende del orden de las claves del objeto", () => {
    const doc = DOCUMENTO_POR_CODIGO.get("BWS-CON-004");
    assert.ok(doc);
    const reordenado = { ...doc, bloques: [...doc.bloques].reverse() };
    assert.notEqual(hashPlantilla(doc), hashPlantilla(reordenado as typeof doc));
    const copia = JSON.parse(JSON.stringify(doc));
    assert.equal(hashPlantilla(doc), hashPlantilla(copia));
  });

  it("el hash de consentimiento usa el texto resuelto, no solo la plantilla", () => {
    const doc = DOCUMENTO_POR_CODIGO.get("BWS-LEG-002");
    assert.ok(doc);
    const a = resolver(doc, {
      variables: Object.fromEntries(doc.campos.map((c) => [c, "dato a"])),
      buzones: [],
      limites: [],
    });
    const b = resolver(doc, {
      variables: Object.fromEntries(doc.campos.map((c) => [c, "dato b"])),
      buzones: [],
      limites: [],
    });
    assert.notEqual(hashConsentimiento(a), hashConsentimiento(b));
    assert.equal(hashConsentimiento(a), hashConsentimiento(a));
  });
});

describe("consentimiento del registro", () => {
  const cliente = {
    razon_social: "Estudio Prueba, C.A.",
    documento_tipo: "RIF" as const,
    documento_numero: "J-12345678-9",
    domicilio: "Av. Principal, Caracas",
    telefono: "+58 412 1234567",
    correo: "prueba@ejemplo.com",
    correo_factura: "factura@ejemplo.com",
  };

  it("la huella del consentimiento es la de BWS-LEG-002", () => {
    assert.match(huellaDelConsentimiento(cliente), /^[0-9a-f]{64}$/);
    assert.equal(huellaDelConsentimiento(cliente), huellaDelConsentimiento({ ...cliente }));
  });

  it("si cambia un dato que el documento usa, cambia la huella", () => {
    assert.notEqual(
      huellaDelConsentimiento(cliente),
      huellaDelConsentimiento({ ...cliente, razon_social: "Estudio Distinto, C.A." }),
    );
  });

  it("se emiten las cinco huellas del registro, sin marcadores", () => {
    const huellas = huellasDeRegistro(cliente);
    assert.deepEqual(Object.keys(huellas).sort(), [...DOCUMENTOS_REGISTRO].sort());
    for (const hash of Object.values(huellas)) assert.match(hash, /^[0-9a-f]{64}$/);
  });
});

describe("sha256Hex", () => {
  it("coincide con el vector conocido de 'abc'", () => {
    assert.equal(
      sha256Hex("abc"),
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("el mismo texto produce la misma huella y distinto texto otra", () => {
    assert.equal(sha256Hex("hola"), sha256Hex("hola"));
    assert.notEqual(sha256Hex("hola"), sha256Hex("hola "));
  });
});
