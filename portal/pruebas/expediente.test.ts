/* ============================================================
   Armado del expediente
   ------------------------------------------------------------
   Sin base de datos. Comprueba que las cuatro fuentes (prestador,
   cliente, proyecto y firma) se convierten en variables completas,
   que las dos firmas conservan su origen y que el sello no cambia
   entre dos lecturas del mismo expediente pero sí al mover la
   fecha o la identidad del cliente.
   ============================================================ */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  datosDeExpediente,
  firmasDeExpediente,
  type ClienteExpediente,
  type FirmaExpediente,
  type ProyectoExpediente,
  type RepresentanteExpediente,
} from "../api/_lib/expediente.ts";
import type { PlanVista } from "../api/_lib/planes.ts";
import type { ProyectoVista } from "../api/_lib/proyecto.ts";
import { fechaLarga } from "../legal/fechas.ts";
import { DOCUMENTOS } from "../legal/index.ts";
import { hashCadena, selloDeContenido } from "../render/hash.ts";

const PLAN: PlanVista = {
  clave: "neon-vercel",
  nivel: "pro",
  version: 1,
  nombre: "Pro",
  precio_usd: 30,
  limites: [{ concepto: "Disponibilidad", valor: "continua" }],
  fuente: "Condiciones públicas del plan Pro",
  fecha: "2026-11-11",
  fecha_larga: "11 de noviembre de 2026",
};

const VISTA: ProyectoVista = {
  id: "11111111-1111-1111-1111-111111111111",
  nombre: "Estudio Ana",
  categoria: "Aplicación web",
  dominio: "estudio-ana.com.ve",
  buzones: ["no-reply@estudio-ana.com.ve", "contacto@estudio-ana.com.ve"],
  alcance:
    "Aplicación para agendar citas, cobrar anticipos y enviar recordatorios por correo a cada clienta.",
  complejidad: "media",
  plan_clave: PLAN.clave,
  plan_nivel: PLAN.nivel,
  estado: "enviado",
  creado: "2026-11-11T12:00:00.000Z",
  enviado: "2026-11-11T12:30:00.000Z",
  plan: PLAN,
};

const PROYECTO: ProyectoExpediente = {
  fila: { id: VISTA.id, cliente_id: "22222222-2222-2222-2222-222222222222" },
  vista: VISTA,
  plan: PLAN,
};

const CLIENTE: ClienteExpediente = {
  id: "22222222-2222-2222-2222-222222222222",
  razon_social: "Ana Pérez Diseño, C.A.",
  documento_tipo: "RIF",
  documento_numero: "J-12345678-9",
  domicilio: "Av. Libertador, Caracas, Distrito Capital, Venezuela",
  telefono: "+58 412 123 4567",
  correo_factura: "facturas@anaejemplo.com",
  nombre: "Ana Pérez",
  correo: "ana@ejemplo.com",
  verificado: true,
};

const FIRMA: FirmaExpediente = {
  id: "33333333-3333-3333-3333-333333333333",
  png: Uint8Array.from([1, 2, 3]),
  sha256: "a".repeat(64),
  utc: new Date("2026-11-11T13:00:00.000Z"),
  metodo: "simple_reforzada",
  ip: "127.0.0.1",
  agente: "pruebas",
};

const REPRESENTANTE: RepresentanteExpediente = {
  id: "44444444-4444-4444-4444-444444444444",
  nombre: "José Blink",
  documento: "V-12345678",
  domicilio: "Av. Francisco de Miranda, Caracas, Distrito Capital, Venezuela",
  correo: "representante@blink.com.ve",
  png: Uint8Array.from([4, 5, 6]),
  sha256: "b".repeat(64),
  utc: new Date("2026-11-11T12:00:00.000Z"),
};

const FECHA = new Date("2026-11-11T14:30:00.000Z");

function armar(fecha: Date, cliente: ClienteExpediente = CLIENTE) {
  const datos = datosDeExpediente({ cliente, representante: REPRESENTANTE, proyecto: PROYECTO, fecha });
  const firmas = firmasDeExpediente({
    cliente,
    firma: FIRMA,
    representante: REPRESENTANTE,
    ip: "127.0.0.1",
    agente: "pruebas",
  });
  return { datos, firmas };
}

function sellar(fecha: Date, cliente: ClienteExpediente = CLIENTE) {
  const { datos, firmas } = armar(fecha, cliente);
  const utc = fecha.toISOString();
  let anterior = "GENESIS";
  return DOCUMENTOS.map((doc, indice) => {
    const orden = indice + 1;
    const sello = selloDeContenido({
      doc,
      datos,
      firmas: [firmas.representante, firmas.cliente],
      utc,
    });
    const previo = anterior;
    const cadena = hashCadena(previo, sello, orden);
    anterior = cadena;
    return { sello, cadena, anterior: previo };
  });
}

describe("variables del expediente", () => {
  it("reúne prestador, cliente, proyecto, plan y buzones", () => {
    const { datos } = armar(FECHA);
    assert.equal(datos.variables.fecha_documento, fechaLarga(FECHA));
    assert.equal(datos.variables.tasa_bcv_fecha, fechaLarga(FECHA));
    assert.equal(datos.variables.cliente_documento_tipo, "RIF");
    assert.equal(datos.variables.cliente_documento_numero, CLIENTE.documento_numero);
    assert.equal(datos.variables.representante_domicilio, REPRESENTANTE.domicilio);
    assert.equal(datos.variables.proyecto_dominio, VISTA.dominio);
    assert.equal(datos.variables.plan_precio, "USD 30");
    assert.equal(datos.variables.plan_nombre, "Pro de Neon + Vercel");
    assert.ok(datos.variables.bws_razon_social.length > 0);

    assert.deepEqual(datos.buzones, [
      { correo: "no-reply@estudio-ana.com.ve", uso: "Notificaciones automáticas (obligatorio)" },
      { correo: "contacto@estudio-ana.com.ve", uso: "Correo operativo del proyecto" },
    ]);
    assert.deepEqual(datos.limites, [{ concepto: "Disponibilidad", valor: "continua" }]);
  });

  it("fija la fecha comercial con la fecha del documento", () => {
    const otroDia = new Date("2026-11-13T14:30:00.000Z");
    assert.equal(armar(otroDia).datos.variables.tasa_bcv_fecha, fechaLarga(otroDia));
    assert.notEqual(
      armar(otroDia).datos.variables.tasa_bcv_fecha,
      armar(FECHA).datos.variables.tasa_bcv_fecha,
    );
  });
});

describe("firmas del expediente", () => {
  it("conserva el origen y el instante de cada firma", () => {
    const { firmas } = armar(FECHA);
    assert.equal(firmas.representante.nombre, REPRESENTANTE.nombre);
    assert.equal(firmas.representante.documento, REPRESENTANTE.documento);
    assert.equal(firmas.representante.utc, REPRESENTANTE.utc.toISOString());
    assert.equal(firmas.representante.metodo, "simple_reforzada");
    assert.equal(firmas.cliente.nombre, CLIENTE.nombre);
    assert.equal(firmas.cliente.documento, CLIENTE.documento_numero);
    assert.equal(firmas.cliente.correo, CLIENTE.correo);
    assert.equal(firmas.cliente.utc, FIRMA.utc.toISOString());
    assert.equal(firmas.cliente.ip, FIRMA.ip);
  });
});

describe("sello y cadena", () => {
  it("sella los ocho documentos igual en dos lecturas", () => {
    const primera = sellar(FECHA);
    const segunda = sellar(FECHA);
    assert.equal(primera.length, 8);
    assert.deepEqual(
      primera.map((d) => d.sello),
      segunda.map((d) => d.sello),
    );
    for (const eslabon of primera) {
      assert.match(eslabon.sello, /^[0-9a-f]{64}$/);
      assert.match(eslabon.cadena, /^[0-9a-f]{64}$/);
    }
  });

  it("encadena desde GENESIS sin saltos", () => {
    const eslabones = sellar(FECHA);
    let anterior = "GENESIS";
    for (const [indice, eslabon] of eslabones.entries()) {
      assert.equal(eslabon.anterior, anterior, `el eslabón ${indice + 1} no apunta al anterior`);
      assert.equal(eslabon.cadena, hashCadena(anterior, eslabon.sello, indice + 1));
      anterior = eslabon.cadena;
    }
  });

  it("cambia si cambia la fecha o la identidad del cliente", () => {
    const base = sellar(FECHA).map((d) => d.sello);
    const otroDia = sellar(new Date("2026-11-12T14:30:00.000Z")).map((d) => d.sello);
    assert.notDeepEqual(otroDia, base);

    const otroCliente = sellar(FECHA, { ...CLIENTE, nombre: "Otra Persona" }).map((d) => d.sello);
    assert.notDeepEqual(otroCliente, base);
  });
});
