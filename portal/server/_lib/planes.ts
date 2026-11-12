/* ============================================================
   Planes de infraestructura de la app del cliente
   ------------------------------------------------------------
   El anexo B se arma desde la fila de `planes_infra` que se eligió
   al enviar el proyecto, no desde números escritos en el código.
   Si el proveedor cambia sus límites, se publica una versión nueva
   y la anterior queda `retirada`: un anexo firmado sigue imprimiendo
   la versión que se firmó.

   El costo y el margen son internos: nunca salen en esta vista ni
   en la respuesta de la API.
   ============================================================ */

import { db } from "./db";
import { fechaLarga } from "../../legal/fechas";
import type { LimitePlan } from "../../legal/tipos";

export interface PlanVista {
  clave: string;
  nivel: string;
  version: number;
  nombre: string;
  precio_usd: number;
  limites: LimitePlan[];
  fuente: string;
  fecha: string;
  fecha_larga: string;
}

export interface PresetVista {
  clave: string;
  nombre: string;
  niveles: PlanVista[];
}

const NOMBRES: Record<string, string> = {
  supabase: "Supabase",
  "neon-cloudflare": "Neon + Cloudflare",
};

function limitesDe(valor: unknown): LimitePlan[] {
  let datos = valor;
  if (typeof datos === "string") {
    try {
      datos = JSON.parse(datos);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(datos)) return [];
  return datos
    .filter((fila): fila is Record<string, unknown> => Boolean(fila) && typeof fila === "object")
    .map((fila) => ({
      concepto: String(fila.concepto ?? ""),
      valor: String(fila.valor ?? ""),
    }));
}

function fechaIso(valor: unknown): string {
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  return String(valor ?? "").slice(0, 10);
}

/** `11 de noviembre de 2026`, en la zona de Caracas. */
export function fechaDePlan(iso: string): string {
  const fecha = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(fecha.getTime()) ? iso : fechaLarga(fecha);
}

function aVista(fila: Record<string, unknown>): PlanVista {
  const fecha = fechaIso(fila.fecha);
  return {
    clave: String(fila.clave),
    nivel: String(fila.nivel),
    version: Number(fila.version),
    nombre: String(fila.nombre),
    precio_usd: Number(fila.precio_usd),
    limites: limitesDe(fila.limites),
    fuente: String(fila.fuente),
    fecha,
    fecha_larga: fechaDePlan(fecha),
  };
}

/** Presets vigentes, agrupados por proveedor. */
export async function planesVigentes(): Promise<PresetVista[]> {
  const filas = await db()`
    select clave, nivel, version, nombre, limites, precio_usd, fuente, fecha
    from planes_infra
    where estado = 'vigente'
    order by clave, case nivel when 'inicial' then 0 else 1 end
  `;
  const presets: PresetVista[] = [];
  for (const fila of filas as Record<string, unknown>[]) {
    const plan = aVista(fila);
    let preset = presets.find((p) => p.clave === plan.clave);
    if (!preset) {
      preset = { clave: plan.clave, nombre: NOMBRES[plan.clave] ?? plan.clave, niveles: [] };
      presets.push(preset);
    }
    preset.niveles.push(plan);
  }
  return presets;
}

/** Una fila concreta por clave, nivel y versión (la que se firmó). */
export async function planExacto(
  clave: string,
  nivel: string,
  version: number,
): Promise<PlanVista | null> {
  const filas = await db()`
    select clave, nivel, version, nombre, limites, precio_usd, fuente, fecha
    from planes_infra
    where clave = ${clave} and nivel = ${nivel} and version = ${version}
  `;
  const fila = (filas as Record<string, unknown>[])[0];
  return fila ? aVista(fila) : null;
}

/** El preset vigente que corresponde a la elección del cliente. */
export function buscarVigente(
  presets: PresetVista[],
  clave: string,
  nivel: string,
): PlanVista | null {
  return presets.find((p) => p.clave === clave)?.niveles.find((n) => n.nivel === nivel) ?? null;
}

export function nombreDePreset(clave: string): string {
  return NOMBRES[clave] ?? clave;
}
