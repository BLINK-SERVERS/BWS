/* ============================================================
   GET/POST /api/cliente/proyecto
   ------------------------------------------------------------
   GET devuelve el proyecto del cliente (si existe), los presets
   vigentes con sus límites y las condiciones comerciales que se
   pueden leer antes de enviar.

   POST guarda el borrador. Un proyecto enviado no se edita: la
   base lo impide y aquí se responde 409 sin intentarlo. En esta
   etapa cada cliente tiene un solo proyecto; el alta de un segundo
   proyecto es una entrega aparte, no un efecto secundario de este
   endpoint. El plan se resuelve contra `planes_infra`; el precio
   que se muestra es el de la fila vigente, nunca una constante del
   código.
   ============================================================ */

import {
  exigirCliente,
  leerFicha,
  leerProyecto,
  vistaDeProyecto,
  COMPLEJIDADES,
  CATEGORIAS,
} from "../_lib/proyecto";
import { estadoDe } from "../_lib/cuenta";
import { exigirOrigen } from "../_lib/csrf";
import { enTransaccion } from "../_lib/db";
import { json, leerJson, objeto } from "../_lib/http";
import { manejar } from "../_lib/manejador";
import { buscarVigente, planExacto, planesVigentes } from "../_lib/planes";
import { condicionesPublicas } from "../_lib/prestador";
import { codigoPostgres, ErrorHttp } from "../_lib/respuestas";
import { leerSesion, type Sesion } from "../_lib/sesion";

function exigirSesion(sesion: Sesion | null): Sesion {
  if (!sesion) throw new ErrorHttp(401, "Tu sesión venció. Vuelve a entrar.", "sesion");
  return sesion;
}

async function proyectoDe(sesion: Sesion): Promise<Record<string, unknown> | null> {
  const [filas] = await enTransaccion(sesion.usuarioId, sesion.rol, (txn) => [
    txn`select p.id, p.nombre, p.categoria, p.dominio, p.buzones, p.alcance,
               p.complejidad, p.plan_clave, p.plan_nivel, p.plan_version,
               p.estado, p.creado, p.enviado
        from proyectos p
        join clientes c on c.id = p.cliente_id
        where c.usuario_id = ${sesion.usuarioId}
        order by p.creado desc
        limit 1`,
  ]);
  return ((filas ?? [])[0] as Record<string, unknown> | undefined) ?? null;
}

async function planDe(fila: Record<string, unknown>) {
  const plan = await planExacto(
    String(fila.plan_clave),
    String(fila.plan_nivel),
    Number(fila.plan_version),
  );
  if (!plan) {
    throw new ErrorHttp(500, "El plan del proyecto no está en el catálogo.", "plan_integridad");
  }
  return plan;
}

export default manejar(["GET", "POST"], async (peticion) => {
  const sesion = exigirSesion(await leerSesion(peticion));
  const estado = await estadoDe(sesion);

  if (peticion.method === "GET") {
    const [presets, fila] = await Promise.all([planesVigentes(), proyectoDe(sesion)]);
    return json({
      planes: presets,
      proyecto: fila ? vistaDeProyecto(fila, await planDe(fila)) : null,
      condiciones: condicionesPublicas(),
      categorias: CATEGORIAS,
      complejidades: COMPLEJIDADES,
      ficha: estado.cliente
        ? {
            razon_social: estado.cliente.razon_social,
            documento_tipo: estado.cliente.documento_tipo,
            documento_numero: estado.cliente.documento_numero,
            domicilio: estado.cliente.domicilio_fiscal,
            telefono: estado.cliente.telefono,
            correo_factura: estado.cliente.correo_factura,
          }
        : null,
    });
  }

  exigirOrigen(peticion);
  const cliente = exigirCliente(estado.cliente);
  const cuerpo = objeto(await leerJson<unknown>(peticion));
  const datos = leerProyecto(cuerpo);
  const ficha = leerFicha(cuerpo?.ficha);

  const presets = await planesVigentes();
  const plan = buscarVigente(presets, datos.plan_clave, datos.plan_nivel);
  if (!plan) {
    throw new ErrorHttp(400, "Ese plan no está disponible. Elige uno de la lista.", "plan");
  }

  let guardado: Record<string, unknown> | undefined;
  try {
    // La ficha fiscal se guarda con el mismo borrador: es la que irá
    // al contrato cuando el proyecto se envíe. Si el proyecto ya salió,
    // la ficha queda congelada aunque la petición termine en 409.
    const [, , , filas] = await enTransaccion(sesion.usuarioId, sesion.rol, (txn) => [
      txn`update clientes set
            razon_social = ${ficha.razon_social},
            documento_tipo = ${ficha.documento_tipo},
            documento_numero = ${ficha.documento_numero},
            domicilio_fiscal = ${ficha.domicilio},
            telefono = ${ficha.telefono},
            correo_factura = ${ficha.correo_factura}
          where id = ${cliente.id}
            and not exists (
              select 1 from proyectos
              where cliente_id = ${cliente.id} and estado <> 'borrador'
            )`,
      txn`update proyectos set
            nombre = ${datos.nombre},
            categoria = ${datos.categoria},
            dominio = ${datos.dominio},
            buzones = ${JSON.stringify(datos.buzones)}::jsonb,
            alcance = ${datos.alcance},
            complejidad = ${datos.complejidad},
            plan_clave = ${plan.clave},
            plan_nivel = ${plan.nivel},
            plan_version = ${plan.version}
          where cliente_id = ${cliente.id} and estado = 'borrador'`,
      txn`insert into proyectos
            (cliente_id, nombre, categoria, dominio, buzones, alcance, complejidad,
             plan_clave, plan_nivel, plan_version)
          select ${cliente.id}, ${datos.nombre}, ${datos.categoria}, ${datos.dominio},
                 ${JSON.stringify(datos.buzones)}::jsonb, ${datos.alcance},
                 ${datos.complejidad}, ${plan.clave}, ${plan.nivel}, ${plan.version}
          where not exists (select 1 from proyectos where cliente_id = ${cliente.id})`,
      txn`select id, nombre, categoria, dominio, buzones, alcance, complejidad,
                 plan_clave, plan_nivel, plan_version, estado, creado, enviado
          from proyectos
          where cliente_id = ${cliente.id}
          limit 1`,
    ]);
    guardado = (filas ?? [])[0] as Record<string, unknown> | undefined;
  } catch (error) {
    if (codigoPostgres(error) === "23505") {
      const restriccion = (error as { constraint?: string }).constraint ?? "";
      if (restriccion.startsWith("clientes_")) {
        throw new ErrorHttp(
          409,
          "Ese documento ya está registrado en otra cuenta.",
          "documento",
        );
      }
      throw new ErrorHttp(409, "Ya hay un borrador guardado. Recarga la página.", "borrador");
    }
    throw error;
  }

  if (!guardado || String(guardado.estado) !== "borrador") {
    throw new ErrorHttp(
      409,
      "Este proyecto ya fue enviado. El alcance congelado no se edita.",
      "proyecto_enviado",
    );
  }

  return json({ ok: true, proyecto: vistaDeProyecto(guardado, plan) }, 201);
});
