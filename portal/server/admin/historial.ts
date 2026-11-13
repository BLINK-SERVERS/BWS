/* ============================================================
   GET /api/admin/historial
   ------------------------------------------------------------
   El rastro de evidencia que `eventos` guarda desde el principio y
   que nadie había mostrado. Con `proyecto_id` devuelve lo que pasó
   en ese expediente —generaciones, firmas, descargas, ajustes,
   envíos, pagos y licencias—; sin él, los últimos movimientos de
   toda la operación.

   Es lectura pura sobre una tabla de solo agregar: no hay nada que
   editar aquí. El actor se resuelve por su nombre; si la cuenta ya
   no existe, la fila del evento sigue contando lo que pasó.
   ============================================================ */

import { json } from "../_lib/http";
import { enTransaccion } from "../_lib/db";
import { manejar } from "../_lib/manejador";
import { ErrorHttp } from "../_lib/respuestas";
import { exigirAdmin, leerSesion } from "../_lib/sesion";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const POR_DEFECTO = 120;
const MAXIMO = 400;

function instante(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  return (valor instanceof Date ? valor : new Date(String(valor))).toISOString();
}

export default manejar(["GET"], async (peticion) => {
  const sesion = exigirAdmin(await leerSesion(peticion));
  const url = new URL(peticion.url);
  const proyectoId = url.searchParams.get("proyecto_id")?.trim() ?? "";
  const pedido = Number(url.searchParams.get("limite") ?? POR_DEFECTO);
  if (!Number.isFinite(pedido) || pedido < 1 || pedido > MAXIMO) {
    throw new ErrorHttp(400, `El límite de eventos va de 1 a ${MAXIMO}.`, "limite");
  }
  if (proyectoId && !UUID.test(proyectoId)) {
    throw new ErrorHttp(400, "Ese proyecto no tiene un identificador válido.", "proyecto");
  }

  const [filas] = await enTransaccion(sesion.usuarioId, sesion.rol, (txn) => [
    proyectoId
      ? txn`select e.id, e.ocurrido, e.accion, e.entidad, e.entidad_id, e.rol, e.detalle,
                   e.ip::text as ip, e.agente, u.nombre as actor
            from eventos e
            left join usuarios u on u.id = e.actor
            where (
                 (e.entidad = 'proyectos'    and e.entidad_id = ${proyectoId})
              or (e.entidad = 'documentos'   and e.entidad_id in (
                     select d.id::text from documentos d where d.proyecto_id = ${proyectoId}::uuid))
              or (e.entidad = 'suscripciones' and e.entidad_id in (
                     select s.id::text from suscripciones s where s.proyecto_id = ${proyectoId}::uuid))
              or (e.entidad = 'pagos'        and e.entidad_id in (
                     select p.id::text from pagos p
                     join suscripciones s on s.id = p.suscripcion_id
                     where s.proyecto_id = ${proyectoId}::uuid))
              or (e.entidad = 'usuarios'     and e.accion = 'cuenta.creada' and e.actor in (
                     select c.usuario_id from proyectos pr
                     join clientes c on c.id = pr.cliente_id
                     where pr.id = ${proyectoId}::uuid))
            )
            order by e.ocurrido desc, e.id desc
            limit ${pedido}`
      : txn`select e.id, e.ocurrido, e.accion, e.entidad, e.entidad_id, e.rol, e.detalle,
                   e.ip::text as ip, e.agente, u.nombre as actor
            from eventos e
            left join usuarios u on u.id = e.actor
            order by e.ocurrido desc, e.id desc
            limit ${pedido}`,
  ]);

  const eventos = ((filas ?? []) as Record<string, unknown>[]).map((fila) => ({
    id: String(fila.id),
    ocurrido: instante(fila.ocurrido),
    accion: String(fila.accion),
    entidad: String(fila.entidad),
    entidad_id: fila.entidad_id ? String(fila.entidad_id) : null,
    rol: fila.rol ? String(fila.rol) : null,
    actor: fila.actor ? String(fila.actor) : null,
    ip: fila.ip ? String(fila.ip) : null,
    agente: fila.agente ? String(fila.agente) : null,
    detalle: (fila.detalle ?? null) as Record<string, unknown> | null,
  }));

  return json({ ok: true, proyecto_id: proyectoId || null, eventos });
});
