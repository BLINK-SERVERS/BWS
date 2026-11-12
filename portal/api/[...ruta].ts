/* ============================================================
   Entrada única de la API
   ------------------------------------------------------------
   El Worker manda aquí todo `/api/*` y este mapa despacha las
   veintiséis rutas a `server/`: una sola entrada, un solo paquete
   y las rutas del cliente intactas (`/api/auth/ingreso`,
   `/api/documentos/generar`…).
   ============================================================ */

import panel from "../server/admin/panel";
import representante from "../server/admin/representante";
import consentimiento from "../server/auth/consentimiento";
import ingreso from "../server/auth/ingreso";
import recuperar from "../server/auth/recuperar";
import registro from "../server/auth/registro";
import restablecer from "../server/auth/restablecer";
import salir from "../server/auth/salir";
import sesion from "../server/auth/sesion";
import verificar from "../server/auth/verificar";
import documentosCliente from "../server/cliente/documentos";
import firmaCliente from "../server/cliente/firma";
import proyecto from "../server/cliente/proyecto";
import enviarProyecto from "../server/cliente/proyecto/enviar";
import suscripcionCliente from "../server/cliente/suscripcion";
import descargarDocumento from "../server/documentos/descargar";
import enviarDocumento from "../server/documentos/enviar";
import firmarDocumento from "../server/documentos/firmar";
import generarDocumento from "../server/documentos/generar";
import verificarDocumento from "../server/documentos/verificar";
import anularSuscripcion from "../server/suscripciones/anular";
import crearSuscripcion from "../server/suscripciones/crear";
import pagoSuscripcion from "../server/suscripciones/pago";
import reactivarSuscripcion from "../server/suscripciones/reactivar";
import recalcularSuscripcion from "../server/suscripciones/recalcular";
import suspenderSuscripcion from "../server/suscripciones/suspender";

type Manejador = (peticion: Request) => Promise<Response>;

export const RUTAS: Record<string, Manejador> = {
  "admin/panel": panel,
  "admin/representante": representante,
  "auth/consentimiento": consentimiento,
  "auth/ingreso": ingreso,
  "auth/recuperar": recuperar,
  "auth/registro": registro,
  "auth/restablecer": restablecer,
  "auth/salir": salir,
  "auth/sesion": sesion,
  "auth/verificar": verificar,
  "cliente/documentos": documentosCliente,
  "cliente/firma": firmaCliente,
  "cliente/proyecto": proyecto,
  "cliente/proyecto/enviar": enviarProyecto,
  "cliente/suscripcion": suscripcionCliente,
  "documentos/descargar": descargarDocumento,
  "documentos/enviar": enviarDocumento,
  "documentos/firmar": firmarDocumento,
  "documentos/generar": generarDocumento,
  "documentos/verificar": verificarDocumento,
  "suscripciones/anular": anularSuscripcion,
  "suscripciones/crear": crearSuscripcion,
  "suscripciones/pago": pagoSuscripcion,
  "suscripciones/reactivar": reactivarSuscripcion,
  "suscripciones/recalcular": recalcularSuscripcion,
  "suscripciones/suspender": suspenderSuscripcion,
};

export default async function despachar(peticion: Request): Promise<Response> {
  const { pathname } = new URL(peticion.url);
  const clave = pathname.replace(/^\/api\//, "").replace(/\/+$/, "");
  const manejador = RUTAS[clave];
  if (!manejador) {
    return new Response(JSON.stringify({ error: "No existe esa ruta de la API." }), {
      status: 404,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
  return manejador(peticion);
}
