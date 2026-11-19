/* ============================================================
   Estado de la suscripción
   ------------------------------------------------------------
   Sin base de datos. Comprueba las fechas en UTC, los cortes de
   mora y suspensión, los vencimientos que cubren un periodo y la
   validación del periodo `AAAA-MM`, que es la clave del pago
   único por mes.
   ============================================================ */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  diasEntre,
  estadoPorFecha,
  fechaISO,
  fechaTexto,
  hoyUTC,
  interesesValidos,
  licenciaPara,
  numero,
  pagoCubreMensualidad,
  periodoValido,
  siguienteVencimiento,
  sumarDias,
  vencimientoDelPeriodo,
  vencimientoTrasPeriodo,
} from "../server/_lib/suscripcion.ts";

describe("fechas en UTC", () => {
  it("hoyUTC no depende de la hora del día", () => {
    assert.equal(hoyUTC(new Date("2026-11-11T00:00:00.000Z")), "2026-11-11");
    assert.equal(hoyUTC(new Date("2026-11-11T23:59:59.999Z")), "2026-11-11");
  });

  it("fechaTexto normaliza Date y texto a AAAA-MM-DD", () => {
    assert.equal(fechaTexto(new Date("2026-11-05T04:00:00.000Z")), "2026-11-05");
    assert.equal(fechaTexto("2026-11-05"), "2026-11-05");
    assert.equal(fechaTexto("2026-11-05T04:00:00.000Z"), "2026-11-05");
  });

  it("fechaISO acepta solo fechas reales con el formato exacto", () => {
    assert.equal(fechaISO("2024-02-29"), "2024-02-29");
    assert.equal(fechaISO("2026-02-29"), null);
    assert.equal(fechaISO("2026-02-30"), null);
    assert.equal(fechaISO("2026-2-3"), null);
    assert.equal(fechaISO("05/11/2026"), null);
    assert.equal(fechaISO(20261105), null);
  });

  it("sumarDias cruza meses, años y bisiestos", () => {
    assert.equal(sumarDias("2026-02-28", 1), "2026-03-01");
    assert.equal(sumarDias("2024-02-28", 1), "2024-02-29");
    assert.equal(sumarDias("2026-12-31", 1), "2027-01-01");
    assert.equal(sumarDias("2026-01-01", -1), "2025-12-31");
  });

  it("diasEntre es entero, negativo hacia el pasado", () => {
    assert.equal(diasEntre("2026-01-31", "2026-02-01"), 1);
    assert.equal(diasEntre("2026-11-11", "2026-11-11"), 0);
    assert.equal(diasEntre("2026-11-11", "2026-11-01"), -10);
  });
});

describe("corte de mora, suspensión y terminación", () => {
  it("el mismo día del vencimiento sigue al día", () => {
    assert.equal(estadoPorFecha("2026-11-05", 5, "2026-11-05"), "al_dia");
    assert.equal(estadoPorFecha("2026-11-05", 5, "2026-11-04"), "al_dia");
  });

  it("pasa a mora al día siguiente y durante toda la gracia", () => {
    assert.equal(estadoPorFecha("2026-11-05", 5, "2026-11-06"), "mora");
    assert.equal(estadoPorFecha("2026-11-05", 5, "2026-11-10"), "mora");
  });

  it("sigue en mora los diez días que concede el contrato", () => {
    assert.equal(estadoPorFecha("2026-11-05", 5, "2026-11-11"), "mora");
    assert.equal(estadoPorFecha("2026-11-05", 5, "2026-11-20"), "mora");
  });

  it("suspende a los diez días de mora", () => {
    assert.equal(estadoPorFecha("2026-11-05", 5, "2026-11-21"), "suspendida");
    assert.equal(estadoPorFecha("2026-11-05", 5, "2026-12-10"), "suspendida");
  });

  it("termina a los treinta días de mora", () => {
    assert.equal(estadoPorFecha("2026-11-05", 5, "2026-12-11"), "terminada");
    assert.equal(estadoPorFecha("2026-11-05", 5, "2027-01-15"), "terminada");
  });

  it("sin gracia, la mora corre desde el día siguiente", () => {
    assert.equal(estadoPorFecha("2026-11-05", 0, "2026-11-06"), "mora");
    assert.equal(estadoPorFecha("2026-11-05", 0, "2026-11-16"), "suspendida");
    assert.equal(estadoPorFecha("2026-11-05", 0, "2026-12-06"), "terminada");
  });

  it("una gracia larga también corre antes de la mora", () => {
    assert.equal(estadoPorFecha("2026-03-01", 30, "2026-04-01"), "mora");
  });

  it("el contrato nuevo entra en mora al día siguiente sin suspensión ni terminación automáticas", () => {
    assert.equal(estadoPorFecha("2026-11-05", 5, "2026-11-05", "nuevo"), "al_dia");
    assert.equal(estadoPorFecha("2026-11-05", 5, "2026-11-06", "nuevo"), "mora");
    assert.equal(estadoPorFecha("2026-11-05", 5, "2026-11-16", "nuevo"), "mora");
    assert.equal(estadoPorFecha("2026-11-05", 5, "2026-12-06", "nuevo"), "mora");
    assert.equal(estadoPorFecha("2026-11-05", 5, "2030-12-06", "nuevo"), "mora");
  });
});

describe("próximo vencimiento", () => {
  it("usa el día de cobro del mes en curso si todavía no pasó", () => {
    assert.equal(siguienteVencimiento(5, "2026-11-01"), "2026-11-05");
    assert.equal(siguienteVencimiento(5, "2026-11-05"), "2026-11-05");
  });

  it("salta al mes siguiente cuando el día ya pasó", () => {
    assert.equal(siguienteVencimiento(5, "2026-11-06"), "2026-12-05");
    assert.equal(siguienteVencimiento(5, "2026-12-31"), "2027-01-05");
  });

  it("ajusta el día al último del mes", () => {
    assert.equal(siguienteVencimiento(31, "2026-04-01"), "2026-04-30");
    assert.equal(siguienteVencimiento(31, "2026-02-10"), "2026-02-28");
    assert.equal(siguienteVencimiento(31, "2024-02-10"), "2024-02-29");
  });
});

describe("periodo pagado", () => {
  it("el vencimiento cubre el mes siguiente", () => {
    assert.equal(vencimientoTrasPeriodo("2026-11", 5), "2026-12-05");
    assert.equal(vencimientoTrasPeriodo("2026-12", 5), "2027-01-05");
    assert.equal(vencimientoTrasPeriodo("2026-01", 31), "2026-02-28");
  });

  it("el vencimiento que satisfizo el periodo es el de su propio mes", () => {
    assert.equal(vencimientoDelPeriodo("2026-11", 5), "2026-11-05");
    assert.equal(vencimientoDelPeriodo("2026-01", 5), "2026-01-05");
    assert.equal(vencimientoDelPeriodo("2026-03", 31), "2026-03-31");
  });

  it("solo acepta AAAA-MM entre 2020 y 2100", () => {
    assert.equal(periodoValido("2020-01"), true);
    assert.equal(periodoValido("2100-12"), true);
    assert.equal(periodoValido("2026-11"), true);
    assert.equal(periodoValido("2019-12"), false);
    assert.equal(periodoValido("2101-01"), false);
    assert.equal(periodoValido("2026-00"), false);
    assert.equal(periodoValido("2026-13"), false);
    assert.equal(periodoValido("2026-1"), false);
    assert.equal(periodoValido(202611), false);
    assert.equal(periodoValido(null), false);
  });
});

describe("montos y licencia", () => {
  it("requiere mensualidad completa, usando la tasa BCV guardada y no para intereses", () => {
    assert.equal(pagoCubreMensualidad(29.99, "USD", null, 30), false);
    assert.equal(pagoCubreMensualidad(30, "USD", null, 30), true);
    assert.equal(pagoCubreMensualidad(3000, "VES", 100, 30), true);
    assert.equal(pagoCubreMensualidad(2999.99, "VES", 100, 30), false);
    assert.equal(pagoCubreMensualidad(0.3, "VES", 0.1, 3), true);
    assert.equal(pagoCubreMensualidad(30, "VES", null, 30), false);
    assert.equal(pagoCubreMensualidad(30, "VES", 0.00001, 30), false);
  });

  it("exige importes de intereses explícitos, sin inferir ceros", () => {
    assert.equal(interesesValidos(null, 0), false);
    assert.equal(interesesValidos(0, null), false);
    assert.equal(interesesValidos(0, 0), true);
    assert.equal(interesesValidos(5.25, 2), true);
    assert.equal(interesesValidos(-1, 0), false);
    assert.equal(interesesValidos(1.001, 0), false);
    assert.equal(interesesValidos(Infinity, 0), false);
  });

  it("numero acepta punto o coma decimal y rechaza el resto", () => {
    assert.equal(numero(30), 30);
    assert.equal(numero(" 30 "), 30);
    assert.equal(numero("30,5"), 30.5);
    assert.equal(numero("30.50"), 30.5);
    assert.equal(numero("-5"), -5);
    assert.equal(numero("treinta"), null);
    assert.equal(numero(Number.POSITIVE_INFINITY), null);
    assert.equal(numero(null), null);
  });

  it("la licencia solo se suspende con la suscripción suspendida o terminada", () => {
    assert.equal(licenciaPara("al_dia"), "activa");
    assert.equal(licenciaPara("mora"), "activa");
    assert.equal(licenciaPara("suspendida"), "suspendida");
    assert.equal(licenciaPara("terminada"), "suspendida");
  });
});

describe("estructura de la migración local, sin ejecutar SQL", () => {
  const sql = readFileSync(new URL("../db/migrations/0018_mora_contratos_nuevos.sql", import.meta.url), "utf8");

  it("identifica ambos actos del mismo sello y excluye el contrato histórico y el anulado", () => {
    assert.match(sql, /plantilla_codigo like 'BWS-CON-%'/);
    assert.match(sql, /plantilla_codigo <> 'BWS-CON-004'/);
    assert.match(sql, /d\.estado in \('firmado', 'enviado'\)/);
    assert.match(sql, /a\.firmante = 'cliente' and a\.sello = d\.sello/);
    assert.match(sql, /a\.firmante = 'representante' and a\.sello = d\.sello/);
  });

  it("mantiene el primer periodo sin cubrir y cuenta meses omitidos y anulaciones", () => {
    assert.match(sql, /generate_series\(/);
    assert.match(sql, /select min\(vence\) as proximo/);
    assert.match(sql, /vence <= p_hoy or periodo < ultimo_periodo/);
    assert.match(sql, /not exists \(select 1 from pagos a where a\.anulacion_de = p\.id\)/);
    assert.match(sql, /where id = p_id for update/);
  });

  it("exige revisión vigente de intereses y no abre con saldo o irregularidades", () => {
    assert.match(sql, /rev\.firma_pagos = t\.firma/);
    assert.match(sql, /rev\.intereses_pagados_usd >= rev\.intereses_debidos_usd/);
    assert.match(sql, /d\.pendientes = 0 and d\.irregularidades = 0 and p_pagados >= p_debidos/);
    assert.match(sql, /fundamento, actor/);
    const pago = sql.slice(sql.indexOf("create or replace function bws_pago_mora"), sql.indexOf("create or replace function bws_anular_pago_mora"));
    assert.doesNotMatch(pago, /update licencias/i);
  });
});
