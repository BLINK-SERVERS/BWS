/* ============================================================
   GET/POST /api/cliente/proyecto
   ------------------------------------------------------------
   GET devuelve el proyecto del cliente (si existe), los presets
   vigentes con sus límites y las condiciones comerciales que se
   pueden leer antes de enviar.

   POST guarda el borrador. Un proyecto enviado no se edita, salvo
   la captura explícita de persona en un histórico sin documentos;
   esa operación no cambia el alcance ni la ficha fiscal. En esta
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
import { nombreValido, normalizarDocumento } from "../../legal/identidad";
import { estadoDe } from "../_lib/cuenta";
import { exigirOrigen } from "../_lib/csrf";
import { enTransaccion } from "../_lib/db";
import { agenteDe, ipDe, json, leerJson, objeto } from "../_lib/http";
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
               p.estado, p.creado, p.enviado, p.persona_tipo,
               p.cliente_rep_nombre, p.cliente_rep_documento,
               (p.estado = 'enviado' and p.persona_tipo is null
                 and not exists (select 1 from documentos d where d.proyecto_id = p.id))
                 as puede_registrar_persona
        from proyectos p
        join clientes c on c.id = p.cliente_id
        where c.usuario_id = ${sesion.usuarioId}
        order by p.creado desc
        limit 1`,
  ]);
  return ((filas ?? [])[0] as Record<string, unknown> | undefined) ?? null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function leerPersonaHistorica(cuerpo: Record<string, unknown> | null) {
  const permitidos = ["accion", "proyecto_id", "persona_tipo", "cliente_rep_nombre", "cliente_rep_documento"];
  if (!cuerpo || Object.keys(cuerpo).some((clave) => !permitidos.includes(clave)) ||
      typeof cuerpo.proyecto_id !== "string" || !UUID.test(cuerpo.proyecto_id)) {
    throw new ErrorHttp(400, "Indica el proyecto y los datos de persona.", "persona_historica");
  }
  const persona = cuerpo.persona_tipo;
  if (persona !== "natural" && persona !== "juridica") {
    throw new ErrorHttp(400, "Elige si el proyecto es para ti o para tu empresa.", "persona_historica");
  }
  let nombre: string | null = null;
  let documento: string | null = null;
  if (persona === "juridica") {
    nombre = typeof cuerpo.cliente_rep_nombre === "string" ? cuerpo.cliente_rep_nombre.trim() : "";
    documento = normalizarDocumento("cedula", cuerpo.cliente_rep_documento);
    if (!nombreValido(nombre) || !documento) {
      throw new ErrorHttp(400, "Indica el nombre y una cédula válida del representante.", "persona_historica");
    }
  } else if (cuerpo.cliente_rep_nombre != null || cuerpo.cliente_rep_documento != null) {
    throw new ErrorHttp(400, "Una persona natural no lleva representante de empresa.", "persona_historica");
  }
  return { proyectoId: cuerpo.proyecto_id, persona, nombre, documento };
}

async function registrarPersonaHistorica(
  sesion: Sesion, clienteId: string, cuerpo: Record<string, unknown> | null, peticion: Request,
): Promise<Response> {
  if (sesion.rol !== "cliente") throw new ErrorHttp(403, "Solo el cliente puede indicar su persona.", "rol");
  const { proyectoId, persona, nombre, documento } = leerPersonaHistorica(cuerpo);
  const ip = ipDe(peticion);
  const agente = agenteDe(peticion);
  // El bloqueo y la comprobación son sentencias separadas: tras esperar al
  // generador, READ COMMITTED vuelve a ver los documentos confirmados.
  let filas: Record<string, unknown>[];
  try {
    [, filas] = await enTransaccion(sesion.usuarioId, sesion.rol, (txn) => [
    txn`select id from proyectos where id = ${proyectoId}::uuid
        and cliente_id = ${clienteId}::uuid for update`,
    txn`with actualizado as (
          update proyectos set persona_tipo = ${persona},
                 cliente_rep_nombre = ${nombre}, cliente_rep_documento = ${documento}
          where id = ${proyectoId}::uuid and cliente_id = ${clienteId}::uuid
            and estado = 'enviado' and persona_tipo is null
            and not exists (select 1 from documentos where proyecto_id = ${proyectoId}::uuid)
          returning id, nombre, categoria, dominio, buzones, alcance, complejidad,
                    plan_clave, plan_nivel, plan_version, estado, creado, enviado,
                    persona_tipo, cliente_rep_nombre, cliente_rep_documento
        ), evento as (
          insert into eventos (actor, rol, accion, entidad, entidad_id, detalle, ip, agente)
          select ${sesion.usuarioId}::uuid, 'cliente', 'proyecto.persona_historica',
                 'proyectos', id::text,
                 ${JSON.stringify({ persona_tipo: persona, cliente_rep_nombre: nombre, cliente_rep_documento: documento })}::jsonb,
                 ${ip}, ${agente}
          from actualizado
        ) select * from actualizado`,
    ]);
  } catch (error) {
    if (codigoPostgres(error) === "P2102") {
      throw new ErrorHttp(503, "No se pudo comprobar el proyecto de forma segura.", "aislamiento");
    }
    if (codigoPostgres(error) === "42501") {
      throw new ErrorHttp(409, "Ya no se puede registrar la persona en este proyecto.", "persona_no_disponible");
    }
    throw error;
  }
  const fila = filas[0];
  if (!fila) {
    throw new ErrorHttp(409, "Ya no se puede registrar la persona en este proyecto. Recarga la página.", "persona_no_disponible");
  }
  return json({ ok: true, proyecto: vistaDeProyecto(fila, await planDe(fila)) });
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
      puede_registrar_persona: sesion.rol === "cliente" && fila?.puede_registrar_persona === true,
      condiciones: condicionesPublicas(),
      categorias: CATEGORIAS,
      complejidades: COMPLEJIDADES,
      ficha: estado.cliente
        ? {
            persona_tipo: fila?.persona_tipo ?? null,
            cliente_rep_nombre: fila?.cliente_rep_nombre ?? null,
            cliente_rep_documento: fila?.cliente_rep_documento ?? null,
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
  if (cuerpo?.accion === "registrar_persona_historica") {
    return registrarPersonaHistorica(sesion, cliente.id, cuerpo, peticion);
  }
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
            plan_version = ${plan.version},
            persona_tipo = ${ficha.persona_tipo},
            cliente_rep_nombre = ${ficha.cliente_rep_nombre},
            cliente_rep_documento = ${ficha.cliente_rep_documento}
          where cliente_id = ${cliente.id} and estado = 'borrador'`,
      txn`insert into proyectos
            (cliente_id, nombre, categoria, dominio, buzones, alcance, complejidad,
             plan_clave, plan_nivel, plan_version, persona_tipo,
             cliente_rep_nombre, cliente_rep_documento)
          select ${cliente.id}, ${datos.nombre}, ${datos.categoria}, ${datos.dominio},
                 ${JSON.stringify(datos.buzones)}::jsonb, ${datos.alcance},
                 ${datos.complejidad}, ${plan.clave}, ${plan.nivel}, ${plan.version},
                 ${ficha.persona_tipo}, ${ficha.cliente_rep_nombre}, ${ficha.cliente_rep_documento}
          where not exists (select 1 from proyectos where cliente_id = ${cliente.id})`,
      txn`select id, nombre, categoria, dominio, buzones, alcance, complejidad,
                 plan_clave, plan_nivel, plan_version, estado, creado, enviado,
                 persona_tipo, cliente_rep_nombre, cliente_rep_documento
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
