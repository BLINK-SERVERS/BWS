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
  dominioDe,
  normalizarDominio,
} from "../../legal/identidad";
import { ErrorHttp } from "./respuestas";
import type { ClienteCuenta } from "./cuenta";
import { nombreDePreset, type PlanVista } from "./planes";

export const CATEGORIAS = [
  "Sitio web",
  "Aplicación web",
  "Tienda en línea",
  "Sistema interno",
  "Otro",
] as const;

export const COMPLEJIDADES = [
  { valor: "simple", etiqueta: "Simple" },
  { valor: "media", etiqueta: "Media" },
  { valor: "alta", etiqueta: "Alta" },
] as const;

export type Complejidad = (typeof COMPLEJIDADES)[number]["valor"];

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

export interface ProyectoVista extends ProyectoDatos {
  id: string;
  estado: string;
  creado: string;
  enviado: string | null;
  plan: PlanVista;
}

function rechazar(mensaje: string, codigo = "proyecto"): never {
  throw new ErrorHttp(400, mensaje, codigo);
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
