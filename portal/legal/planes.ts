/* ============================================================
   Presets de infraestructura para la app del cliente
   ------------------------------------------------------------
   No son los límites del portal: son los planes que ve el cliente
   para SU aplicación. Se guardan como presets versionados y el
   anexo B se arma desde la fila elegida, nunca desde cifras escritas
   a mano en el contrato.

   Regla de precio: precio = costo del proveedor + margen, con piso
   de USD 30 para Pro. El desglose interno (costo y margen) vive en
   `docs/legal/economia.md` y no se imprime en el expediente.
   ============================================================ */

import type { LimitePlan } from "./tipos";

export interface NivelPlan {
  clave: "inicial" | "pro";
  nombre: string;
  precio_usd: number;
  limites: LimitePlan[];
  costo_estimado_usd: number;
  margen_usd: number;
  fuente: string;
  fecha: string;
  /** Solo para uso interno; nunca se imprime en el anexo B. */
  nota_interna?: string;
}

export interface PresetPlan {
  clave: "supabase" | "neon-cloudflare";
  nombre: string;
  niveles: NivelPlan[];
}

const FECHA = "11 de noviembre de 2026";

export const PRESETS: PresetPlan[] = [
  {
    clave: "supabase",
    nombre: "Supabase",
    niveles: [
      {
        clave: "inicial",
        nombre: "Inicial",
        precio_usd: 0,
        limites: [
          { concepto: "Usuarios activos por mes", valor: "hasta 50.000" },
          { concepto: "Almacenamiento de archivos", valor: "1 GB" },
          { concepto: "Espacio de base de datos", valor: "500 MB" },
          {
            concepto: "Disponibilidad",
            valor: "el servicio se pausa tras siete (7) días continuos sin actividad",
          },
        ],
        costo_estimado_usd: 0,
        margen_usd: 0,
        fuente: "Condiciones públicas del plan gratuito de Supabase",
        fecha: FECHA,
      },
      {
        clave: "pro",
        nombre: "Pro",
        precio_usd: 30,
        limites: [
          { concepto: "Disponibilidad", valor: "continua, sin pausa por inactividad" },
          { concepto: "Respaldos", valor: "diarios automáticos" },
          { concepto: "Límites", valor: "ampliados según las condiciones del proveedor" },
        ],
        costo_estimado_usd: 25,
        margen_usd: 5,
        fuente: "Condiciones públicas del plan Pro de Supabase",
        fecha: FECHA,
        nota_interna:
          "El costo del proveedor deja USD 5 antes de margen (17 %). Si el cliente exige su propia cuenta Pro, se sube el plan o se factura la infraestructura aparte.",
      },
    ],
  },
  {
    clave: "neon-cloudflare",
    nombre: "Neon + Cloudflare",
    niveles: [
      {
        clave: "inicial",
        nombre: "Inicial",
        precio_usd: 0,
        limites: [
          { concepto: "Almacenamiento por proyecto", valor: "1 GB" },
          { concepto: "Cómputo", valor: "hasta 100 horas de cómputo al mes" },
          {
            concepto: "Alojamiento y funciones",
            valor: "plan gratuito de Cloudflare: hasta 100.000 solicitudes al día",
          },
          {
            concepto: "Disponibilidad",
            valor: "el servicio se suspende por inactividad y se reanuda al recibir tráfico",
          },
        ],
        costo_estimado_usd: 0,
        margen_usd: 0,
        fuente: "Condiciones públicas del plan gratuito de Neon y del plan Free de Cloudflare",
        fecha: FECHA,
      },
      {
        clave: "pro",
        nombre: "Pro",
        precio_usd: 30,
        limites: [
          { concepto: "Disponibilidad", valor: "continua, sin suspensión por inactividad" },
          { concepto: "Respaldos", valor: "automáticos según el proveedor" },
          {
            concepto: "Alojamiento y funciones",
            valor: "Cloudflare Workers Paid: 30 s de CPU por solicitud",
          },
          { concepto: "Límites", valor: "ampliados según consumo y condiciones del proveedor" },
        ],
        costo_estimado_usd: 24,
        margen_usd: 6,
        fuente: "Condiciones públicas del plan Launch de Neon y del plan Workers Paid de Cloudflare",
        fecha: FECHA,
        nota_interna:
          "Neon Launch (USD 19) más Workers Paid (USD 5). Cloudflare no imputa por solicitud dentro del plan; el costo por cliente es la suma de ambos mínimos.",
      },
    ],
  },
];

export const PRESET_POR_CLAVE = new Map(PRESETS.map((p) => [p.clave, p]));

export function nivelDePlan(preset: PresetPlan["clave"], nivel: NivelPlan["clave"]): NivelPlan {
  const encontrado = PRESET_POR_CLAVE.get(preset)?.niveles.find((n) => n.clave === nivel);
  if (!encontrado) throw new Error(`Plan desconocido: ${preset}/${nivel}`);
  return encontrado;
}

export const PLAN_PREDETERMINADO = {
  preset: "supabase" as const,
  nivel: "inicial" as const,
};
