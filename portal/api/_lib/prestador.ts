/* ============================================================
   Identidad del prestador y condiciones del registro
   ------------------------------------------------------------
   Los datos fiscales de Blink no se escriben en el repositorio:
   llegan por variables de entorno. En producción, si falta una,
   el alta se detiene con 503 en vez de imprimir un RIF falso.
   En local y en las pruebas se usan valores de ejemplo, marcados
   como provisionales para que la interfaz lo advierta.

   Las condiciones comerciales que se aceptan al crear la cuenta
   son las fijadas por el dueño. La tasa BCV no se inventa: el
   texto remite a la tasa oficial del día del pago; la cifra exacta
   se fija en el anexo D al contratar el proyecto.
   ============================================================ */

import { fechaLarga } from "../../legal/fechas";
import { ErrorHttp } from "./respuestas";

export interface Prestador {
  razon_social: string;
  rif: string;
  domicilio: string;
  correo: string;
  telefono: string;
  provisional: boolean;
}

function valor(nombre: string, respaldo: string): { valor: string; provisional: boolean } {
  const configurado = process.env[nombre]?.trim();
  if (configurado) return { valor: configurado, provisional: false };
  if (process.env.ENTORNO === "produccion") {
    throw new ErrorHttp(
      503,
      "El alta está en pausa: falta configurar la identidad fiscal de Blink en el servidor.",
      "configuracion",
    );
  }
  return { valor: respaldo, provisional: true };
}

export function identidadPrestador(): Prestador {
  const razon = valor("BWS_RAZON_SOCIAL", "Blink Web Services, C.A.");
  const rif = valor("BWS_RIF", "J-00000000-0");
  const domicilio = valor("BWS_DOMICILIO", "Caracas, Distrito Capital, Venezuela");
  const correo = valor("BWS_CORREO", "business@blink.com.ve");
  const telefono = valor("BWS_TELEFONO", "+1 (631) 821 1938");
  return {
    razon_social: razon.valor,
    rif: rif.valor,
    domicilio: domicilio.valor,
    correo: correo.valor,
    telefono: telefono.valor,
    provisional: razon.provisional || rif.provisional || domicilio.provisional ||
      correo.provisional || telefono.provisional,
  };
}

export function variablesComerciales(): Record<string, string> {
  return {
    tarifa_desarrollo: process.env.TARIFA_DESARROLLO?.trim() || "USD 31",
    tarifa_infra_pro: process.env.TARIFA_INFRA_PRO?.trim() || "USD 30",
    demo_plazo: "siete (7) a catorce (14) días hábiles",
    dominio_costo_eur: "16,04 EUR",
    tasa_bcv_fecha: fechaLarga(),
    tasa_bcv_valor: "la tasa oficial del BCV de esa fecha",
    dominio_costo_bs: "un monto en bolívares calculado a esa tasa",
    licencia_duracion: "la vida del servicio contratado",
    credito_meses: "veinticuatro (24) meses",
    correo_proveedor:
      process.env.CORREO_PROVEEDOR_NOMBRE?.trim() ||
      "el proveedor de correo transaccional contratado por Blink",
  };
}
