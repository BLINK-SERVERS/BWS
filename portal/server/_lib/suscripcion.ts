/* ============================================================
   Estado de la suscripción
   ------------------------------------------------------------
   Las fechas se manejan en UTC y como `YYYY-MM-DD`: la base usa
   `date`, no `timestamptz`, y el corte de mora no debe depender de
   la zona horaria del servidor.

   Los plazos siguientes son exclusivos del régimen histórico
   (BWS-CON-004 y BWS-LEG-003):

   · `al_dia`: hoy no pasó el vencimiento.
   · `mora`: pasó el vencimiento y corre la gracia, más diez días.
   · `suspendida`: diez días de mora; el servicio y la licencia se
     suspenden, pero los datos y el dominio siguen siendo del
     cliente.
   · `terminada`: treinta días de mora; cierre definitivo.
   ============================================================ */

export type EstadoSuscripcion = "al_dia" | "mora" | "suspendida" | "terminada";
export type RegimenMora = "legacy" | "nuevo";

/** Días de mora que el contrato concede antes de suspender. */
export const DIAS_MORA_SUSPENSION = 10;

/** Días de mora que el contrato concede antes de terminar la licencia. */
export const DIAS_MORA_TERMINACION = 30;

const DIA = 86_400_000;

function desdeUTC(fecha: string): Date {
  return new Date(`${fecha}T00:00:00.000Z`);
}

function aISO(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

export function hoyUTC(ahora = new Date()): string {
  return aISO(ahora);
}

/** El driver devuelve `date` como Date; se normaliza a `YYYY-MM-DD`. */
export function fechaTexto(valor: unknown): string {
  return valor instanceof Date
    ? valor.toISOString().slice(0, 10)
    : String(valor).slice(0, 10);
}

/** Acepta número o texto con coma o punto decimal; `null` si no es un monto. */
export function numero(valor: unknown): number | null {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  if (typeof valor !== "string") return null;
  const limpio = valor.replace(/\s/g, "").replace(",", ".");
  if (!/^-?\d+(?:\.\d+)?$/.test(limpio)) return null;
  return Number(limpio);
}

/** Montos declarados explícitamente en USD, sin inferir una tasa. */
export function interesesValidos(debidos: number | null, pagados: number | null): boolean {
  return debidos !== null && pagados !== null && [debidos, pagados].every((monto) =>
    Number.isFinite(monto) && monto >= 0 && monto <= 100_000_000 &&
    Math.abs(monto * 100 - Math.round(monto * 100)) < 1e-6);
}

/** La cuota no incluye intereses; una mensualidad parcial no cubre el periodo. */
export function pagoCubreMensualidad(monto: number, moneda: string, tasa: number | null, cuota: number): boolean {
  if (!Number.isFinite(monto) || !Number.isFinite(cuota) || monto < 0 || cuota < 0 ||
      monto > 100_000_000 || cuota > 100_000_000) return false;
  const centimos = BigInt(Math.round(Number(monto.toFixed(2)) * 100));
  const cuotaCentimos = BigInt(Math.round(cuota * 100));
  if (moneda === "USD") return centimos >= cuotaCentimos;
  if (moneda !== "VES" || tasa === null || !Number.isFinite(tasa) || tasa <= 0 || tasa > 1_000_000) return false;
  const tasaGuardada = BigInt(Math.round(Number(tasa.toFixed(4)) * 10_000));
  return tasaGuardada > 0n && centimos * 10_000n >= cuotaCentimos * tasaGuardada;
}

export function fechaISO(valor: unknown): string | null {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  const fecha = desdeUTC(valor);
  return Number.isNaN(fecha.getTime()) || aISO(fecha) !== valor ? null : valor;
}

export function sumarDias(fecha: string, dias: number): string {
  return aISO(new Date(desdeUTC(fecha).getTime() + dias * DIA));
}

/** Días enteros de `desde` a `hasta`; negativo si `hasta` ya pasó. */
export function diasEntre(desde: string, hasta: string): number {
  return Math.round((desdeUTC(hasta).getTime() - desdeUTC(desde).getTime()) / DIA);
}

export function estadoPorFecha(
  vencimiento: string,
  diasGracia: number,
  hoy = hoyUTC(),
  regimen: RegimenMora = "legacy",
): EstadoSuscripcion {
  if (hoy <= vencimiento) return "al_dia";
  if (regimen === "nuevo") return "mora";
  const finGracia = sumarDias(vencimiento, diasGracia);
  if (hoy <= sumarDias(finGracia, DIAS_MORA_SUSPENSION)) return "mora";
  if (hoy <= sumarDias(finGracia, DIAS_MORA_TERMINACION)) return "suspendida";
  return "terminada";
}

/** Día del mes ajustado al último día disponible (por si el plan cambia). */
function diaDelMes(anio: number, mes: number, dia: number): string {
  const ultimo = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
  return aISO(new Date(Date.UTC(anio, mes, Math.min(dia, ultimo))));
}

/** Próximo `dia_cobro` en la fecha indicada o después. */
export function siguienteVencimiento(diaCobro: number, desde = hoyUTC()): string {
  const base = desdeUTC(desde);
  const anio = base.getUTCFullYear();
  const mes = base.getUTCMonth();
  const delMes = diaDelMes(anio, mes, diaCobro);
  if (delMes >= desde) return delMes;
  return diaDelMes(anio, mes + 1, diaCobro);
}

/** Vencimiento que cubre el periodo pagado: el mismo día del mes siguiente. */
export function vencimientoTrasPeriodo(periodo: string, diaCobro: number): string {
  // `mes` es 1-based; como índice 0-based apunta al mes siguiente.
  const [anio, mes] = periodo.split("-").map(Number);
  return diaDelMes(anio, mes, diaCobro);
}

/** Vencimiento que satisfizo ese periodo: su propio mes, el día de cobro. */
export function vencimientoDelPeriodo(periodo: string, diaCobro: number): string {
  const [anio, mes] = periodo.split("-").map(Number);
  return diaDelMes(anio, mes - 1, diaCobro);
}

export function periodoValido(periodo: unknown): periodo is string {
  if (typeof periodo !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo)) return false;
  const anio = Number(periodo.slice(0, 4));
  return anio >= 2020 && anio <= 2100;
}

/** La licencia acompaña al estado: solo se suspende con la suscripción. */
export function licenciaPara(estado: EstadoSuscripcion): "activa" | "suspendida" {
  return estado === "suspendida" || estado === "terminada" ? "suspendida" : "activa";
}
