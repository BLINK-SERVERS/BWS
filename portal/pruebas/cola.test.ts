/* ============================================================
   Etapa, cola y métricas del panel de administración
   ------------------------------------------------------------
   Sin base de datos. Aquí se decide «qué hay que hacer hoy», así
   que lo que se comprueba es el criterio: la etapa sale de los
   actos y los envíos (no del `estado` guardado, que puede quedar
   atrás), cada regla de la cola aparece sola, y los montos del
   mes no mezclan dólares con bolívares.
   ============================================================ */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  colaDe,
  DIAS_AVISO,
  etapaDe,
  metricasDe,
  porVencer,
  textoDeBusqueda,
  type Etapa,
} from "../src/datos/cola.ts";
import type {
  ClienteAdmin,
  DocumentoAdmin,
  PanelAdmin,
  PagoAdmin,
  ProyectoAdmin,
  SuscripcionAdmin,
} from "../src/datos/api.ts";

function proyecto(extra: Partial<ProyectoAdmin> = {}): ProyectoAdmin {
  return {
    id: "p1",
    cliente_id: "c1",
    nombre: "Estudio Ana",
    estado: "en_revision",
    dominio: "estudio-ana.com.ve",
    plan_clave: "supabase",
    plan_nivel: "inicial",
    documentos: 8,
    actos_representante: 8,
    actos_cliente: 0,
    envios: 0,
    ultimo_envio: null,
    creado: "2026-11-01T10:00:00.000Z",
    enviado: "2026-11-01T10:00:00.000Z",
    ...extra,
  };
}

function cliente(extra: Partial<ClienteAdmin> = {}): ClienteAdmin {
  return {
    id: "c1",
    razon_social: "Estudio Ana, C.A.",
    documento_tipo: "RIF",
    documento_numero: "J-12345678",
    domicilio: "Caracas",
    telefono: "+58 414 123 4567",
    correo_factura: "facturas@estudio-ana.com.ve",
    nombre: "Ana Pérez",
    correo: "ana@estudio-ana.com.ve",
    verificado: true,
    bloqueado: false,
    tiene_firma: true,
    firmas: 1,
    ultimo_acceso: "2026-11-11T08:00:00.000Z",
    sesiones_vivas: 1,
    creado: "2026-10-30T10:00:00.000Z",
    ...extra,
  };
}

function suscripcion(extra: Partial<SuscripcionAdmin> = {}): SuscripcionAdmin {
  return {
    id: "s1",
    proyecto_id: "p1",
    estado: "al_dia",
    estado_calculado: "al_dia",
    monto_usd: 25,
    moneda: "USD",
    dia_cobro: 5,
    proximo_vencimiento: "2026-12-05",
    dias_gracia: 5,
    dias_para_vencer: 22,
    licencia: "activa",
    pagos: 1,
    ultimo_periodo: "2026-11",
    creada: "2026-11-02T10:00:00.000Z",
    actualizada: "2026-11-02T10:00:00.000Z",
    ...extra,
  };
}

function pago(extra: Partial<PagoAdmin> = {}): PagoAdmin {
  return {
    id: "g1",
    periodo: "2026-11",
    monto: 25,
    moneda: "USD",
    tasa_bcv: null,
    referencia: "0001",
    fecha: "2026-11-05",
    estado: "registrado",
    suscripcion_id: "s1",
    anulacion_de: null,
    motivo: null,
    anulado: false,
    vigente: true,
    creado: "2026-11-05T10:00:00.000Z",
    ...extra,
  };
}

function documentoAjustado(utc: string, proyectoId = "p1"): DocumentoAdmin {
  return {
    id: `d-${proyectoId}-${utc.slice(0, 19).replace(/\D/g, "")}`,
    proyecto_id: proyectoId,
    codigo: "BWS-CON-004",
    version: 1,
    orden: 4,
    hash_archivo: "b".repeat(64),
    ajuste: {
      sha256_original: "b".repeat(64),
      sha256_ajustado: "c".repeat(64),
      tamano: 200_000,
      nota: "Firma en papel adjuntada",
      utc,
    },
  };
}

function panel(extra: Partial<PanelAdmin> = {}): PanelAdmin {
  return {
    ok: true,
    hoy: "2026-11-12",
    clientes: [cliente()],
    proyectos: [proyecto()],
    documentos: [],
    suscripciones: [suscripcion()],
    pagos: [pago()],
    plantillas: [],
    representante: {
      id: "r1",
      nombre: "Ana Pérez",
      documento: "V-12345678",
      domicilio: "Caracas",
      correo: "ana@blink.com.ve",
      sha256: "a".repeat(64),
      utc: "2026-11-01T09:00:00.000Z",
    },
    ...extra,
  };
}

describe("etapaDe: la etapa sale de la evidencia", () => {
  it("deja el borrador mientras la ficha no se envíe", () => {
    assert.equal(etapaDe(proyecto({ estado: "borrador", documentos: 0 })), "borrador");
  });

  it("llama «ficha recibida» al proyecto enviado sin documentos", () => {
    assert.equal(etapaDe(proyecto({ estado: "enviado", documentos: 0 })), "ficha");
  });

  it("pone en revisión cuando ya hay expediente sin confirmar", () => {
    assert.equal(etapaDe(proyecto({ actos_cliente: 3 })), "en_revision");
  });

  it("distingue aprobado de entregado aunque el estado siga en revisión", () => {
    const confirmado = proyecto({ estado: "en_revision", actos_cliente: 8 });
    assert.equal(etapaDe(confirmado), "aprobado");
    assert.equal(etapaDe({ ...confirmado, envios: 8 }), "entregado");
  });

  it("no cierra como terminado un expediente que nunca se entregó", () => {
    const sinEnviar = proyecto({ actos_cliente: 8 });
    assert.equal(etapaDe(sinEnviar, suscripcion({ estado: "terminada" })), "aprobado");
    assert.equal(
      etapaDe(proyecto({ envios: 8 }), suscripcion({ estado: "terminada" })),
      "terminado",
    );
  });

  it("respeta el estado terminado guardado cuando el correo ya salió", () => {
    const etapa: Etapa = etapaDe(
      proyecto({ estado: "terminado", envios: 8 }),
      suscripcion({ estado: "al_dia" }),
    );
    assert.equal(etapa, "terminado");
  });
});

describe("colaDe: cada regla aparece sola", () => {
  it("pone primero la falta del representante", () => {
    const pendientes = colaDe(panel({ representante: null }));
    assert.equal(pendientes[0]?.id, "representante");
    assert.equal(pendientes[0]?.accion, "representante");
  });

  it("pide generar el expediente de una ficha recién enviada", () => {
    const pendientes = colaDe(
      panel({ proyectos: [proyecto({ estado: "enviado", documentos: 0 })] }),
    );
    assert.ok(pendientes.some((p) => p.id === "generar-p1" && p.accion === "generar"));
  });

  it("no pide generar lo que ya está entregado", () => {
    const pendientes = colaDe(panel({ proyectos: [proyecto({ envios: 8 })] }));
    assert.ok(!pendientes.some((p) => p.accion === "generar"));
  });

  it("avisa del representante incompleto antes que de la espera del cliente", () => {
    const pendientes = colaDe(panel({ proyectos: [proyecto({ actos_representante: 5 })] }));
    assert.ok(pendientes.some((p) => p.id === "verificar-p1"));
    assert.ok(!pendientes.some((p) => p.id.startsWith("espera-")));
  });

  it("marca la espera cuando el cliente tarda más de una semana", () => {
    const pendientes = colaDe(
      panel({ proyectos: [proyecto({ enviado: "2026-11-01T10:00:00.000Z" })] }),
    );
    const espera = pendientes.find((p) => p.id === "espera-p1");
    assert.ok(espera);
    assert.match(espera!.detalle, /teléfono/);
  });

  it("no molesta con la espera si el cliente confirmó hace poco", () => {
    const pendientes = colaDe(panel({ proyectos: [proyecto({ actos_cliente: 8 })] }));
    assert.ok(!pendientes.some((p) => p.id.startsWith("espera-")));
    assert.ok(pendientes.some((p) => p.id === "enviar-p1" && p.accion === "enviar"));
  });

  it("pide abrir la suscripción desde que hay expediente, en cualquier etapa", () => {
    const enRevision = colaDe(panel({ suscripciones: [] }));
    assert.ok(enRevision.some((p) => p.id === "suscripcion-p1"));

    const aprobado = colaDe(panel({ suscripciones: [], proyectos: [proyecto({ actos_cliente: 8 })] }));
    assert.ok(aprobado.some((p) => p.id === "suscripcion-p1"));
    assert.ok(aprobado.some((p) => p.id === "enviar-p1"));

    const entregado = colaDe(panel({ suscripciones: [], proyectos: [proyecto({ envios: 8 })] }));
    assert.ok(entregado.some((p) => p.id === "suscripcion-p1"));
  });

  it("no pide cobro donde todavía no hay expediente, ni donde ya cerró", () => {
    const ficha = colaDe(
      panel({ suscripciones: [], proyectos: [proyecto({ documentos: 0, actos_representante: 0 })] }),
    );
    assert.ok(ficha.some((p) => p.id === "generar-p1"));
    assert.ok(!ficha.some((p) => p.id === "suscripcion-p1"));

    const borrador = colaDe(
      panel({
        suscripciones: [],
        proyectos: [proyecto({ estado: "borrador", documentos: 0, actos_representante: 0 })],
      }),
    );
    assert.ok(!borrador.some((p) => p.id === "suscripcion-p1"));

    const terminado = colaDe(
      panel({ suscripciones: [], proyectos: [proyecto({ estado: "terminado", envios: 8 })] }),
    );
    assert.ok(!terminado.some((p) => p.id === "suscripcion-p1"));
  });

  it("separa la mora de la suspensión y ambas llevan al cobro", () => {
    const mora = colaDe(panel({ suscripciones: [suscripcion({ estado_calculado: "mora", dias_para_vencer: -3 })] }));
    assert.ok(mora.some((p) => p.id === "cobro-s1" && /Cobrar el período/.test(p.etiqueta)));
    const suspendida = colaDe(panel({ suscripciones: [suscripcion({ estado_calculado: "suspendida", estado: "suspendida", dias_para_vencer: -12 })] }));
    assert.ok(suspendida.some((p) => p.id === "cobro-s1" && /Levantar la suspensión/.test(p.etiqueta)));
  });

  it("sugiere reenviar solo cuando hay ajuste y el expediente ya salió", () => {
    const ajustado = proyecto({ envios: 8 });
    const conAjuste = colaDe(
      panel({
        proyectos: [ajustado],
        documentos: [documentoAjustado("2026-11-11T10:00:00.000Z")],
      }),
    );
    assert.ok(conAjuste.some((p) => p.id === "reenviar-p1" && p.accion === "reenviar"));

    const sinAjuste = colaDe(panel({ proyectos: [ajustado] }));
    assert.ok(!sinAjuste.some((p) => p.accion === "reenviar"));
  });

  it("el reenvío se cierra cuando el ajuste ya salió en el último correo", () => {
    const enviado = proyecto({ envios: 8, ultimo_envio: "2026-11-12T09:00:00.000Z" });
    const despues = colaDe(
      panel({ proyectos: [enviado], documentos: [documentoAjustado("2026-11-12T10:00:00.000Z")] }),
    );
    assert.ok(despues.some((p) => p.id === "reenviar-p1"));

    const antes = colaDe(
      panel({ proyectos: [enviado], documentos: [documentoAjustado("2026-11-11T10:00:00.000Z")] }),
    );
    assert.ok(!antes.some((p) => p.id === "reenviar-p1"));

    // Exactamente en el instante del envío ya estaba dentro del correo.
    const justo = colaDe(
      panel({ proyectos: [enviado], documentos: [documentoAjustado("2026-11-12T09:00:00.000Z")] }),
    );
    assert.ok(!justo.some((p) => p.accion === "reenviar"));

    // Cada proyecto se mide contra su propio envío.
    const otro = colaDe(
      panel({
        proyectos: [
          enviado,
          proyecto({ id: "p2", nombre: "Otro", envios: 8, ultimo_envio: "2026-11-12T11:00:00.000Z" }),
        ],
        documentos: [
          documentoAjustado("2026-11-12T10:00:00.000Z", "p1"),
          documentoAjustado("2026-11-12T10:30:00.000Z", "p2"),
        ],
      }),
    );
    assert.ok(otro.some((p) => p.id === "reenviar-p1"));
    assert.ok(!otro.some((p) => p.id === "reenviar-p2"));
  });

  it("deja ver el correo sin verificar del cliente", () => {
    const pendientes = colaDe(panel({ clientes: [cliente({ verificado: false })] }));
    assert.ok(pendientes.some((p) => p.id === "verificacion-c1" && p.accion === "verificacion"));
  });

  it("ordena por prioridad y no deja nada sin etiqueta", () => {
    const pendientes = colaDe(
      panel({
        representante: null,
        proyectos: [
          proyecto({ id: "p2", estado: "enviado", documentos: 0 }),
          proyecto({ id: "p1", actos_cliente: 8 }),
        ],
      }),
    );
    assert.deepEqual(pendientes.map((p) => p.prioridad), pendientes.map((p) => p.prioridad).sort((a, b) => a - b));
    assert.ok(pendientes.every((p) => p.etiqueta.length > 0 && p.detalle.length > 0));
  });
});

describe("porVencer: la ventana de aviso, con sus dos bordes", () => {
  const dentro = [-1, 0, DIAS_AVISO, DIAS_AVISO + 1];

  it("empieza hoy y termina a los siete días", () => {
    assert.deepEqual(
      dentro.map((dias) => porVencer(suscripcion({ dias_para_vencer: dias }))),
      [false, true, true, false],
    );
  });

  it("una terminada ya no se avisa, aunque la fecha siga cerca", () => {
    assert.equal(porVencer(suscripcion({ dias_para_vencer: 2, estado: "terminada" })), false);
  });
});

describe("metricasDe: lo que entra y lo que falta", () => {
  it("cuenta las etapas y los pendientes", () => {
    const metricas = metricasDe(panel({ proyectos: [proyecto(), proyecto({ id: "p2", envios: 8 })] }));
    assert.equal(metricas.proyectos, 2);
    assert.equal(metricas.porEtapa.en_revision, 1);
    assert.equal(metricas.porEtapa.entregado, 1);
    assert.equal(metricas.expedientesEntregados, 1);
    assert.ok(metricas.pendientes >= 1);
  });

  it("suma el cobro del período vigente sin mezclar monedas", () => {
    const metricas = metricasDe(
      panel({
        pagos: [
          pago({ id: "g1", monto: 25, moneda: "USD" }),
          pago({ id: "g2", monto: 900, moneda: "VES" }),
          pago({ id: "g3", monto: 40, moneda: "USD", periodo: "2026-10" }),
          pago({ id: "g4", monto: 40, moneda: "USD", anulado: true, vigente: false, estado: "anulado" }),
        ],
      }),
    );
    assert.equal(metricas.cobradoMesUsd, 25);
    assert.equal(metricas.cobradoMesVes, 900);
    assert.equal(metricas.pagosAnulados, 1);
  });

  it("mide lo que vence en los próximos siete días", () => {
    const metricas = metricasDe(
      panel({ suscripciones: [suscripcion({ dias_para_vencer: 4 }), suscripcion({ id: "s2", dias_para_vencer: 40 })] }),
    );
    assert.equal(metricas.porCobrarEn7, 1);
    assert.equal(metricas.porCobrarUsd, 25);
  });

  it("no cuenta como «por vencer» lo que ya venció ni lo terminado", () => {
    const metricas = metricasDe(
      panel({
        suscripciones: [
          suscripcion({ id: "s1", dias_para_vencer: 0 }),
          suscripcion({ id: "s2", dias_para_vencer: DIAS_AVISO }),
          suscripcion({ id: "s3", dias_para_vencer: -1, estado: "mora", estado_calculado: "mora" }),
          suscripcion({ id: "s4", dias_para_vencer: 3, estado: "terminada", monto_usd: 99 }),
        ],
      }),
    );
    assert.equal(metricas.porCobrarEn7, 2);
    assert.equal(metricas.porCobrarUsd, 50);
  });

  it("separa mora, suspensión y documentos ajustados", () => {
    const metricas = metricasDe(
      panel({
        suscripciones: [suscripcion({ estado_calculado: "mora" }), suscripcion({ id: "s2", estado_calculado: "suspendida" })],
        clientes: [cliente(), cliente({ id: "c2", verificado: false })],
      }),
    );
    assert.equal(metricas.enMora, 1);
    assert.equal(metricas.suspendidas, 1);
    assert.equal(metricas.clientesSinVerificar, 1);
    assert.equal(metricas.documentosAjustados, 0);
  });
});

describe("textoDeBusqueda", () => {
  it("junta cliente y proyecto en una sola línea lista para filtrar", () => {
    const texto = textoDeBusqueda(cliente(), proyecto());
    for (const parte of ["estudio ana", "ana pérez", "j-12345678", "estudio-ana.com.ve", "supabase"]) {
      assert.ok(texto.includes(parte), texto);
    }
    assert.equal(textoDeBusqueda(null, null), "");
  });
});
