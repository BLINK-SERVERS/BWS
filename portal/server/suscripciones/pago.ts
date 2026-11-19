/* ============================================================
   POST /api/suscripciones/pago
   ------------------------------------------------------------
   La administración registra un pago de infraestructura. El pago
   es una fila nueva e inmutable: una corrección se hace anulando y
   registrando otro, nunca editando.

   El régimen histórico conserva su avance y reactivación anteriores.
   El nuevo registra una cuota completa y calcula el primer periodo sin
   cubrir; no reactiva automáticamente ni supone intereses. Una revisión
   administrativa posterior acredita la liquidación y deja rastro. Dos
   pagos vigentes del mismo periodo se rechazan con 409.

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
  pagoCubreMensualidad,
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

  const tasaCruda = cuerpo?.tasa_bcv;
  const tasa = tasaCruda === undefined || tasaCruda === null || (typeof tasaCruda === "string" && texto(tasaCruda) === "")
    ? null
    : numero(tasaCruda);
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
    txn`select id, proyecto_id, estado, dia_cobro, dias_gracia, proximo_vencimiento,
               vencimiento_inicial_mora, monto_usd, bws_contrato_mora_nuevo(proyecto_id) as regimen_nuevo
        from suscripciones where id = ${suscripcionId}`,
  ]);
  const suscripcion = (filas ?? [])[0] as Record<string, unknown> | undefined;
  if (!suscripcion) {
    throw new ErrorHttp(404, "Esa suscripción no existe.", "suscripcion");
  }
  if (String(suscripcion.estado) === "terminada") {
    throw new ErrorHttp(409, "La suscripción está terminada: no admite pagos.", "terminada");
  }

  if (suscripcion.regimen_nuevo) {
    if (!suscripcion.vencimiento_inicial_mora) {
      throw new ErrorHttp(409, "Registra primero el vencimiento inicial y su fundamento en la regularización administrativa.", "inicio_mora");
    }
    if (periodo < fechaTexto(suscripcion.vencimiento_inicial_mora).slice(0, 7)) {
      throw new ErrorHttp(400, "El periodo es anterior al primer vencimiento.", "periodo");
    }
    if (!pagoCubreMensualidad(monto, moneda, tasa, Number(suscripcion.monto_usd))) {
      throw new ErrorHttp(400, "El pago debe cubrir la mensualidad completa; no incluye intereses.", "monto_insuficiente");
    }
    try {
      const [movimiento, pagos] = await enTransaccion(sesion.usuarioId, sesion.rol, (txn) => [
        txn`select * from bws_pago_mora(${suscripcionId}::uuid, ${periodo}, ${monto.toFixed(2)}::numeric,
              ${moneda}, ${tasa === null ? null : tasa.toFixed(4)}::numeric, ${referencia}, ${fecha}::date, ${hoy}::date,
              ${ipDe(peticion)}::inet, ${agenteDe(peticion)})`,
        txn`select id, periodo, monto, moneda, tasa_bcv, referencia, fecha, estado
            from pagos p where p.suscripcion_id = ${suscripcionId}::uuid
              and p.periodo = ${periodo} and p.estado = 'registrado'
              and not exists (select 1 from pagos a where a.anulacion_de = p.id)`,
      ]);
      const resultado = movimiento[0];
      const pago = pagos[0];
      return json({
        ok: true, anterior: String(resultado.anterior),
        pago: {
          id: String(pago.id), periodo: String(pago.periodo), monto: Number(pago.monto),
          moneda: String(pago.moneda), tasa_bcv: pago.tasa_bcv === null ? null : Number(pago.tasa_bcv),
          referencia: String(pago.referencia), fecha: fechaTexto(pago.fecha), estado: String(pago.estado),
        },
        suscripcion: { estado: String(resultado.nuevo), proximo_vencimiento: fechaTexto(resultado.proximo), dias_gracia: 0 },
        reactivacion_automatica: false,
      }, 201);
    } catch (error) {
      const codigo = codigoPostgres(error);
      if (codigo === "23505") throw new ErrorHttp(409, "Ese periodo ya tiene un pago registrado.", "pago_duplicado");
      if (codigo === "P0001") throw new ErrorHttp(409, "No se pudo registrar el pago: revisa el estado, el inicio y la mensualidad completa.", "pago_mora");
      throw error;
    }
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
    const [, pagoFila, , , , suscripcionFila] = await enTransaccion(sesion.usuarioId, sesion.rol, (txn) => [
      txn`select id from suscripciones where id = ${suscripcionId} for update`,
      txn`insert into pagos
            (suscripcion_id, periodo, monto, moneda, tasa_bcv, referencia, fecha)
          select s.id, ${periodo}, ${monto.toFixed(2)}::numeric, ${moneda},
                  ${tasa}::numeric, ${referencia}, ${fecha}::date
          from suscripciones s where s.id = ${suscripcionId}::uuid
            and s.estado <> 'terminada' and not bws_contrato_mora_nuevo(s.proyecto_id)
          returning id, periodo, monto, moneda, tasa_bcv, referencia, fecha, estado, creado`,
      txn`update suscripciones
          set estado = ${estadoTrasPago},
              proximo_vencimiento = greatest(proximo_vencimiento, ${nuevoVencimiento}::date),
              actualizada = now()
          where id = ${suscripcionId} and estado <> 'terminada'
            and not bws_contrato_mora_nuevo(proyecto_id)
          returning proyecto_id, estado, proximo_vencimiento, dias_gracia`,
      txn`update licencias
          set estado = 'activa'
          where proyecto_id = ${proyectoId}::uuid and estado = 'suspendida'
            and ${levantaLicencia}::boolean
            and exists (select 1 from suscripciones s where s.id = ${suscripcionId}::uuid
                        and s.estado <> 'terminada' and not bws_contrato_mora_nuevo(s.proyecto_id))`,
      txn`insert into eventos (actor, rol, accion, entidad, entidad_id, detalle, ip, agente)
          select ${sesion.usuarioId}::uuid, 'admin', 'pago.registrado', 'suscripciones',
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
                  ${ip}::inet, ${agente}::text
          where exists (select 1 from suscripciones s where s.id = ${suscripcionId}::uuid
                        and s.estado <> 'terminada' and not bws_contrato_mora_nuevo(s.proyecto_id))`,
      txn`select estado, proximo_vencimiento, dias_gracia
          from suscripciones where id = ${suscripcionId}`,
    ]);
    const pago = (pagoFila ?? [])[0] as Record<string, unknown> | undefined;
    if (!pago) throw new ErrorHttp(409, "La suscripción cambió; vuelve a intentar el pago.", "suscripcion_cambiada");
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
