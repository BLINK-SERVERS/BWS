import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DOCUMENTOS, PLANTILLAS_ACTUALES, datosDePrueba } from "../legal/index.ts";
import type { FirmaCapturada } from "../legal/tipos.ts";
import { contextoDeSello, selloDeContenido } from "../render/hash.ts";

const utc = "2026-11-18T14:30:00.000Z";
const firmas: FirmaCapturada[] = [
  { nombre: "Representante", documento: "V-12345678", png: Uint8Array.of(1, 2), utc, metodo: "simple_reforzada" },
  { nombre: "Cliente", documento: "V-87654321", correo: "cliente@ejemplo.com", png: Uint8Array.of(3, 4), utc, metodo: "simple_reforzada" },
];

describe("contexto guardado del sello", () => {
  it("reconstruye el sello de cada documento sin depender de los datos actuales", () => {
    const datos = datosDePrueba();
    for (const doc of [...DOCUMENTOS, ...PLANTILLAS_ACTUALES]) {
      const original = selloDeContenido({ doc, datos, firmas, utc });
      const contexto = JSON.parse(JSON.stringify(contextoDeSello(doc, datos, firmas))) as ReturnType<typeof contextoDeSello>;
      const restauradas = contexto.firmas.map((firma, i) => ({ ...firma, png: firmas[i].png }));
      assert.equal(selloDeContenido({ doc, datos: contexto.datos, firmas: restauradas, utc }), original, doc.codigo);
      restauradas[0].png = Uint8Array.of(9);
      assert.notEqual(selloDeContenido({ doc, datos: contexto.datos, firmas: restauradas, utc }), original, doc.codigo);
      assert.ok(!JSON.stringify(contexto).includes("png"));
    }
  });
});
