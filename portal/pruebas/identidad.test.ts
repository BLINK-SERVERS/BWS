/* ============================================================
   Validadores de identidad
   ------------------------------------------------------------
   Las mismas reglas corren en el navegador y en la API. Aquí se
   fijan los casos límite para que un cambio silencioso en los
   formatos no llegue a producción.
   ============================================================ */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  correoNormalizado,
  domicilioValido,
  mensajeClave,
  mensajeDocumento,
  nombreValido,
  normalizarDocumento,
  razonSocialValida,
  telefonoNormalizado,
} from "../legal/identidad.ts";

describe("documento de identidad", () => {
  it("normaliza el RIF con o sin guiones", () => {
    assert.equal(normalizarDocumento("RIF", "j 12345678 9"), "J-12345678-9");
    assert.equal(normalizarDocumento("RIF", "V-12345678-0"), "V-12345678-0");
    assert.equal(normalizarDocumento("RIF", "E123456789"), "E-12345678-9");
  });

  it("rechaza RIF con letra, longitud o dígito incorrectos", () => {
    assert.equal(normalizarDocumento("RIF", "X-12345678-9"), null);
    assert.equal(normalizarDocumento("RIF", "J-1234567-9"), null);
    assert.equal(normalizarDocumento("RIF", "J-12345678-99"), null);
    assert.match(mensajeDocumento("RIF", "nada") ?? "", /J-12345678-9/);
  });

  it("normaliza la cédula y el pasaporte", () => {
    assert.equal(normalizarDocumento("cedula", "v-1234567"), "V-1234567");
    assert.equal(normalizarDocumento("cedula", "E 123456789"), "E-123456789");
    assert.equal(normalizarDocumento("cedula", "12345678"), null);
    assert.equal(normalizarDocumento("pasaporte", "a1234567"), "A1234567");
    assert.equal(normalizarDocumento("pasaporte", "ab-12"), null);
  });
});

describe("correo", () => {
  it("pasa a minúsculas y recorta", () => {
    assert.equal(correoNormalizado("  Cliente@Ejemplo.COM "), "cliente@ejemplo.com");
  });

  it("rechaza formatos que no son correo", () => {
    assert.equal(correoNormalizado("sin-arroba.com"), null);
    assert.equal(correoNormalizado("a@b.c"), null);
    assert.equal(correoNormalizado("a b@c.com"), null);
    assert.equal(correoNormalizado(42), null);
  });
});

describe("nombre, razón social y domicilio", () => {
  it("acepta nombres con letras y rechaza solo dígitos", () => {
    assert.equal(nombreValido("José Ángel"), true);
    assert.equal(nombreValido("J"), false);
    assert.equal(nombreValido("123456"), false);
  });

  it("la razón social admite letras y números", () => {
    assert.equal(razonSocialValida("Estudio 42, C.A."), true);
    assert.equal(razonSocialValida("--"), false);
  });

  it("el domicilio exige un mínimo útil", () => {
    assert.equal(domicilioValido("Ccs"), false);
    assert.equal(domicilioValido("Av. Principal, Caracas"), true);
  });
});

describe("teléfono", () => {
  it("acepta formatos libres con siete dígitos o más", () => {
    assert.equal(telefonoNormalizado("+58 (412) 123-4567"), "+58 (412) 123-4567");
    assert.equal(telefonoNormalizado("123456"), null);
    assert.equal(telefonoNormalizado("llamame"), null);
  });
});

describe("clave", () => {
  it("exige longitud, letras y números", () => {
    assert.match(mensajeClave("corta1") ?? "", /al menos 10 caracteres/);
    assert.match(mensajeClave("sololetraslargas") ?? "", /letras y números/);
    assert.match(mensajeClave("1234567890") ?? "", /letras y números/);
    assert.equal(mensajeClave("claveSegura123"), null);
  });

  it("rechaza espacios en los extremos", () => {
    assert.match(mensajeClave(" clave12345") ?? "", /espacios/);
  });
});
