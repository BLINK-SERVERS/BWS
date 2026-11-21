import type { DatosExpediente, DocumentoLegal } from "./tipos";
import { CAMPOS } from "./campos";
import { nivelDePlan, type NivelPlan, type PresetPlan } from "./planes";
import { REG_001 } from "./textos/reg-001";
import { LEG_002 } from "./textos/leg-002";
import { LEG_003 } from "./textos/leg-003";
import { CON_004 } from "./textos/con-004";
import { PRI_005 } from "./textos/pri-005";
import { WEB_006 } from "./textos/web-006";
import { LIC_007 } from "./textos/lic-007";
import { NDA_008 } from "./textos/nda-008";
import { CONTRATOS, contratoDe, type PersonaContrato } from "./textos/con-servicios";
import { DOCUMENTOS_COMUNES_ACTUALIZADOS } from "./textos/comunes-actualizados";

export { CONTRATOS, contratoDe, CATEGORIAS_CONTRATO } from "./textos/con-servicios";
export type { CategoriaContrato, PersonaContrato } from "./textos/con-servicios";

/** Los siete documentos comunes a todo expediente. */
export const DOCUMENTOS_BASE: DocumentoLegal[] = [REG_001, LEG_002, LEG_003, PRI_005, WEB_006, LIC_007, NDA_008];

/**
 * Expediente histórico con CON-004: se conserva para verificar los
 * expedientes ya firmados. Los proyectos nuevos usan la variante del
 * contrato de servicios que corresponde a su categoría y persona.
 */
export const DOCUMENTOS: DocumentoLegal[] = [
  REG_001,
  LEG_002,
  LEG_003,
  CON_004,
  PRI_005,
  WEB_006,
  LIC_007,
  NDA_008,
];

export const PLANTILLAS_ACTUALES = [...DOCUMENTOS_COMUNES_ACTUALIZADOS, ...CONTRATOS];
export const DOCUMENTO_ACTUAL_POR_CODIGO = new Map(PLANTILLAS_ACTUALES.map((doc) => [doc.codigo, doc]));

/** Los ocho documentos de un proyecto nuevo, en el orden en que se firman. */
export function documentosDeExpediente(categoria: string, persona: PersonaContrato): DocumentoLegal[] {
  const comunes = DOCUMENTOS_COMUNES_ACTUALIZADOS;
  return [...comunes.slice(0, 3), contratoDe(categoria, persona), ...comunes.slice(3)];
}

export const DOCUMENTO_POR_CODIGO = new Map(
  [...DOCUMENTOS, ...CONTRATOS].map((d) => [d.codigo, d]),
);

/**
 * Datos de prueba para los PDF locales y las pruebas unitarias.
 * No son datos reales de nadie: el representante de Blink se captura
 * en el panel y nunca se escribe en el repo.
 */
export function datosDePrueba(opciones?: {
  preset?: PresetPlan["clave"];
  nivel?: NivelPlan["clave"];
  persona?: PersonaContrato;
}): DatosExpediente {
  const preset = opciones?.preset ?? "supabase";
  const nivel = opciones?.nivel ?? "pro";
  const persona = opciones?.persona ?? "juridica";
  const plan = nivelDePlan(preset, nivel);

  const variables = Object.fromEntries(CAMPOS.map((c) => [c.clave, c.ejemplo]));
  Object.assign(variables, {
    fecha_documento: "11 de noviembre de 2026",
    bws_razon_social: "Blink",
    bws_documento: "V-00000000",
    bws_domicilio: "Maracaibo, Estado Zulia",
    bws_correo: "business@blink.com.ve",
    bws_telefono: "+1 (631) 821 1938",
    representante_nombre: "Nombre Apellido",
    representante_documento: "V-00000000",
    representante_domicilio: "Maracaibo, Estado Zulia",
    cliente_razon_social: "Cliente de Prueba, C.A.",
    cliente_documento_tipo: "RIF",
    cliente_documento_numero: "J-12345678-9",
    cliente_domicilio: "Valencia, Carabobo, Venezuela",
    cliente_telefono: "+58 412 000 0000",
    cliente_correo: "cliente@ejemplo.com",
    cliente_correo_factura: "facturas@ejemplo.com",
    proyecto_nombre: "Tienda Ejemplo",
    proyecto_categoria: "Comercio electrónico",
    proyecto_dominio: "tiendaejemplo.com.ve",
    proyecto_alcance:
      "Catálogo de productos con fotografías, carrito de compras, pago con referencia bancaria, panel de pedidos y cinco correos corporativos. La administración de contenidos se limita a productos, precios y pedidos; no incluye facturación fiscal automática ni integración con inventario externo.",
    proyecto_complejidad: "Media",
    plan_nombre: plan.nombre,
    plan_precio: plan.precio_usd === 0 ? "USD 0" : `USD ${plan.precio_usd}`,
    plan_fuente: plan.fuente,
    plan_fecha: plan.fecha,
    dominio_costo_eur: "16,04 EUR",
    tasa_bcv_fecha: "11 de noviembre de 2026",
    tasa_bcv_valor: "Bs. 36,5000",
    dominio_costo_bs: "Bs. 585,46",
    demo_plazo: "siete (7) a catorce (14) días hábiles",
    tarifa_desarrollo: "USD 31",
    tarifa_infra_pro: "USD 30",
    licencia_duracion: "la vida del servicio contratado",
    credito_meses: "veinticuatro (24) meses",
    correo_proveedor: "el proveedor de correo transaccional contratado por Blink",
    persona_tipo: persona === "natural" ? "Persona natural" : "Persona jurídica",
    cliente_rep_nombre: "Nombre Apellido",
    cliente_rep_documento: "V-00000000",
    mantenimiento_precio: "treinta y un dólares (USD 31)",
    tasa_p2p_valor: "Bs. 245,0000 por USDT",
    tasa_p2p_fecha: "11 de noviembre de 2026",
    mantenimiento_bs: "Bs. 7.595,00",
    mantenimiento_btc: "0,00031000 BTC",
    mantenimiento_eth: "0,01240000 ETH",
  });

  if (persona === "natural") {
    Object.assign(variables, {
      cliente_razon_social: "Cliente de Prueba",
      cliente_documento_tipo: "cédula de identidad",
      cliente_documento_numero: "V-12345678",
    });
  }

  return {
    variables,
    buzones: [
      { correo: "admin@tiendaejemplo.com.ve", uso: "Administración y cuentas internas" },
      { correo: "soporte@tiendaejemplo.com.ve", uso: "Atención al cliente" },
      { correo: "contacto@tiendaejemplo.com.ve", uso: "Contacto general" },
      { correo: "negocios@tiendaejemplo.com.ve", uso: "Alianzas y proveedores" },
      { correo: "no-reply@tiendaejemplo.com.ve", uso: "Notificaciones automáticas" },
    ],
    limites: plan.limites.map((l) => ({ ...l })),
  };
}
