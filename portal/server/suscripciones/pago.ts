/* ============================================================
   POST /api/suscripciones/pago
   ------------------------------------------------------------
   La administración registra un pago de infraestructura. El pago
   es una fila nueva e inmutable: una corrección se hace anulando y
   registrando otro, nunca editando.

   Registrar el pago adelanta el vencimiento (solo hacia adelante) y le
   devuelve el estado que le corresponde a esa fecha nueva: `al_dia` si
   hoy no la pasó, `mora` o `suspendida` si sigue pendiente. La licencia
   se reactiva solo con esos dos estados. Dos altas del mismo periodo no
   caben: el disparador de la base responde 23505 y aquí se convierte en
   un 409 legible.

   Con moneda VES la tasa BCV es obligatoria y queda guardada con
   el pago: sin ella no se puede reconstruir el monto en bolívares.
   ============================================================ */

import { agenteDe, ipDe, json, leerJson, objeto, texto } from "../_lib/http";
import { exigirOrigen } from "../_lib/csrf";
import { enTransaccion } from "../_lib/db";
import { manejar } from "../_lib/manejador";
import { codigoPostgres, ErrorHttp } from "../_lib/respuestas";
import { exigirAdmin, leerSesion } from "../_lib/sesion";
import {
  estadoPorFecha,
  fechaISO,
  fechaTexto,
  hoyUTC,
  numero,
  periodoValido,
  vencimientoTrasPeriodo,
} from "../_lib/suscripcion";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default manejar(["POST"], async (peticion) => {
  exigirOrigen(peticion);
  const sesion = exigirAdmin(await leerSesion(peticion));

  const cuerpo = objeto(await leerJson<unknown>(peticion));
  const suscripcionId = texto(cuerpo?.suscripcion_id);
  if (!UUID.test(suscripcionId)) {
    throw new ErrorHttp(400, "Indica la suscripción del pago.", "suscripcion");
  }

  const periodo = texto(cuerpo?.periodo);
  if (!periodoValido(periodo)) {
    throw new ErrorHttp(400, "El periodo debe tener el formato AAAA-MM.", "periodo");
  }

  const monto = numero(cuerpo?.monto);
  if (monto === null || monto <= 0 || monto > 100_000_000) {
    throw new ErrorHttp(400, "El monto debe ser mayor que cero.", "monto");
  }

  const moneda = texto(cuerpo?.moneda) || "USD";
  if (moneda !== "USD" && moneda !== "VES") {
    throw new ErrorHttp(400, "La moneda solo puede ser USD o VES.", "moneda");
  }

  const tasa = cuerpo?.tasa_bcv === undefined || texto(cuerpo?.tasa_bcv) === ""
    ? null
    : numero(cuerpo?.tasa_bcv);
  if (moneda === "VES" && (tasa === null || tasa <= 0)) {
    throw new ErrorHttp(400, "Un pago en bolívares necesita la tasa BCV.", "tasa");
  }
  if (tasa !== null && (tasa <= 0 || tasa > 1_000_000)) {
    throw new ErrorHttp(400, "La tasa BCV no es válida.", "tasa");
  }

  const referencia = texto(cuerpo?.referencia);
  if (referencia.length < 3 || referencia.length > 120) {
    throw new ErrorHttp(400, "Escribe la referencia del pago (3 a 120 caracteres).", "referencia");
  }

  const fecha = cuerpo?.fecha === undefined ? hoyUTC() : fechaISO(texto(cuerpo?.fecha));
  if (!fecha) {
    throw new ErrorHttp(400, "La fecha del pago no es válida.", "fecha");
  }
  const hoy = hoyUTC();

  const [filas] = await enTransaccion(sesion.usuarioId, sesion.rol, (txn) => [
    txn`select id, proyecto_id, estado, dia_cobro, dias_gracia, proximo_vencimiento
        from suscripciones where id = ${suscripcionId}`,
  ]);
  const suscripcion = (filas ?? [])[0] as Record<string, unknown> | undefined;
  if (!suscripcion) {
    throw new ErrorHttp(404, "Esa suscripción no existe.", "suscripcion");
  }
  if (String(suscripcion.estado) === "terminada") {
    throw new ErrorHttp(409, "La suscripción está terminada: no admite pagos.", "terminada");
  }

  const proyectoId = String(suscripcion.proyecto_id);
  const anterior = String(suscripcion.estado);
  const gracia = Number(suscripcion.dias_gracia);
  const nuevoVencimiento = vencimientoTrasPeriodo(periodo, Number(suscripcion.dia_cobro));
  // El pago no declara `al_dia` por sí solo: adelanta el vencimiento y el
  // estado es el que resulta de comparar esa fecha con hoy. Si se paga un
  // periodo viejo, la suscripción sigue en mora o suspendida con su fecha
  // corregida; decirle `al_dia` sería tapar la mora y reabrir la licencia.
  const vigente = fechaTexto(suscripcion.proximo_vencimiento);
  const vencimientoFinal = vigente >= nuevoVencimiento ? vigente : nuevoVencimiento;
  const estadoTrasPago = estadoPorFecha(vencimientoFinal, gracia, hoy);
  const levantaLicencia = estadoTrasPago === "al_dia" || estadoTrasPago === "mora";
  const ip = ipDe(peticion);
  const agente = agenteDe(peticion);

  try {
    const [pagoFila, , , , suscripcionFila] = await enTransaccion(sesion.usuarioId, sesion.rol, (txn) => [
      txn`insert into pagos
            (suscripcion_id, periodo, monto, moneda, tasa_bcv, referencia, fecha)
          values (${suscripcionId}::uuid, ${periodo}, ${monto.toFixed(2)}, ${moneda},
                  ${tasa}, ${referencia}, ${fecha}::date)
          returning id, periodo, monto, moneda, tasa_bcv, referencia, fecha, estado, creado`,
      txn`update suscripciones
          set estado = ${estadoTrasPago},
              proximo_vencimiento = greatest(proximo_vencimiento, ${nuevoVencimiento}::date),
              actualizada = now()
          where id = ${suscripcionId} and estado <> 'terminada'
          returning proyecto_id, estado, proximo_vencimiento, dias_gracia`,
      txn`update licencias
          set estado = 'activa'
          where proyecto_id = ${proyectoId}::uuid and estado = 'suspendida'
            and ${levantaLicencia}::boolean`,
      txn`insert into eventos (actor, rol, accion, entidad, entidad_id, detalle, ip, agente)
          values (${sesion.usuarioId}, 'admin', 'pago.registrado', 'suscripciones',
                  ${suscripcionId},
                  ${JSON.stringify({
                    periodo,
                    monto,
                    moneda,
                    tasa_bcv: tasa,
                    referencia,
                    fecha,
                    estado_anterior: anterior,
                    estado_nuevo: estadoTrasPago,
                  })}::jsonb,
                  ${ip}, ${agente})`,
      txn`select estado, proximo_vencimiento, dias_gracia
          from suscripciones where id = ${suscripcionId}`,
    ]);
    const pago = (pagoFila ?? [])[0] as Record<string, unknown> | undefined;
    const fila = (suscripcionFila ?? [])[0] as Record<string, unknown> | undefined;

    return json(
      {
        ok: true,
        anterior,
        pago: pago
          ? {
              id: String(pago.id),
              periodo: String(pago.periodo),
              monto: Number(pago.monto),
              moneda: String(pago.moneda),
              tasa_bcv: pago.tasa_bcv === null ? null : Number(pago.tasa_bcv),
              referencia: String(pago.referencia),
              fecha: fechaTexto(pago.fecha),
              estado: String(pago.estado),
            }
          : null,
        suscripcion: {
          estado: fila ? String(fila.estado) : estadoTrasPago,
          proximo_vencimiento: fila
            ? fechaTexto(fila.proximo_vencimiento)
            : nuevoVencimiento,
          dias_gracia: fila ? Number(fila.dias_gracia) : Number(suscripcion.dias_gracia),
        },
      },
      201,
    );
  } catch (error) {
    const codigo = codigoPostgres(error);
    if (codigo === "23505") {
      throw new ErrorHttp(409, "Ese periodo ya tiene un pago registrado.", "pago_duplicado");
    }
    if (codigo === "23503") {
      throw new ErrorHttp(409, "La suscripción del pago ya no existe.", "suscripcion");
    }
    throw error;
  }
});
