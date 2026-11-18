/* ============================================================
   Contrato de servicios: las doce variantes
   ------------------------------------------------------------
   Una variante por categoría y persona, todas desde el mismo
   cuerpo. Aquí se comprueba que validan, resuelven, sellan y
   producen el mismo PDF en dos pasadas.
   ============================================================ */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CONTRATOS,
  DOCUMENTOS,
  DOCUMENTOS_BASE,
  DOCUMENTO_POR_CODIGO,
  datosDePrueba,
  documentosDeExpediente,
} from "../legal/index.ts";
import { CATEGORIAS_CONTRATO, contratoDe } from "../legal/textos/con-servicios.ts";
import { resolver, validarPlantilla } from "../legal/validar.ts";
import { selloDeContenido, sha256Hex } from "../render/hash.ts";
import { lectorNodo } from "../render/fuentes-nodo.ts";
import { generarPDF } from "../render/pdf.ts";
import { partirRuns } from "../render/runs.ts";
import type { Evidencia, FirmaCapturada } from "../legal/tipos.ts";

const UTC = "2026-11-18T14:30:00.000Z";

// PNG de 1 × 1 píxel: la imagen de firma no afecta al determinismo.
const PNG_PRUEBA = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64",
  ),
);

function firmasDePrueba(): { representante: FirmaCapturada; cliente: FirmaCapturada } {
  const base = { png: PNG_PRUEBA, utc: UTC, metodo: "simple_reforzada" as const };
  return {
    representante: { ...base, nombre: "Nombre Apellido", documento: "V-00000000" },
    cliente: { ...base, nombre: "Cliente de Prueba", documento: "V-12345678" },
  };
}

describe("variantes del contrato", () => {
  it("son doce, con códigos únicos BWS-CON-009 a BWS-CON-020", () => {
    assert.equal(CONTRATOS.length, 12);
    const codigos = CONTRATOS.map((d) => d.codigo);
    assert.equal(new Set(codigos).size, 12);
    assert.deepEqual(
      [...codigos].sort(),
      Array.from({ length: 12 }, (_, i) => `BWS-CON-${String(i + 9).padStart(3, "0")}`),
    );
  });

  it("todas validan, van en estilo clásico y se firman con el proyecto", () => {
    for (const doc of CONTRATOS) {
      assert.deepEqual(validarPlantilla(doc), [], doc.codigo);
      assert.equal(doc.estilo, "clasico");
      assert.equal(doc.firma, "proyecto");
      assert.equal(doc.version, "1.0");
    }
  });

  it("cada variante resuelve con los datos de su persona", () => {
    for (const [i, doc] of CONTRATOS.entries()) {
      const persona = i % 2 === 0 ? "natural" : "juridica";
      const resuelto = resolver(doc, datosDePrueba({ persona }));
      const texto = JSON.stringify(resuelto.bloques);
      assert.ok(!texto.includes("{{"), doc.codigo);
      assert.ok(texto.includes("CONTRATO DE SERVICIOS"), doc.codigo);
      assert.ok(texto.includes("bloquearla para todos los usuarios"), doc.codigo);
      assert.ok(texto.includes("propiedad exclusiva de"), doc.codigo);
      if (persona === "natural") {
        assert.ok(texto.includes("actuando en su propio nombre"), doc.codigo);
      } else {
        assert.ok(texto.includes("actuando en representación de"), doc.codigo);
      }
    }
  });

  it("el objeto de la PRIMERA es el literal de cada categoría", () => {
    for (const c of CATEGORIAS_CONTRATO) {
      const doc = contratoDe(c.categoria, "natural");
      const resuelto = resolver(doc, datosDePrueba({ persona: "natural" }));
      const primera = resuelto.bloques.find((b) => b.tipo === "clausula");
      assert.ok(primera && primera.tipo === "clausula");
      assert.ok(primera.texto.includes(c.objeto), `${doc.codigo}: ${c.objeto}`);
    }
  });

  it("el expediente nuevo lleva la variante en el puesto 4", () => {
    for (const c of CATEGORIAS_CONTRATO) {
      for (const persona of ["natural", "juridica"] as const) {
        const expediente = documentosDeExpediente(c.categoria, persona);
        assert.equal(expediente.length, 8);
        assert.equal(expediente[3].codigo, contratoDe(c.categoria, persona).codigo);
        assert.deepEqual(
          expediente.filter((d) => d.codigo !== expediente[3].codigo).map((d) => d.codigo),
          DOCUMENTOS_BASE.map((d) => d.codigo),
        );
      }
    }
  });

  it("CON-004 sigue publicado y resoluble para los expedientes históricos", () => {
    const con = DOCUMENTO_POR_CODIGO.get("BWS-CON-004");
    assert.ok(con);
    assert.deepEqual(validarPlantilla(con), []);
    const resuelto = resolver(con, datosDePrueba());
    assert.ok(JSON.stringify(resuelto.bloques).includes("anexo"));
    assert.equal(DOCUMENTOS.length, 8);
  });
});

describe("sello de contenido del contrato", () => {
  it("las tasas congeladas entran en el sello de contenido", () => {
    const doc = CONTRATOS[0];
    const datos = datosDePrueba({ persona: "natural" });
    const firmas = firmasDePrueba();
    const args = { doc, datos, firmas: [firmas.representante, firmas.cliente], utc: UTC };
    const sello = selloDeContenido(args);
    const otras = { ...datos, variables: { ...datos.variables, mantenimiento_bs: "Bs. 1,00" } };
    assert.notEqual(sello, selloDeContenido({ ...args, datos: otras }));
  });
});

describe("PDF del contrato", () => {
  it("dos pasadas producen el mismo archivo, en natural y jurídica", async () => {
    const firmas = firmasDePrueba();
    const evidencia: Evidencia = {
      sello: "sello-de-prueba",
      hashPlantilla: "plantilla-de-prueba",
      utc: UTC,
    };
    for (const persona of ["natural", "juridica"] as const) {
      const doc = contratoDe("Tienda en línea", persona);
      const datos = datosDePrueba({ persona });
      const resuelto = resolver(doc, datos);
      const opciones = {
        doc: resuelto,
        datos,
        firmas,
        evidencia,
        fechaCreacion: new Date(UTC),
        leerFuente: lectorNodo,
      };
      const uno = await generarPDF(opciones);
      const dos = await generarPDF(opciones);
      assert.equal(sha256Hex(uno), sha256Hex(dos), doc.codigo);
      assert.ok(uno.length > 20000, doc.codigo);
    }
  });
});

describe("tramos de negrita", () => {
  it("parte el texto alternando normal y negrita", () => {
    assert.deepEqual(partirRuns("entre **LA EMPRESA** y **EL CLIENTE**"), [
      { texto: "entre ", negrita: false },
      { texto: "LA EMPRESA", negrita: true },
      { texto: " y ", negrita: false },
      { texto: "EL CLIENTE", negrita: true },
    ]);
    assert.deepEqual(partirRuns("sin negritas"), [{ texto: "sin negritas", negrita: false }]);
  });
});