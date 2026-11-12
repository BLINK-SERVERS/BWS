/* ============================================================
   GET/POST /api/cliente/firma
   ------------------------------------------------------------
   La firma se captura una sola vez. El POST comprueba que el
   correo esté confirmado, que el consentimiento enviado sea el
   que corresponde al texto LEG-002 resuelto con el nombre y el
   correo de la cuenta, y que no exista una firma original previa.
   La base
   tiene el índice único como última defensa: si dos peticiones
   llegan a la vez, una sola escribe.

   La respuesta 409 no es un error de red: significa que la firma
   ya estaba registrada y que no se reemplaza.
   ============================================================ */

import { agenteDe, ipDe, json, leerJson, objeto, texto } from "../_lib/http";
import { estadoDe, type ClienteCuenta } from "../_lib/cuenta";
import { enTransaccion } from "../_lib/db";
import { exigirOrigen } from "../_lib/csrf";
import { validarFirmaPNG } from "../_lib/imagen";
import { manejar } from "../_lib/manejador";
import {
  documentoDeConsentimiento,
  huellaDelConsentimiento,
  type PersonaRegistro,
} from "../_lib/registro";
import { leerSesion, type Sesion } from "../_lib/sesion";
import { codigoPostgres, ErrorHttp } from "../_lib/respuestas";

function exigirCuenta(sesion: Sesion | null): Sesion {
  if (!sesion) throw new ErrorHttp(401, "Tu sesión venció. Vuelve a entrar.", "sesion");
  if (sesion.rol !== "cliente") {
    throw new ErrorHttp(403, "Esta sección es para clientes.", "rol");
  }
  return sesion;
}

function comoPersona(
  cliente: ClienteCuenta,
  nombre: string,
  correo: string,
): PersonaRegistro {
  return { nombre, telefono: cliente.telefono, correo };
}

export default manejar(["GET", "POST"], async (peticion) => {
  const sesion = exigirCuenta(await leerSesion(peticion));
  const estado = await estadoDe(sesion);
  if (!estado.cliente) {
    throw new ErrorHttp(404, "La cuenta no tiene ficha fiscal.", "cliente");
  }

  if (peticion.method === "GET") {
    const persona = comoPersona(estado.cliente, sesion.nombre, sesion.correo);
    const consentimiento = huellaDelConsentimiento(persona);
    let imagen: string | null = null;
    if (estado.firma) {
      const [filas] = await enTransaccion(sesion.usuarioId, sesion.rol, (txn) => [
        txn`select f.png from firmas_cliente f
            join clientes c on c.firma_actual = f.id
            where c.usuario_id = ${sesion.usuarioId}`,
      ]);
      const png = filas[0]?.png;
      if (png) imagen = `data:image/png;base64,${Buffer.from(png as Uint8Array).toString("base64")}`;
    }
    return json({
      verificado: sesion.verificado,
      consentimiento_hash: consentimiento,
      consentimiento: documentoDeConsentimiento(persona),
      firma: estado.firma ? { ...estado.firma, png: imagen } : null,
    });
  }

  exigirOrigen(peticion);

  if (!sesion.verificado) {
    throw new ErrorHttp(
      403,
      "Confirma tu correo antes de firmar. Revisa el mensaje de verificación.",
      "verificar_correo",
    );
  }

  const cuerpo = objeto(await leerJson<unknown>(peticion));
  const firma = validarFirmaPNG(cuerpo?.png);
  const consentimiento = huellaDelConsentimiento(
    comoPersona(estado.cliente, sesion.nombre, sesion.correo),
  );
  if (texto(cuerpo?.consentimiento_hash) !== consentimiento) {
    throw new ErrorHttp(
      409,
      "El texto del consentimiento cambió. Vuelve a leerlo antes de firmar.",
      "consentimiento",
    );
  }

  const ip = ipDe(peticion);
  const agente = agenteDe(peticion);

  let filas: Record<string, unknown>[];
  try {
    [filas] = await enTransaccion(sesion.usuarioId, sesion.rol, (txn) => [
      txn`with cliente as (
            select c.id
            from clientes c
            join usuarios u on u.id = c.usuario_id
            where c.usuario_id = ${sesion.usuarioId} and u.correo_verificado
          ),
          nueva as (
            insert into firmas_cliente (
              cliente_id, png, sha256, ip, agente, utc, metodo, version,
              hash_consentimiento
            )
            select cliente.id, ${firma.png}, ${firma.sha256}, ${ip}, ${agente},
                   now(), 'simple_reforzada', 1, ${consentimiento}
            from cliente
            where not exists (
              select 1 from firmas_cliente f
              where f.cliente_id = cliente.id and f.motivo is null
            )
            returning id, cliente_id
          ),
          actualizado as (
            update clientes c set firma_actual = nueva.id
            from nueva where c.id = nueva.cliente_id
            returning nueva.id
          ),
          evento as (
            insert into eventos (
              actor, rol, accion, entidad, entidad_id, detalle, ip, agente
            )
            select ${sesion.usuarioId}, 'cliente', 'firma.capturada',
                   'firmas_cliente', actualizado.id::text,
                   ${JSON.stringify({ sha256: firma.sha256, metodo: "simple_reforzada" })}::jsonb,
                   ${ip}, ${agente}
            from actualizado
            returning 1
          )
          select id from actualizado`,
    ]);
  } catch (error) {
    if (codigoPostgres(error) === "23505") {
      throw new ErrorHttp(
        409,
        "Ya tienes una firma registrada. La firma no se reemplaza dentro del portal.",
        "firma_existente",
      );
    }
    throw error;
  }

  const id = filas[0]?.id;
  if (!id) {
    throw new ErrorHttp(
      409,
      "Ya tienes una firma registrada. La firma no se reemplaza dentro del portal.",
      "firma_existente",
    );
  }

  return json(
    {
      ok: true,
      firma: {
        id,
        sha256: firma.sha256,
        utc: new Date().toISOString(),
        metodo: "simple_reforzada",
        version: 1,
        hash_consentimiento: consentimiento,
        png: `data:image/png;base64,${firma.png.toString("base64")}`,
      },
    },
    201,
  );
});
