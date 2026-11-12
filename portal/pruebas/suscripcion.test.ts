/* ============================================================
   Estado de la suscripción
   ------------------------------------------------------------
   Sin base de datos. Comprueba las fechas en UTC, los cortes de
   mora y suspensión, los vencimientos que cubren un periodo y la
   validación del periodo `AAAA-MM`, que es la clave del pago
   único por mes.
   ============================================================ */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  diasEntre,
  estadoPorFecha,
  fechaISO,
  fechaTexto,
  hoyUTC,
  licenciaPara,
  numero,
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
