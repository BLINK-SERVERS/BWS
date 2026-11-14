/* ============================================================
   Etapa, cola de trabajo y métricas del panel de administración
   ------------------------------------------------------------
   Todo lo que decide «qué hay que hacer hoy» vive aquí, separado
   de la pantalla y de la base de datos: son funciones puras sobre
   lo que ya devuelve `/api/admin/panel`. No se inventa una tabla
   de tareas: la tarea sale de la evidencia. Un proyecto está en
   la etapa que sus actos de firma, sus envíos y su suscripción
   dicen que está, y así se mantiene si el `estado` guardado se
   quedó atrás.

   Los montos no se mezclan: un pago en bolívares se cuenta en
   bolívares. Convertirlo con la tasa del día sería inventar un
   número que el sistema no registró.
   ============================================================ */

import type {
  ClienteAdmin,
  PanelAdmin,
  PagoAdmin,
  ProyectoAdmin,
  SuscripcionAdmin,
} from "./api";

export type Etapa =
  | "borrador"
  | "ficha"
  | "en_revision"
  | "aprobado"
  | "entregado"
  | "terminado";

export const ETAPAS: { clave: Etapa; etiqueta: string; ayuda: string }[] = [
  {
    clave: "borrador",
    etiqueta: "Borrador",
    ayuda: "El cliente todavía no envía la ficha del proyecto.",
  },
  {
    clave: "ficha",
    etiqueta: "Ficha recibida",
    ayuda: "La ficha está enviada; falta generar el expediente.",
  },
  {
    clave: "en_revision",
    etiqueta: "En revisión",
    ayuda: "Expediente generado y sellado; falta que el cliente lo confirme.",
  },
  {
    clave: "aprobado",
    etiqueta: "Aprobado",
    ayuda: "El cliente confirmó todo; el correo del expediente aún no salió.",
  },
  {
    clave: "entregado",
    etiqueta: "Entregado",
    ayuda: "El expediente firmado salió por correo al cliente.",
  },
  {
    clave: "terminado",
    etiqueta: "Terminado",
    ayuda: "La suscripción terminó: el proyecto quedó cerrado.",
  },
];

export const ETIQUETA_ETAPA: Record<Etapa, string> = Object.fromEntries(
  ETAPAS.map((etapa) => [etapa.clave, etapa.etiqueta]),
) as Record<Etapa, string>;

/** Orden del tablero: más arriba lo que necesita una acción propia. */
export type Accion =
  | "representante"
  | "generar"
  | "verificar"
  | "enviar"
  | "reenviar"
  | "suscripcion"
  | "cobro"
  | "verificacion"
  | null;

export interface Pendiente {
  /** Clave estable para React y para probar la regla suelta. */
  id: string;
  prioridad: number;
  etiqueta: string;
  detalle: string;
  accion: Accion;
  proyectoId?: string;
  clienteId?: string;
  suscripcionId?: string;
}

export interface Metricas {
  clientes: number;
  clientesSinVerificar: number;
  proyectos: number;
  porEtapa: Record<Etapa, number>;
  pendientes: number;
  cobradoMesUsd: number;
  cobradoMesVes: number;
  porCobrarUsd: number;
  porCobrarEn7: number;
  enMora: number;
  suspendidas: number;
  pagosAnulados: number;
  documentosAjustados: number;
  expedientesEntregados: number;
}

/** Ventana con la que el panel avisa: hoy, y lo que cae en estos días. */
export const DIAS_AVISO = 7;

/**
 * Lo que vence dentro de la ventana de aviso. Lo ya vencido no entra:
 * eso lo dicen la mora y la suspensión, cada una con su propia fila.
 */
export function porVencer(
  suscripcion: Pick<SuscripcionAdmin, "estado" | "dias_para_vencer">,
): boolean {
  return (
    suscripcion.estado !== "terminada" &&
    suscripcion.dias_para_vencer >= 0 &&
    suscripcion.dias_para_vencer <= DIAS_AVISO
  );
}

function etapaDeObras(proyecto: ProyectoAdmin): Etapa {
  if (proyecto.envios > 0) return "entregado";
  if (
    proyecto.documentos > 0 &&
    proyecto.actos_cliente >= proyecto.documentos &&
    proyecto.actos_representante >= proyecto.documentos
  ) {
    return "aprobado";
  }
  if (proyecto.documentos > 0) return "en_revision";
  if (proyecto.estado !== "borrador") return "ficha";
  return "borrador";
}

/**
 * La etapa real del proyecto. `terminado` solo cierra un expediente que
 * ya se entregó: una suscripción terminada sobre un proyecto sin correo
 * deja ver lo que falta, no lo que se terminó.
 */
export function etapaDe(
  proyecto: ProyectoAdmin,
  suscripcion?: Pick<SuscripcionAdmin, "estado" | "estado_calculado"> | null,
): Etapa {
  if (proyecto.estado === "terminado") return "terminado";
  const etapa = etapaDeObras(proyecto);
  const cierre = suscripcion?.estado === "terminada" || suscripcion?.estado_calculado === "terminada";
  if (cierre && etapa === "entregado") return "terminado";
  return etapa;
}

export function etapaPorProyecto(
  panel: PanelAdmin,
): Map<string, Etapa> {
  const suscripciones = new Map(panel.suscripciones.map((s) => [s.proyecto_id, s]));
  const mapa = new Map<string, Etapa>();
  for (const proyecto of panel.proyectos) {
    mapa.set(proyecto.id, etapaDe(proyecto, suscripciones.get(proyecto.id) ?? null));
  }
  return mapa;
}

function periodoActual(hoy: string): string {
  return hoy.slice(0, 7);
}

function suma(pagos: PagoAdmin[], moneda: "USD" | "VES"): number {
  return pagos
    .filter((pago) => pago.vigente && pago.moneda === moneda)
    .reduce((total, pago) => total + pago.monto, 0);
}

export function metricasDe(panel: PanelAdmin, pendientes: Pendiente[] = colaDe(panel)): Metricas {
  const etapas = etapaPorProyecto(panel);
  const porEtapa = Object.fromEntries(ETAPAS.map((etapa) => [etapa.clave, 0])) as Record<Etapa, number>;
  for (const etapa of etapas.values()) porEtapa[etapa] += 1;

  const periodo = periodoActual(panel.hoy);
  const cobrados = panel.pagos.filter((pago) => pago.vigente && pago.periodo === periodo);
  const porCobrar = panel.suscripciones.filter(porVencer);

  return {
    clientes: panel.clientes.length,
    clientesSinVerificar: panel.clientes.filter((c) => !c.verificado).length,
    proyectos: panel.proyectos.length,
    porEtapa,
    pendientes: pendientes.length,
    cobradoMesUsd: Math.round(suma(cobrados, "USD") * 100) / 100,
    cobradoMesVes: Math.round(suma(cobrados, "VES") * 100) / 100,
    porCobrarUsd: Math.round(porCobrar.reduce((t, s) => t + s.monto_usd, 0) * 100) / 100,
    porCobrarEn7: porCobrar.length,
    enMora: panel.suscripciones.filter((s) => s.estado_calculado === "mora").length,
    suspendidas: panel.suscripciones.filter((s) => s.estado_calculado === "suspendida").length,
    pagosAnulados: panel.pagos.filter((pago) => pago.anulado).length,
    documentosAjustados: panel.documentos.filter((d) => d.ajuste).length,
    expedientesEntregados: panel.proyectos.filter((p) => p.envios > 0).length,
  };
}

/** Qué hacer hoy, en orden. Cada regla se puede probar por separado. */
export function colaDe(panel: PanelAdmin): Pendiente[] {
  const salida: Pendiente[] = [];
  const suscripciones = new Map(panel.suscripciones.map((s) => [s.proyecto_id, s]));
  const clientes = new Map(panel.clientes.map((c) => [c.id, c]));
  const ajustesPorProyecto = new Map<string, number>();
  const envioPorProyecto = new Map(
    panel.proyectos.map((proyecto) => [proyecto.id, proyecto.ultimo_envio]),
  );
  for (const documento of panel.documentos) {
    const utc = documento.ajuste?.utc;
    if (!utc) continue;
    // El ajuste ya salió en el último correo si es anterior: si no, el
    // aviso de reenvío no se cierra nunca y la cola queda mentirosa.
    const enviado = envioPorProyecto.get(documento.proyecto_id);
    if (enviado && Date.parse(utc) <= Date.parse(enviado)) continue;
    ajustesPorProyecto.set(
      documento.proyecto_id,
      (ajustesPorProyecto.get(documento.proyecto_id) ?? 0) + 1,
    );
  }

  if (!panel.representante) {
    salida.push({
      id: "representante",
      prioridad: 0,
      etiqueta: "Falta la firma del representante legal",
      detalle: "Sin ella no se puede generar ningún expediente.",
      accion: "representante",
    });
  }

  for (const proyecto of panel.proyectos) {
    const cliente = clientes.get(proyecto.cliente_id);
    const suscripcion = suscripciones.get(proyecto.id) ?? null;
    const etapa = etapaDe(proyecto, suscripcion);
    const aQuien = cliente?.razon_social || cliente?.nombre || proyecto.nombre;
    // Desde que hay expediente ya hay algo que cobrar: el hueco se avisa
    // en cualquier etapa posterior, no solo mientras el cliente revisa.
    const conExpediente =
      etapa === "en_revision" || etapa === "aprobado" || etapa === "entregado";
    if (conExpediente && !suscripcion) {
      salida.push({
        id: `suscripcion-${proyecto.id}`,
        prioridad: 2,
        etiqueta: `Abrir la suscripción de ${proyecto.nombre}`,
        detalle: "El proyecto ya tiene expediente y no tiene cobro asociado.",
        accion: "suscripcion",
        proyectoId: proyecto.id,
      });
    }

    if (etapa === "ficha") {
      salida.push({
        id: `generar-${proyecto.id}`,
        prioridad: 1,
        etiqueta: `Generar el expediente de ${proyecto.nombre}`,
        detalle: `${aQuien} envió la ficha y todavía no hay documentos.`,
        accion: "generar",
        proyectoId: proyecto.id,
      });
      continue;
    }

    if (etapa === "en_revision") {
      if (proyecto.actos_representante < proyecto.documentos) {
        salida.push({
          id: `verificar-${proyecto.id}`,
          prioridad: 1,
          etiqueta: `Faltan firmas del representante en ${proyecto.nombre}`,
          detalle: `${proyecto.actos_representante} de ${proyecto.documentos} documentos. Verifica la cadena antes de seguir.`,
          accion: "verificar",
          proyectoId: proyecto.id,
        });
      } else {
        const espera = diasDesde(proyecto.enviado ?? proyecto.creado, panel.hoy);
        if (espera !== null && espera >= DIAS_AVISO) {
          salida.push({
            id: `espera-${proyecto.id}`,
            prioridad: 3,
            etiqueta: `${aQuien} lleva ${espera} días sin confirmar`,
            detalle: "El expediente está listo desde tu lado; conviene un recordatorio por teléfono.",
            accion: null,
            proyectoId: proyecto.id,
            clienteId: proyecto.cliente_id,
          });
        }
      }
      continue;
    }

    if (etapa === "aprobado") {
      salida.push({
        id: `enviar-${proyecto.id}`,
        prioridad: 1,
        etiqueta: `Enviar el expediente de ${proyecto.nombre}`,
        detalle: "El cliente ya confirmó: el correo con los PDF sigue pendiente.",
        accion: "enviar",
        proyectoId: proyecto.id,
      });
      continue;
    }

    const ajustes = ajustesPorProyecto.get(proyecto.id) ?? 0;
    if (etapa === "entregado" && ajustes > 0) {
      salida.push({
        id: `reenviar-${proyecto.id}`,
        prioridad: 2,
        etiqueta: `Reenviar ${proyecto.nombre} con el ajuste a mano`,
        detalle: `${ajustes} documento(s) ajustado(s) después del último envío. Reenviar es gratis: lo que no cambió no vuelve a salir.`,
        accion: "reenviar",
        proyectoId: proyecto.id,
      });
    }
  }

  for (const suscripcion of panel.suscripciones) {
    const proyecto = panel.proyectos.find((p) => p.id === suscripcion.proyecto_id);
    const nombre = proyecto?.nombre ?? "el proyecto";
    if (suscripcion.estado_calculado === "suspendida") {
      salida.push({
        id: `cobro-${suscripcion.id}`,
        prioridad: 1,
        etiqueta: `Levantar la suspensión de ${nombre}`,
        detalle: `Licencia suspendida: el expediente no se puede enviar hasta registrar el pago.`,
        accion: "cobro",
        proyectoId: suscripcion.proyecto_id,
        suscripcionId: suscripcion.id,
      });
    } else if (suscripcion.estado_calculado === "mora") {
      salida.push({
        id: `cobro-${suscripcion.id}`,
        prioridad: 2,
        etiqueta: `Cobrar el período vencido de ${nombre}`,
        detalle: `${Math.abs(suscripcion.dias_para_vencer)} días después del vencimiento, con ${suscripcion.dias_gracia} de gracia.`,
        accion: "cobro",
        proyectoId: suscripcion.proyecto_id,
        suscripcionId: suscripcion.id,
      });
    }
  }

  for (const cliente of panel.clientes) {
    if (cliente.verificado) continue;
    salida.push({
      id: `verificacion-${cliente.id}`,
      prioridad: 2,
      etiqueta: `Confirmar el correo de ${cliente.razon_social ?? cliente.nombre}`,
      detalle: `${cliente.correo} sigue sin verificar; el enlace lo pide el propio cliente desde su «Cuenta».`,
      accion: "verificacion",
      clienteId: cliente.id,
    });
  }

  return salida.sort((a, b) => a.prioridad - b.prioridad || a.etiqueta.localeCompare(b.etiqueta, "es"));
}

/** Días transcurridos desde una fecha ISO hasta `hoy`; `null` si falta la fecha. */
function diasDesde(desde: string | null, hoy: string): number | null {
  if (!desde) return null;
  const a = Date.parse(`${desde.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${hoy.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / 86_400_000);
}

/** Texto de búsqueda: una sola línea con todo lo que identifica el asunto. */
export function textoDeBusqueda(
  cliente?: ClienteAdmin | null,
  proyecto?: ProyectoAdmin | null,
): string {
  return [
    cliente?.razon_social,
    cliente?.nombre,
    cliente?.correo,
    cliente?.documento_numero,
    cliente?.telefono,
    proyecto?.nombre,
    proyecto?.dominio,
    proyecto?.plan_clave,
    proyecto?.plan_nivel,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}
