/* ============================================================
   POST /api/cliente/proyecto/enviar
   ------------------------------------------------------------
   Enviar es el acto que congela el alcance y abre la etapa de
   contrato. Exige correo confirmado y la firma única ya capturada:
   sin firma no hay quién se obligue al alcance descrito.

   La actualización solo toca un proyecto en `borrador` del cliente
   en sesión. Si no hay borrador, la respuesta es 409; si dos
   peticiones llegan a la vez, una sola encuentra la fila.
   ============================================================ */

import { estadoDe } from "../../_lib/cuenta";
import { exigirOrigen } from "../../_lib/csrf";
import { enTransaccion } from "../../_lib/db";
import { json } from "../../_lib/http";
import { manejar } from "../../_lib/manejador";
import { planExacto } from "../../_lib/planes";
import { exigirCliente, vistaDeProyecto } from "../../_lib/proyecto";
import { ErrorHttp } from "../../_lib/respuestas";
import { leerSesion } from "../../_lib/sesion";

export default manejar(["POST"], async (peticion) => {
  exigirOrigen(peticion);
  const sesion = await leerSesion(peticion);
  if (!sesion) throw new ErrorHttp(401, "Tu sesión venció. Vuelve a entrar.", "sesion");

  const estado = await estadoDe(sesion);
  const cliente = exigirCliente(estado.cliente);
  if (!sesion.verificado) {
    throw new ErrorHttp(403, "Confirma tu correo antes de enviar el proyecto.", "verificar_correo");
  }
  if (!estado.firma) {
    throw new ErrorHttp(403, "Captura y registra tu firma antes de enviar el proyecto.", "firma");
  }

  const [filas] = await enTransaccion(sesion.usuarioId, sesion.rol, (txn) => [
    txn`with enviado as (
        update proyectos set estado = 'enviado', enviado = now()
        where cliente_id = ${cliente.id} and estado = 'borrador'
        returning id, nombre, categoria, dominio, buzones, alcance, complejidad,
                  plan_clave, plan_nivel, plan_version, estado, creado, enviado
      ), evento as (
        insert into eventos (actor, rol, accion, entidad, entidad_id)
        select ${sesion.usuarioId}, ${sesion.rol}, 'proyecto.enviado', 'proyectos', id::text
        from enviado
        returning 1
      )
      select * from enviado`,
  ]);

  const fila = (filas ?? [])[0] as Record<string, unknown> | undefined;
  if (!fila) {
    throw new ErrorHttp(
      409,
      "No hay un borrador pendiente. Guarda el proyecto antes de enviarlo.",
      "sin_borrador",
    );
  }

  const plan = await planExacto(
    String(fila.plan_clave),
    String(fila.plan_nivel),
    Number(fila.plan_version),
  );
  if (!plan) {
    throw new ErrorHttp(500, "El plan del proyecto no está en el catálogo.", "plan_integridad");
  }

  return json({ ok: true, proyecto: vistaDeProyecto(fila, plan) });
});
