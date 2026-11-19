/* ============================================================
   Alta del proyecto
   ------------------------------------------------------------
   El alcance que se describe aquí es el que se firma: campo por
   campo, sin texto libre interpretado por la máquina. El dominio
   y los buzones se normalizan antes de guardarse, y el plan se
   resuelve contra `planes_infra` para que el anexo B no dependa
   de una cifra escrita en el código.

   Enviar el proyecto lo congela: la base tiene un disparador que
   rechaza cualquier cambio posterior en alcance, buzones, dominio
   o plan. Lo que no quedó escrito se cotiza aparte.
   ============================================================ */

import {
  correoNormalizado,
  domicilioValido,
  dominioDe,
  mensajeDocumento,
  normalizarDocumento,
  normalizarDominio,
  nombreValido,
  razonSocialValida,
  telefonoNormalizado,
  type TipoDocumento,
} from "../../legal/identidad";
import { ErrorHttp } from "./respuestas";
import type { ClienteCuenta } from "./cuenta";
import { nombreDePreset, type PlanVista } from "./planes";

export const CATEGORIAS = [
  "Sitio web",
  "Aplicación web",
  "Tienda en línea",
  "Sistema interno",
  "Portafolio",
  "Otro",
] as const;

export const COMPLEJIDADES = [
  { valor: "simple", etiqueta: "Simple" },
  { valor: "media", etiqueta: "Media" },
  { valor: "alta", etiqueta: "Alta" },
] as const;

export type Complejidad = (typeof COMPLEJIDADES)[number]["valor"];
export type PersonaContrato = "natural" | "juridica";

export interface PersonaProyecto {
  persona_tipo: PersonaContrato | null;
  cliente_rep_nombre: string | null;
  cliente_rep_documento: string | null;
}

export interface ProyectoDatos {
  nombre: string;
  categoria: string;
  dominio: string;
  buzones: string[];
  alcance: string;
  complejidad: Complejidad;
  plan_clave: string;
  plan_nivel: string;
}

export interface ProyectoVista extends ProyectoDatos, PersonaProyecto {
  id: string;
  estado: string;
  creado: string;
  enviado: string | null;
  plan: PlanVista;
}

export interface FichaContrato extends PersonaProyecto {
  persona_tipo: PersonaContrato;
  razon_social: string;
  documento_tipo: TipoDocumento;
  documento_numero: string;
  domicilio: string;
  telefono: string;
  correo_factura: string;
}

function rechazar(mensaje: string, codigo = "proyecto"): never {
  throw new ErrorHttp(400, mensaje, codigo);
}

/** La ficha fiscal que va al contrato se pide al describir el proyecto. */
export function leerFicha(fuente: unknown): FichaContrato {
  if (!fuente || typeof fuente !== "object" || Array.isArray(fuente)) {
    rechazar("Completa los datos para el contrato.", "ficha");
  }
  const datos = fuente as Record<string, unknown>;

  const persona = datos.persona_tipo;
  if (persona !== "natural" && persona !== "juridica") {
    rechazar("Elige si el proyecto es para ti o para tu empresa.", "ficha");
  }

  let representanteNombre: string | null = null;
  let representanteDocumento: string | null = null;
  if (persona === "juridica") {
    representanteNombre = limpiar(datos.cliente_rep_nombre);
    if (!nombreValido(representanteNombre)) {
      rechazar("Escribe el nombre del representante de la empresa.", "ficha");
    }
    representanteDocumento = normalizarDocumento("cedula", datos.cliente_rep_documento);
    if (!representanteDocumento) {
      rechazar("Escribe la cédula del representante con el formato V-12345678.", "ficha");
    }
  }

  const razon = limpiar(datos.razon_social);
  if (!razonSocialValida(razon)) {
    rechazar("Escribe la razón social o el nombre del cliente.", "ficha");
  }

  const tipoCrudo = limpiar(datos.documento_tipo);
  if (tipoCrudo !== "RIF" && tipoCrudo !== "cedula" && tipoCrudo !== "pasaporte") {
    rechazar("Elige el tipo de documento del cliente.", "ficha");
  }
  if (persona === "juridica" && tipoCrudo !== "RIF") {
    rechazar("Para una empresa, elige RIF como documento del cliente.", "ficha");
  }
  const numero = normalizarDocumento(tipoCrudo, datos.documento_numero);
  if (!numero) {
    rechazar(
      mensajeDocumento(tipoCrudo, datos.documento_numero) ?? "Documento inválido.",
      "ficha",
    );
  }

  const domicilio = limpiar(datos.domicilio);
  if (!domicilioValido(domicilio)) {
    rechazar("Escribe el domicilio fiscal completo.", "ficha");
  }

  const telefono = telefonoNormalizado(datos.telefono);
  if (!telefono) {
    rechazar("Escribe un teléfono con al menos siete dígitos.", "ficha");
  }

  const correoFactura = correoNormalizado(datos.correo_factura);
  if (!correoFactura) {
    rechazar("El correo de facturación no tiene un formato válido.", "ficha");
  }

  return {
    persona_tipo: persona,
    cliente_rep_nombre: representanteNombre,
    cliente_rep_documento: representanteDocumento,
    razon_social: razon,
    documento_tipo: tipoCrudo,
    documento_numero: numero,
    domicilio,
    telefono,
    correo_factura: correoFactura,
  };
}

/** Los cinco datos fiscales están completos. */
export function fichaCompleta(cliente: ClienteCuenta): boolean {
  return Boolean(
    cliente.razon_social &&
      cliente.documento_tipo &&
      cliente.documento_numero &&
      cliente.domicilio_fiscal &&
      cliente.correo_factura,
  );
}

function limpiar(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

/** Buzones normalizados, con `no-reply@` obligatorio y máximo de cinco. */
export function normalizarBuzones(valor: unknown, dominio: string): string[] {
  if (!Array.isArray(valor)) rechazar("Los buzones deben llegar como una lista.");
  const buzones: string[] = [];
  for (const entrada of valor) {
    const crudo = limpiar(entrada).toLowerCase();
    if (!crudo) continue;
    const correo = correoNormalizado(crudo);
    if (!correo) rechazar(`El buzón «${crudo}» no tiene un formato válido.`, "buzon");
    if (dominioDe(correo) !== dominio) {
      rechazar(`El buzón «${correo}» debe pertenecer al dominio ${dominio}.`, "buzon");
    }
    if (buzones.includes(correo)) {
      rechazar(`El buzón «${correo}» está repetido.`, "buzon");
    }
    buzones.push(correo);
  }
  if (buzones.length < 1) rechazar("Hace falta al menos un buzón.", "buzon");
  if (buzones.length > 5) {
    rechazar("El proyecto admite un máximo de cinco buzones.", "buzon");
  }
  if (!buzones.some((b) => b.slice(0, b.indexOf("@")) === "no-reply")) {
    rechazar("Falta el buzón no-reply@ del dominio.", "buzon");
  }
  return buzones.sort((a, b) => (a.startsWith("no-reply@") ? -1 : b.startsWith("no-reply@") ? 1 : 0));
}

/** Valida y normaliza lo que llega del formulario. */
export function leerProyecto(fuente: unknown): ProyectoDatos {
  if (!fuente || typeof fuente !== "object" || Array.isArray(fuente)) {
    rechazar("Faltan los datos del proyecto.");
  }
  const datos = fuente as Record<string, unknown>;

  const nombre = limpiar(datos.nombre);
  if (nombre.length < 3 || nombre.length > 120) {
    rechazar("El nombre del proyecto debe tener entre 3 y 120 caracteres.", "nombre");
  }

  const categoria = limpiar(datos.categoria);
  if (!(CATEGORIAS as readonly string[]).includes(categoria)) {
    rechazar("Elige una categoría de la lista.", "categoria");
  }

  const dominio = normalizarDominio(datos.dominio);
  if (!dominio) {
    rechazar("Escribe un dominio válido, por ejemplo estudio.com.ve.", "dominio");
  }

  const buzones = normalizarBuzones(datos.buzones, dominio);

  const alcance = limpiar(datos.alcance);
  if (alcance.length < 40) {
    rechazar("Describe el alcance con al menos 40 caracteres.", "alcance");
  }
  if (alcance.length > 6000) {
    rechazar("El alcance no puede pasar de 6000 caracteres.", "alcance");
  }

  const complejidad = limpiar(datos.complejidad);
  if (!COMPLEJIDADES.some((c) => c.valor === complejidad)) {
    rechazar("Elige una complejidad de la lista.", "complejidad");
  }

  const plan_clave = limpiar(datos.plan_clave);
  const plan_nivel = limpiar(datos.plan_nivel);
  if (!plan_clave || !plan_nivel) {
    rechazar("Elige el plan de infraestructura de la aplicación.", "plan");
  }

  // Los documentos PDF no admiten punto y coma, comillas angulares, viñetas
  // de puntos ni asteriscos de negrita. Se rechaza al guardar, para que el
  // cliente corrija el formulario antes de que el alcance quede congelado.
  const signos = /[;«»•]|\*\*/;
  const prohibido = [
    ["nombre", nombre],
    ["dominio", dominio],
    ["alcance", alcance],
    ...buzones.map((buzon, indice): [string, string] => [`buzón ${indice + 1}`, buzon]),
  ].filter(([, valor]) => signos.test(valor));
  if (prohibido.length) {
    rechazar(
      `En ${prohibido.map(([campo]) => `el ${campo}`).join(", ")} no se admiten punto y coma, comillas angulares, viñetas de puntos ni asteriscos. Sustitúyelos por comas, puntos o comillas dobles.`,
      "alcance",
    );
  }

  return {
    nombre,
    categoria,
    dominio,
    buzones,
    alcance,
    complejidad: complejidad as Complejidad,
    plan_clave,
    plan_nivel,
  };
}

function iso(valor: unknown): string | null {
  if (!valor) return null;
  const fecha = valor instanceof Date ? valor : new Date(String(valor));
  return Number.isNaN(fecha.getTime()) ? null : fecha.toISOString();
}

/** Fila de `proyectos` tal como se devuelve al navegador. */
export function vistaDeProyecto(
  fila: Record<string, unknown>,
  plan: PlanVista,
): ProyectoVista {
  return {
    id: String(fila.id),
    persona_tipo: fila.persona_tipo === "natural" || fila.persona_tipo === "juridica"
      ? fila.persona_tipo : null,
    cliente_rep_nombre: typeof fila.cliente_rep_nombre === "string" ? fila.cliente_rep_nombre : null,
    cliente_rep_documento: typeof fila.cliente_rep_documento === "string" ? fila.cliente_rep_documento : null,
    nombre: String(fila.nombre),
    categoria: String(fila.categoria),
    dominio: String(fila.dominio),
    buzones: (Array.isArray(fila.buzones) ? fila.buzones : []).map(String),
    alcance: String(fila.alcance),
    complejidad: String(fila.complejidad) as Complejidad,
    plan_clave: String(fila.plan_clave),
    plan_nivel: String(fila.plan_nivel),
    estado: String(fila.estado),
    creado: iso(fila.creado) ?? new Date().toISOString(),
    enviado: iso(fila.enviado),
    plan,
  };
}

/** Variables que consume BWS-CON-004. Los datos del prestador y del cliente
 *  se agregan al armar el expediente; aquí van los del proyecto. */
export function variablesDeProyecto(proyecto: ProyectoVista): Record<string, string> {
  const complejidad =
    COMPLEJIDADES.find((c) => c.valor === proyecto.complejidad)?.etiqueta ?? proyecto.complejidad;
  return {
    proyecto_nombre: proyecto.nombre,
    proyecto_categoria: proyecto.categoria,
    proyecto_dominio: proyecto.dominio,
    proyecto_alcance: proyecto.alcance,
    proyecto_complejidad: complejidad,
    plan_nombre: `${proyecto.plan.nombre} de ${nombreDePreset(proyecto.plan.clave)}`,
    plan_precio: `USD ${proyecto.plan.precio_usd}`,
    plan_fuente: proyecto.plan.fuente,
    plan_fecha: proyecto.plan.fecha_larga,
  };
}

/** El proyecto pertenece al cliente en sesión; se vuelve a comprobar aquí. */
export function exigirCliente(cliente: ClienteCuenta | null): ClienteCuenta {
  if (!cliente) {
    throw new ErrorHttp(409, "La cuenta no tiene una ficha fiscal asociada.", "sin_cliente");
  }
  return cliente;
}
