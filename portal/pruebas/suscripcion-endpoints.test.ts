/* Pruebas de las ramas HTTP con la frontera de base sustituida. No abren DB. */
import assert from "node:assert/strict";
import { mock, test } from "node:test";

if (typeof mock.module !== "function") {
  test("endpoints de suscripción simulados", { skip: "Requiere --experimental-test-module-mocks" }, () => {});
} else {
type ConsultaSimulada = { sql: string; valores: unknown[] };
const llamadas: ConsultaSimulada[][] = [];
let respuestas: Record<string, unknown>[][][] = [];
const dbSimulada = async (
  _usuario: unknown,
  _rol: unknown,
  construir: (txn: (cadenas: TemplateStringsArray, ...valores: unknown[]) => ConsultaSimulada) => ConsultaSimulada[],
) => {
  llamadas.push(construir((cadenas, ...valores) => ({ sql: cadenas.join("?"), valores })));
  const respuesta = respuestas.shift();
  if (!respuesta) throw new Error("Consulta sin respuesta simulada: no se usa ninguna base.");
  return respuesta;
};
mock.module(new URL("../server/_lib/db.ts", import.meta.url), { namedExports: { enTransaccion: dbSimulada } });
let rolSesion = "admin";
mock.module(new URL("../server/_lib/sesion.ts", import.meta.url), {
  namedExports: {
    leerSesion: async () => ({ usuarioId: "11111111-1111-4111-8111-111111111111", rol: rolSesion }),
    exigirAdmin: (sesion: unknown) => sesion,
  },
});
mock.module(new URL("../server/_lib/csrf.ts", import.meta.url), { namedExports: { exigirOrigen: () => undefined } });
mock.module(new URL("../server/_lib/expediente.ts", import.meta.url), {
  namedExports: { proyectoOpcionalDeExpediente: async () => ({
    fila: { id: "33333333-3333-4333-8333-333333333333" }, vista: { nombre: "Proyecto" },
  }) },
});

const { default: cliente } = await import("../server/cliente/suscripcion.ts");
const { default: crear } = await import("../server/suscripciones/crear.ts");
const { default: pagar } = await import("../server/suscripciones/pago.ts");
const { default: reactivar } = await import("../server/suscripciones/reactivar.ts");
const { default: anular } = await import("../server/suscripciones/anular.ts");
const { default: recalcular } = await import("../server/suscripciones/recalcular.ts");
const id = "22222222-2222-4222-8222-222222222222";
const proyecto = "33333333-3333-4333-8333-333333333333";
const pagoId = "44444444-4444-4444-8444-444444444444";
function peticion(cuerpo: unknown): Request {
  return new Request("https://portal.test/api", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(cuerpo),
  });
}
function preparar(...filas: Record<string, unknown>[][][]) {
  llamadas.length = 0;
  respuestas = filas;
}
const nueva = {
  id, proyecto_id: proyecto, estado: "suspendida", dia_cobro: 5, dias_gracia: 0,
  proximo_vencimiento: "2026-01-05", vencimiento_inicial_mora: "2026-01-05",
  monto_usd: "30.00", regimen_nuevo: true,
};
const datosPago = { suscripcion_id: id, periodo: "2026-03", monto: 30, moneda: "USD", referencia: "ref-123", fecha: "2026-03-06" };

test("el cliente ve deuda desconocida o intereses pendientes sin declararlos saldados", async () => {
  rolSesion = "cliente";
  try {
    preparar([[{ ...nueva, regimen_nuevo: true, inicio_conocido: true, proximo: "2099-01-05",
      vencidas: 0, exigibles: 0, pendientes: 0, irregularidades: 0, principal_usd: "0", intereses_debidos_usd: null,
      intereses_pagados_usd: null, intereses_regularizados: false, licencia: "suspendida" }], []]);
    let respuesta = await cliente(new Request("https://portal.test/api"));
    let cuerpo = await respuesta.json();
    assert.equal(respuesta.status, 200);
    assert.equal(cuerpo.suscripcion.estado_calculado, "mora");
    assert.equal(cuerpo.suscripcion.deuda.saldada, false);
    assert.equal(cuerpo.suscripcion.deuda.intereses_debidos_usd, null);
    assert.equal(cuerpo.suscripcion.bloqueada, true);
    preparar([[{ ...nueva, regimen_nuevo: true, inicio_conocido: false, proximo: null,
      intereses_debidos_usd: null, intereses_pagados_usd: null, licencia: "suspendida" }], []]);
    respuesta = await cliente(new Request("https://portal.test/api"));
    cuerpo = await respuesta.json();
    assert.equal(cuerpo.suscripcion.deuda.saldada, null);
    assert.equal(cuerpo.suscripcion.deuda.mensualidades_pendientes, null);
  } finally {
    rolSesion = "admin";
  }
});

test("crear aplica gracia cero solo al contrato nuevo confirmado", async () => {
  const proyectoFila = { id: proyecto, nombre: "Proyecto", plan_clave: "x", plan_nivel: "y", plan_version: 1,
    precio_usd: "30", suscripcion_id: null, regimen_nuevo: true };
  preparar([[proyectoFila]], [[], [], [], [{ id, proyecto_id: proyecto, estado: "al_dia", monto_usd: "30",
    moneda: "USD", dia_cobro: 5, dias_gracia: 0, proximo_vencimiento: "2026-01-05" }]]);
  const respuesta = await crear(peticion({ proyecto_id: proyecto, dia_cobro: 5, proximo_vencimiento: "2026-01-05" }));
  assert.equal(respuesta.status, 201);
  assert.equal((await respuesta.json()).suscripcion.dias_gracia, 0);
  assert.match(llamadas[1][0].sql, /vencimiento_inicial_mora/);
  assert.match(llamadas[1][0].sql, /bws_contrato_mora_nuevo/);
  preparar([[proyectoFila]]);
  const rechazo = await crear(peticion({ proyecto_id: proyecto, dia_cobro: 5, dias_gracia: 5 }));
  assert.equal(rechazo.status, 400);
  assert.equal((await rechazo.json()).codigo, "gracia");
});

test("crear conserva por defecto cinco días sin contrato nuevo confirmado", async () => {
  preparar([[{ id: proyecto, nombre: "Proyecto", plan_clave: "x", plan_nivel: "y", plan_version: 1,
    precio_usd: "30", suscripcion_id: null, regimen_nuevo: false }]],
    [[], [], [], [{ id, proyecto_id: proyecto, estado: "al_dia", monto_usd: "30", moneda: "USD",
      dia_cobro: 5, dias_gracia: 5, proximo_vencimiento: "2026-01-05" }]]);
  const respuesta = await crear(peticion({ proyecto_id: proyecto, dia_cobro: 5, proximo_vencimiento: "2026-01-05" }));
  assert.equal(respuesta.status, 201);
  assert.equal((await respuesta.json()).suscripcion.dias_gracia, 5);
  assert.ok(llamadas[1][0].valores.includes(5));
});

test("pago nuevo delega el libro al procedimiento y no reabre la licencia", async () => {
  preparar([[nueva]], [
    [{ pago_id: pagoId, anterior: "suspendida", nuevo: "suspendida", proximo: "2026-01-05" }],
    [{ id: pagoId, periodo: "2026-03", monto: "30.00", moneda: "USD", tasa_bcv: null, referencia: "ref-123", fecha: "2026-03-06", estado: "registrado" }],
  ]);
  const respuesta = await pagar(peticion(datosPago));
  assert.equal(respuesta.status, 201);
  const cuerpo = await respuesta.json();
  assert.equal(cuerpo.suscripcion.proximo_vencimiento, "2026-01-05");
  assert.equal(cuerpo.suscripcion.estado, "suspendida");
  assert.equal(cuerpo.reactivacion_automatica, false);
  assert.match(llamadas[1][0].sql, /bws_pago_mora/);
  assert.equal(respuestas.length, 0);
});

test("pago nuevo en VES admite tasa BCV numérica y verifica la cuota", async () => {
  preparar([[nueva]], [
    [{ pago_id: pagoId, anterior: "suspendida", nuevo: "suspendida", proximo: "2026-01-05" }],
    [{ id: pagoId, periodo: "2026-03", monto: "3000.00", moneda: "VES", tasa_bcv: "100.0000",
      referencia: "ref-123", fecha: "2026-03-06", estado: "registrado" }],
  ]);
  const respuesta = await pagar(peticion({ ...datosPago, monto: 3000, moneda: "VES", tasa_bcv: 100 }));
  assert.equal(respuesta.status, 201);
  assert.equal((await respuesta.json()).pago.tasa_bcv, 100);
  assert.ok(llamadas[1][0].valores.includes("100.0000"));
});

test("pago nuevo exige inicio conocido y mensualidad íntegra", async () => {
  preparar([[{ ...nueva, vencimiento_inicial_mora: null }]]);
  let respuesta = await pagar(peticion(datosPago));
  assert.equal(respuesta.status, 409);
  assert.equal((await respuesta.json()).codigo, "inicio_mora");
  assert.equal(llamadas.length, 1);
  preparar([[nueva]]);
  respuesta = await pagar(peticion({ ...datosPago, monto: 29.99 }));
  assert.equal(respuesta.status, 400);
  assert.equal((await respuesta.json()).codigo, "monto_insuficiente");
  assert.equal(llamadas.length, 1);
});

test("el pago legacy mantiene su cálculo histórico y reactivación previa", async () => {
  preparar([[{ ...nueva, regimen_nuevo: false, dias_gracia: 5, proximo_vencimiento: "2099-01-05" }]],
    [[], [{ id: pagoId, periodo: "2099-02", monto: "30", moneda: "USD", tasa_bcv: null,
      referencia: "ref-123", fecha: "2026-03-06", estado: "registrado" }], [], [], [],
      [{ estado: "al_dia", proximo_vencimiento: "2099-03-05", dias_gracia: 5 }]]);
  const respuesta = await pagar(peticion({ ...datosPago, periodo: "2099-02" }));
  assert.equal(respuesta.status, 201);
  assert.equal((await respuesta.json()).suscripcion.estado, "al_dia");
  assert.match(llamadas[1][3].sql, /update licencias/i);
  assert.ok(llamadas[1][3].valores.includes(true));
});

test("reactivación nueva exige una liquidación explícita aun si estaba suspendida", async () => {
  preparar([[nueva]]);
  const respuesta = await reactivar(peticion({ suscripcion_id: id, motivo: "Revisión documental" }));
  assert.equal(respuesta.status, 400);
  assert.equal((await respuesta.json()).codigo, "intereses");
  assert.equal(llamadas.length, 1);
});

test("la revisión parcial se conserva pero no activa con deuda", async () => {
  preparar([[nueva]], [[{
    inicio_registrado: false, reactivada: false, estado_actual: "suspendida", proximo: "2026-01-05",
    pendientes: 2, irregularidades: 0, principal_usd: "60.00", intereses_debidos_usd: "5.00", intereses_pagados_usd: "2.00",
  }]]);
  const respuesta = await reactivar(peticion({ suscripcion_id: id, fundamento_intereses: "Acuerdo escrito y comprobante",
    intereses_debidos_usd: 5, intereses_pagados_usd: 2 }));
  assert.equal(respuesta.status, 200);
  const cuerpo = await respuesta.json();
  assert.equal(cuerpo.cambiado, false);
  assert.equal(cuerpo.mensualidades_pendientes, 2);
  assert.equal(cuerpo.intereses_pagados_usd, 2);
  assert.match(llamadas[1][0].sql, /bws_regularizar_mora/);
});

test("la regularización explícita devuelve la reactivación autorizada por el libro", async () => {
  preparar([[nueva]], [[{
    inicio_registrado: false, reactivada: true, estado_actual: "al_dia", proximo: "2027-01-05",
    pendientes: 0, irregularidades: 0, principal_usd: "0.00", intereses_debidos_usd: "5.00", intereses_pagados_usd: "5.00",
  }]]);
  const respuesta = await reactivar(peticion({ suscripcion_id: id, fundamento_intereses: "Acuerdo y comprobante de intereses",
    intereses_debidos_usd: 5, intereses_pagados_usd: 5 }));
  assert.equal(respuesta.status, 200);
  const cuerpo = await respuesta.json();
  assert.equal(cuerpo.cambiado, true);
  assert.equal(cuerpo.estado, "al_dia");
  assert.equal(cuerpo.intereses_debidos_usd, cuerpo.intereses_pagados_usd);
});

test("una suscripción anterior requiere registrar por separado su primer vencimiento", async () => {
  preparar([[{ ...nueva, vencimiento_inicial_mora: null }]], [[{
    inicio_registrado: true, reactivada: false, estado_actual: "suspendida", proximo: "2026-01-05",
    pendientes: 2, irregularidades: 0, principal_usd: "60.00", intereses_debidos_usd: null, intereses_pagados_usd: null,
  }]]);
  const respuesta = await reactivar(peticion({ suscripcion_id: id, vencimiento_inicial: "2026-01-05", motivo: "Contrato y facturas" }));
  const cuerpo = await respuesta.json();
  assert.equal(respuesta.status, 200);
  assert.equal(cuerpo.inicio_registrado, true);
  assert.equal(cuerpo.cambiado, false);
  assert.equal(cuerpo.intereses_debidos_usd, null);
});

test("anulación nueva usa el recálculo contiguo y no el máximo pagado legacy", async () => {
  preparar([[{ id: pagoId, suscripcion_id: id, proyecto_id: proyecto, periodo: "2026-02", estado: "registrado",
    anulado: false, suscripcion_estado: "suspendida", regimen_nuevo: true, vencimiento_inicial_mora: "2026-01-05" }]],
    [[{ suscripcion_id: id, anterior: "suspendida", nuevo: "suspendida", proximo: "2026-02-05" }]]);
  const respuesta = await anular(peticion({ pago_id: pagoId, motivo: "Pago duplicado" }));
  assert.equal(respuesta.status, 200);
  assert.equal((await respuesta.json()).suscripcion.proximo_vencimiento, "2026-02-05");
  assert.match(llamadas[1][0].sql, /bws_anular_pago_mora/);
});

test("recálculo consulta el régimen confirmado antes de los plazos históricos", async () => {
  preparar([[], []]);
  const respuesta = await recalcular(peticion({ suscripcion_id: id }));
  assert.equal(respuesta.status, 200);
  assert.match(llamadas[0][0].sql, /for update/i);
  const sql = llamadas[0][1].sql;
  assert.ok(sql.indexOf("bws_contrato_mora_nuevo") < sql.indexOf("dias_gracia"));
  assert.match(sql, /bws_contrato_mora_nuevo\(s\.proyecto_id\) then 'mora'/);
});
}
