/* ============================================================
   GET/POST /api/admin/representante
   ------------------------------------------------------------
   La firma del representante legal de Blink se captura en la
   administración y nunca se escribe en el repositorio. Cada
   captura agrega una fila: la tabla es de solo agregar y un
   documento ya generado conserva la firma que se le estampó.

   La captura más reciente es la que se usa al generar un
   expediente nuevo. Si falta el domicilio, la generación se
   detiene: BWS-CON-004 lo imprime en el encabezado del contrato.
   ============================================================ */

import { domicilioValido, correoNormalizado, nombreValido } from "../../legal/identidad";
import { agenteDe, ipDe, json, leerJson, objeto, texto } from "../_lib/http";
import { exigirOrigen } from "../_lib/csrf";
import { enTransaccion } from "../_lib/db";
import { validarFirmaPNG } from "../_lib/imagen";
import { manejar } from "../_lib/manejador";
import { ErrorHttp } from "../_lib/respuestas";
import { exigirAdmin, leerSesion } from "../_lib/sesion";

function documentoValido(valor: string): boolean {
  return /^[A-Z0-9][A-Z0-9-]{4,19}$/.test(valor.replace(/\s+/g, "").toUpperCase());
}

function instante(valor: unknown): Date {
  return valor instanceof Date ? valor : new Date(String(valor));
}

export default manejar(["GET", "POST"], async (peticion) => {
  const sesion = exigirAdmin(await leerSesion(peticion));

  if (peticion.method === "GET") {
    const [filas] = await enTransaccion(sesion.usuarioId, sesion.rol, (txn) => [
      txn`select id, nombre, documento, domicilio, correo, png, sha256, utc
          from bws_representante()`,
    ]);
    const fila = (filas ?? [])[0] as Record<string, unknown> | undefined;
    if (!fila) return json({ representante: null });
    const png = fila.png as Uint8Array | null;
    return json({
      representante: {
        id: fila.id,
        nombre: fila.nombre,
        documento: fila.documento,
        domicilio: fila.domicilio ?? null,
        correo: fila.correo ?? null,
        sha256: fila.sha256,
        utc: instante(fila.utc).toISOString(),
        png: png ? `data:image/png;base64,${Buffer.from(png).toString("base64")}` : null,
      },
    });
  }

  exigirOrigen(peticion);
  const cuerpo = objeto(await leerJson<unknown>(peticion));
  if (!cuerpo) throw new ErrorHttp(400, "Faltan los datos del representante.", "datos");

  const nombre = texto(cuerpo.nombre);
  if (!nombreValido(nombre)) {
    throw new ErrorHttp(400, "Escribe el nombre del representante legal.", "nombre");
  }

  const documento = texto(cuerpo.documento).replace(/\s+/g, "").toUpperCase();
  if (!documentoValido(documento)) {
    throw new ErrorHttp(400, "Escribe el documento del representante, por ejemplo V-12345678.", "documento");
  }

  const domicilio = texto(cuerpo.domicilio);
  if (!domicilioValido(domicilio)) {
    throw new ErrorHttp(400, "Escribe el domicilio del representante legal.", "domicilio");
  }

  const correoCrudo = texto(cuerpo.correo);
  const correo = correoCrudo ? correoNormalizado(correoCrudo) : null;
  if (correoCrudo && !correo) {
    throw new ErrorHttp(400, "El correo del representante no tiene un formato válido.", "correo");
  }

  const firma = validarFirmaPNG(cuerpo.png);
  const ip = ipDe(peticion);
  const agente = agenteDe(peticion);

  const [filas] = await enTransaccion(sesion.usuarioId, sesion.rol, (txn) => [
    txn`with nueva as (
          insert into representantes (nombre, documento, domicilio, correo, png, sha256, utc)
          values (${nombre}, ${documento}, ${domicilio}, ${correo}, ${firma.png},
                  ${firma.sha256}, now())
          returning id, utc
        ), evento as (
          insert into eventos (actor, rol, accion, entidad, entidad_id, detalle, ip, agente)
          select ${sesion.usuarioId}, 'admin', 'representante.capturado', 'representantes',
                 nueva.id::text,
                 ${JSON.stringify({ sha256: firma.sha256 })}::jsonb, ${ip}, ${agente}
          from nueva
          returning 1
        )
        select id, utc from nueva`,
  ]);

  const fila = (filas ?? [])[0] as Record<string, unknown> | undefined;
  if (!fila) throw new ErrorHttp(500, "No se pudo guardar la firma del representante.", "representante");

  return json(
    {
      ok: true,
      representante: {
        id: fila.id,
        nombre,
        documento,
        domicilio,
        correo,
        sha256: firma.sha256,
        utc: instante(fila.utc).toISOString(),
      },
    },
    201,
  );
});
