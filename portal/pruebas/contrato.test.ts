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
import { resolver, validarPlantilla, variablesUsadas } from "../legal/validar.ts";
import { datosDeExpediente, type ClienteExpediente, type RepresentanteExpediente } from "../server/_lib/expediente.ts";
import type { PlanVista } from "../server/_lib/planes.ts";
import type { ProyectoVista } from "../server/_lib/proyecto.ts";
import { selloDeContenido, sha256Hex } from "../render/hash.ts";
import { lectorNodo } from "../render/fuentes-nodo.ts";
import { generarPDF } from "../render/pdf.ts";
import { partirRuns } from "../render/runs.ts";
import type { DocumentoLegal, Evidencia, FirmaCapturada } from "../legal/tipos.ts";

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
    representante: { ...base, nombre: "DIEGO ANDRES BELEÑO VILLALOBOS", documento: "V-34.201.580" },
    cliente: { ...base, nombre: "Cliente de Prueba", documento: "V-12345678" },
  };
}

function clausula(doc: DocumentoLegal, ordinal: string): string {
  const bloque = doc.bloques.find((b) => b.tipo === "clausula" && b.ordinal === ordinal);
  assert.ok(bloque && bloque.tipo === "clausula", `${doc.codigo}: ${ordinal}`);
  return bloque.texto;
}

function datosProducidosPorExpediente(persona: "natural" | "juridica") {
  const plan: PlanVista = {
    clave: "supabase",
    nivel: "inicial",
    version: 1,
    nombre: "Inicial",
    precio_usd: 0,
    limites: [{ concepto: "Almacenamiento", valor: "1 GB" }],
    fuente: "Condiciones del proveedor",
    fecha: "2026-11-11",
    fecha_larga: "11 de noviembre de 2026",
  };
  const vista: ProyectoVista = {
    id: "proyecto-prueba",
    persona_tipo: persona,
    cliente_rep_nombre: persona === "juridica" ? "Representante del Cliente" : null,
    cliente_rep_documento: persona === "juridica" ? "V-12345678" : null,
    nombre: "Proyecto de prueba",
    categoria: "Sitio web",
    dominio: "ejemplo.com.ve",
    buzones: ["no-reply@ejemplo.com.ve"],
    alcance: "Sitio con catálogo y panel de administración configurables.",
    complejidad: "media",
    plan_clave: plan.clave,
    plan_nivel: plan.nivel,
    estado: "enviado",
    creado: UTC,
    enviado: UTC,
    plan,
  };
  const cliente: ClienteExpediente = {
    id: "cliente-prueba",
    razon_social: persona === "natural" ? "Cliente de Prueba" : "Cliente de Prueba, C.A.",
    documento_tipo: persona === "natural" ? "cedula" : "RIF",
    documento_numero: persona === "natural" ? "V-12345678" : "J-12345678-9",
    domicilio: "Maracaibo, Estado Zulia, Venezuela",
    telefono: "+58 412 1234567",
    correo_factura: "facturas@ejemplo.com",
    nombre: "Cliente de Prueba",
    correo: "cliente@ejemplo.com",
    verificado: true,
  };
  const representante: RepresentanteExpediente = {
    id: "representante-prueba",
    nombre: "Representante de Prueba",
    documento: "V-00000000",
    domicilio: "Maracaibo, Estado Zulia, Venezuela",
    correo: "representante@ejemplo.com",
    png: PNG_PRUEBA,
    sha256: "hash-de-prueba",
    utc: new Date(UTC),
  };
  return datosDeExpediente({
    cliente,
    representante,
    proyecto: { fila: {}, vista, plan },
    fecha: new Date(UTC),
  });
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
      const datos = datosDePrueba({ persona });
      const resuelto = resolver(doc, datos);
      const texto = JSON.stringify(resuelto.bloques);
      assert.ok(!texto.includes("{{"), doc.codigo);
      assert.ok(texto.includes("CONTRATO DE SERVICIOS"), doc.codigo);
      assert.ok(texto.includes("bloquearla para todos los usuarios"), doc.codigo);
      assert.ok(texto.includes("propiedad exclusiva de"), doc.codigo);
      if (persona === "natural") {
        assert.ok(texto.includes("actuando en su propio nombre"), doc.codigo);
      } else {
        assert.ok(texto.includes("quien firma en su representación"), doc.codigo);
        assert.ok(texto.includes(datos.variables.cliente_rep_nombre), doc.codigo);
        assert.ok(texto.includes(datos.variables.cliente_rep_documento), doc.codigo);
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

  it("el ensamblador de variantes coloca el contrato en el puesto 4", () => {
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

  it("usa únicamente campos del catálogo que produce el expediente real", () => {
    for (const [i, doc] of CONTRATOS.entries()) {
      const persona = i % 2 === 0 ? "natural" : "juridica";
      const datos = datosProducidosPorExpediente(persona);
      assert.deepEqual([...doc.campos].sort(), [...variablesUsadas(doc)].sort(), doc.codigo);
      assert.ok(doc.campos.every((campo) => datos.variables[campo]?.trim()), doc.codigo);
      const resuelto = resolver(doc, datos);
      for (const campo of ["cliente_rep_nombre", "cliente_rep_documento"]) {
        assert.equal(doc.campos.includes(campo), persona === "juridica", `${doc.codigo}: ${campo}`);
        if (persona === "juridica") {
          const preambulo = resuelto.bloques[3];
          assert.ok(preambulo.tipo === "parrafo", doc.codigo);
          assert.ok(preambulo.texto.includes(datos.variables[campo]), `${doc.codigo}: ${campo}`);
          const variables = { ...datos.variables };
          delete variables[campo];
          assert.throws(() => resolver(doc, { ...datos, variables }), new RegExp(campo), doc.codigo);
        } else {
          assert.equal(datos.variables[campo], undefined, `${doc.codigo}: ${campo}`);
        }
      }
    }
  });
});

describe("condiciones del contrato", () => {
  for (const doc of CONTRATOS) {
    it(`${doc.codigo} conserva las condiciones y evita referencias visibles por código`, () => {
      const texto = JSON.stringify(doc.bloques);
      assert.doesNotMatch(texto, /[;«»]/);
      assert.doesNotMatch(texto, /BWS-[A-Z]{3}-\d{3}/);
      assert.doesNotMatch(texto, /\b(?:ley(?:es)?|art[ií]culos?|c[oó]digo (?:civil|mercantil|penal))\b/i);
      assert.doesNotMatch(texto.replaceAll("BLINK TECHNOLOGY CORPORATION", "").replaceAll("Powered by Blink", ""), /blink/i);
      assert.match(texto, /DIEGO ANDRES BELEÑO VILLALOBOS/);
      assert.match(texto, /V-34\.201\.580/);
      assert.match(texto, /J-50898639-3/);
      assert.doesNotMatch(texto, /\{\{(?:bws_razon_social|bws_documento|representante_nombre|representante_documento)\}\}/);
      const preambuloEmpresa = doc.bloques[2];
      const preambuloCliente = doc.bloques[3];
      assert.ok(preambuloEmpresa.tipo === "parrafo" && preambuloCliente.tipo === "parrafo");
      assert.match(preambuloEmpresa.texto, /denominada en adelante \*\*LA EMPRESA\*\*/);
      if (doc.campos.includes("cliente_rep_nombre")) {
        assert.match(preambuloCliente.texto, /representada en este acto por \*\*\{\{cliente_rep_nombre\}\}\*\*/);
        assert.match(preambuloCliente.texto, /cédula de identidad \*\*\{\{cliente_rep_documento\}\}\*\*/);
        assert.match(preambuloCliente.texto, /quien firma en su representación/);
      }

      const tabla = doc.bloques.find((b) => b.tipo === "tabla");
      assert.ok(tabla && tabla.tipo === "tabla");
      assert.deepEqual(tabla.filas.map((fila) => fila[0]), [
        "Nombre comercial", "Categoría", "Dominio", "Complejidad declarada", "Plan de infraestructura",
      ]);
      const plan = tabla.filas.find((fila) => fila[0] === "Plan de infraestructura")?.[1];
      assert.ok(plan, doc.codigo);
      assert.match(plan, /\{\{plan_nombre\}\}.*\{\{plan_precio\}\} mensuales de infraestructura/);
      assert.match(plan, /Incluye desarrollo y mantenimiento en planes desde USD 31 mensuales/);
      assert.match(plan, /descripción técnica es configurable según el alcance del formulario indicado a continuación/);
      assert.match(texto, /Descripción técnica y alcance del formulario/);
      assert.match(texto, /\{\{proyecto_alcance\}\}/);
      assert.match(texto, /sin imponer una tecnología específica/);
      const cuarta = doc.bloques.findIndex((b) => b.tipo === "clausula" && b.ordinal === "CUARTA:");
      const septima = doc.bloques.findIndex((b) => b.tipo === "clausula" && b.ordinal === "SÉPTIMA:");
      assert.ok(cuarta >= 0 && septima > cuarta);
      const alcanceYEntregas = JSON.stringify(doc.bloques.slice(cuarta, septima));
      assert.doesNotMatch(alcanceYEntregas, /\b(?:actas?|anexos?)\b/i);
      assert.match(alcanceYEntregas, /acuerdo escrito entre las partes/);
      assert.match(clausula(doc, "QUINTA:"), /catorce \(14\) a cuarenta y dos \(42\) días hábiles/);
      assert.match(clausula(doc, "QUINTA:"), /cinco \(5\) días hábiles/);
      assert.match(clausula(doc, "QUINTA:"), /aceptación definitiva puede expresarse por escrito o producirse conforme al plazo indicado/);
      assert.doesNotMatch(clausula(doc, "QUINTA:"), /\{\{demo_plazo\}\}/);
      assert.match(clausula(doc, "SEXTA:"), /dos \(2\) rondas de cambios/);
      assert.match(clausula(doc, "SEXTA:"), /acuerdo escrito de las partes sobre su precio y plazo propios/);
      assert.match(clausula(doc, "SEXTA:"), /Se paga antes de ejecutarse/);

      const precio = clausula(doc, "OCTAVA:");
      assert.match(precio, /desarrollo y mantenimiento parte de \*\*USD 31\*\*/);
      assert.match(precio, /\{\{tarifa_desarrollo\}\}/);
      for (const medio of ["Pago Móvil", "transferencia bancaria", "USDT", "USDC", "BTC", "ETH"]) {
        assert.ok(texto.includes(medio), `${doc.codigo}: ${medio}`);
      }
      assert.match(texto, /monto correspondiente se acuerda al momento de cada pago/);
      assert.doesNotMatch(texto, /tasa P2P de Binance|tasa de cambio de referencia/i);
      const octava = doc.bloques.findIndex((b) => b.tipo === "clausula" && b.ordinal === "OCTAVA:");
      const novena = doc.bloques.findIndex((b) => b.tipo === "clausula" && b.ordinal === "NOVENA:");
      assert.ok(octava >= 0 && novena > octava);
      const pagos = JSON.stringify(doc.bloques.slice(octava, novena));
      assert.match(pagos, /En cada pago, los tributos y las retenciones aplicables se calculan y gestionan/);
      assert.match(pagos, /los soportes o comprobantes correspondientes se emiten y gestionan/);
      assert.match(pagos, /según la condición fiscal declarada por \*\*EL CLIENTE\*\*/);
      assert.doesNotMatch(texto, /(?:sin|no (?:se )?(?:cobra|aplica|emite)) (?:IVA|facturas?)/i);
      for (const campo of ["tasa_bcv_fecha", "tasa_bcv_valor", "tasa_p2p_valor", "tasa_p2p_fecha", "mantenimiento_bs", "mantenimiento_btc", "mantenimiento_eth"]) {
        assert.ok(!doc.campos.includes(campo), `${doc.codigo}: ${campo}`);
      }

      const dominio = clausula(doc, "NOVENA:");
      assert.match(dominio, /a nombre y por cuenta de \*\*BLINK TECHNOLOGY CORPORATION\*\*/);
      assert.match(dominio, /gestiona y paga su registro y renovación/);
      assert.match(dominio, /conserva la propiedad del dominio y la cuenta de registro.*sin solicitar credenciales personales a \*\*EL CLIENTE\*\* ni vulnerar sus datos/);
      assert.match(dominio, /Se recomienda la extensión \.com\.ve.*EUR 16,04 al año.*la paga y gestiona directamente/);
      assert.match(dominio, /demás extensiones están sujetas a precio y disponibilidad/);
      assert.match(dominio, /coopera con la transferencia del dominio si \*\*EL CLIENTE\*\* la solicita/);
      assert.match(dominio, /Al finalizar el Proyecto, \*\*EL CLIENTE\*\* recibe sus correos corporativos, claves y credenciales correspondientes/);
      assert.match(dominio, /incluidas las del panel de administración de la aplicación/);

      const licencia = clausula(doc, "DÉCIMA SEGUNDA:");
      assert.match(licencia, /Powered by Blink.*hasta que la compra total del código y del sistema sea acordada por escrito y pagada en su totalidad/);
      const mora = clausula(doc, "DÉCIMA CUARTA:");
      assert.match(mora, /No existe período de gracia/);
      assert.match(mora, /Al vencimiento de una mensualidad impagada.*puede suspender/);
      assert.match(mora, /mensualidades vencidas se acumulan como deuda/);
      assert.match(mora, /intereses.*sin fijar una tasa/);
      assert.doesNotMatch(mora, /intereses?[^.]*\d|tasa[^.]*\d|\d+(?:[.,]\d+)?\s*%/i);
      assert.match(clausula(doc, "DÉCIMA QUINTA:"), /reactivación exige el pago de todas las mensualidades acumuladas y los intereses moratorios aplicables/);
      assert.match(clausula(doc, "VIGÉSIMA TERCERA:"), /se rige por las estipulaciones de este contrato y las políticas internas de la plataforma/);
      assert.match(clausula(doc, "DÉCIMA SEXTA:"), /treinta \(30\) días siguientes a la entrega definitiva/);
      assert.doesNotMatch(clausula(doc, "DÉCIMA SÉPTIMA:"), /doce \(12\) meses|limita al monto/i);
      assert.match(clausula(doc, "DÉCIMA OCTAVA:"), /dominio sigue a nombre de \*\*BLINK TECHNOLOGY CORPORATION\*\*/);
      assert.match(clausula(doc, "VIGÉSIMA:"), /hasta que las partes acuerden por escrito términos definitivos de confidencialidad/);
      assert.match(clausula(doc, "VIGÉSIMA TERCERA:"), /jurisdicción exclusiva.*Maracaibo, Estado Zulia/);
      assert.match(clausula(doc, "VIGÉSIMA CUARTA:"), /Al estampar su firma, \*\*EL CLIENTE\*\* acepta expresamente la totalidad de los términos y cláusulas/);
    });
  }

  it("conserva el alcance escrito y configura el proyecto con datos del formulario", () => {
    const doc = contratoDe("Aplicación web", "natural");
    const datos = datosProducidosPorExpediente("natural");
    datos.variables.proyecto_alcance = "Panel con tecnología elegida por el cliente y funciones descritas en el formulario.";
    datos.variables.proyecto_dominio = "ejemplo.net";
    datos.variables.plan_nombre = "Plan configurable";
    const resuelto = resolver(doc, datos);
    const texto = JSON.stringify(resuelto.bloques);
    const tabla = resuelto.bloques.find((b) => b.tipo === "tabla");
    assert.ok(tabla && tabla.tipo === "tabla");
    assert.ok(tabla.filas.find((fila) => fila[0] === "Plan de infraestructura")?.[1].includes("Plan configurable"));
    assert.ok(texto.includes(datos.variables.proyecto_alcance));
    assert.ok(texto.includes("ejemplo.net"));
  });
});

describe("sello de contenido del contrato", () => {
  it("sella el alcance, pero no las tasas ni equivalentes que no se usan", () => {
    const doc = CONTRATOS[0];
    const datos = datosDePrueba({ persona: "natural" });
    const firmas = firmasDePrueba();
    const args = { doc, datos, firmas: [firmas.representante, firmas.cliente], utc: UTC };
    const sello = selloDeContenido(args);
    const otrosDatos = { ...datos, variables: { ...datos.variables, proyecto_alcance: "Otro alcance" } };
    assert.notEqual(sello, selloDeContenido({ ...args, datos: otrosDatos }));
    const otrasTasas = {
      ...datos,
      variables: {
        ...datos.variables,
        tasa_p2p_valor: "tasa no usada",
        tasa_bcv_valor: "otra tasa no usada",
        mantenimiento_bs: "equivalente no usado",
        mantenimiento_btc: "BTC no usado",
        mantenimiento_eth: "ETH no usado",
      },
    };
    assert.equal(sello, selloDeContenido({ ...args, datos: otrasTasas }));
    assert.doesNotMatch(JSON.stringify(resolver(doc, otrasTasas).bloques), /(?:tasa|equivalente|BTC|ETH) no usad[ao]/);
  });

  it("sella al representante solo en contratos de persona jurídica", () => {
    const firmas = firmasDePrueba();
    for (const persona of ["natural", "juridica"] as const) {
      const doc = contratoDe("Sitio web", persona);
      const datos = datosDePrueba({ persona });
      const args = { doc, datos, firmas: [firmas.representante, firmas.cliente], utc: UTC };
      const sello = selloDeContenido(args);
      for (const campo of ["cliente_rep_nombre", "cliente_rep_documento"]) {
        const otrosDatos = { ...datos, variables: { ...datos.variables, [campo]: "Otro valor" } };
        const otroSello = selloDeContenido({ ...args, datos: otrosDatos });
        if (persona === "juridica") assert.notEqual(sello, otroSello, campo);
        else assert.equal(sello, otroSello, campo);
      }
    }
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

  it("admite el alcance máximo del formulario sin desbordar la tabla", async () => {
    const doc = contratoDe("Aplicación web", "juridica");
    const datos = datosProducidosPorExpediente("juridica");
    datos.variables.proyecto_alcance = "Alcance configurable para el proyecto. ".repeat(200).slice(0, 6000);
    assert.equal(datos.variables.proyecto_alcance.length, 6000);
    const resuelto = resolver(doc, datos);
    const tabla = resuelto.bloques.find((b) => b.tipo === "tabla");
    assert.ok(tabla && tabla.tipo === "tabla");
    assert.ok(!JSON.stringify(tabla).includes(datos.variables.proyecto_alcance));
    const pdf = await generarPDF({
      doc: resuelto,
      datos,
      firmas: firmasDePrueba(),
      evidencia: { sello: "sello-de-prueba", hashPlantilla: "plantilla-de-prueba", utc: UTC },
      fechaCreacion: new Date(UTC),
      leerFuente: lectorNodo,
    });
    assert.ok(pdf.length > 20000);
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