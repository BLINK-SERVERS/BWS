/* ============================================================
   GET /api/admin/panel
   ------------------------------------------------------------
   Una sola lectura para el panel de administración: clientes con
   su firma, proyectos con el avance del expediente, los documentos
   con su ajuste a mano vigente, suscripciones con su licencia y sus
   pagos, las plantillas publicadas y la firma del representante.

   El pago «efectivo» es el registrado al que nadie anuló: los
   anulados se conservan y se devuelven marcados para que la
   administración vea el historial completo. La imagen del
   representante no viaja aquí; su captura tiene su propio GET.
   ============================================================ */

import { json } from "../_lib/http";
import { enTransaccion } from "../_lib/db";
import { manejar } from "../_lib/manejador";
import { exigirAdmin, leerSesion } from "../_lib/sesion";
import { diasEntre, estadoPorFecha, fechaTexto, hoyUTC } from "../_lib/suscripcion";

function instante(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  return (valor instanceof Date ? valor : new Date(String(valor))).toISOString();
}

function opcional(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  const texto = String(valor).trim();
  return texto || null;
}

export default manejar(["GET"], async (peticion) => {
  const sesion = exigirAdmin(await leerSesion(peticion));
  const hoy = hoyUTC();

  const [clientes, proyectos, suscripciones, pagos, plantillas, representantes, documentos] =
    await enTransaccion(sesion.usuarioId, sesion.rol, (txn) => [
      txn`select c.id, c.razon_social, c.documento_tipo, c.documento_numero,
                 c.domicilio_fiscal, c.telefono, c.correo_factura, c.creado,
                 c.firma_actual is not null as tiene_firma,
                 (select count(*)::int from firmas_cliente f where f.cliente_id = c.id) as firmas,
                 (select max(e.ocurrido) from eventos e
                   where e.actor = c.usuario_id and e.accion = 'sesion.iniciada') as ultimo_acceso,
                 u.nombre, u.correo, u.correo_verificado, u.bloqueado
          from clientes c
          join usuarios u on u.id = c.usuario_id
          order by c.creado desc`,
      txn`select p.id, p.cliente_id, p.nombre, p.estado, p.dominio,
                 p.plan_clave, p.plan_nivel, p.creado, p.enviado,
                 (select count(*)::int from documentos d where d.proyecto_id = p.id) as documentos,
                 (select count(*)::int from actos_firma a
                   join documentos d on d.id = a.documento_id
                   where d.proyecto_id = p.id and a.firmante = 'representante') as actos_representante,
                 (select count(*)::int from actos_firma a
                   join documentos d on d.id = a.documento_id
                   where d.proyecto_id = p.id and a.firmante = 'cliente') as actos_cliente,
                 (select count(*)::int from envios e
                   join documentos d on d.id = e.documento_id
                   where d.proyecto_id = p.id) as envios,
                 (select max(e.utc) from envios e
                   join documentos d on d.id = e.documento_id
                   where d.proyecto_id = p.id) as ultimo_envio
          from proyectos p
          order by p.creado desc`,
      txn`select s.id, s.proyecto_id, s.estado, s.monto_usd, s.moneda, s.dia_cobro,
                 s.proximo_vencimiento, s.dias_gracia, s.creada, s.actualizada,
                 (select l.estado from licencias l
                   where l.proyecto_id = s.proyecto_id and l.tipo = 'uso'
                   order by l.creado desc limit 1) as licencia,
                 (select count(*)::int from pagos p
                   where p.suscripcion_id = s.id and p.estado = 'registrado'
                     and not exists (select 1 from pagos a where a.anulacion_de = p.id)) as pagos,
                 (select max(p.periodo) from pagos p
                   where p.suscripcion_id = s.id and p.estado = 'registrado'
                     and not exists (select 1 from pagos a where a.anulacion_de = p.id)) as ultimo_periodo
          from suscripciones s
          order by s.creada desc`,
      txn`select p.id, p.suscripcion_id, p.periodo, p.monto, p.moneda, p.tasa_bcv,
                 p.referencia, p.fecha, p.estado, p.anulacion_de, p.motivo, p.creado,
                 exists (select 1 from pagos a where a.anulacion_de = p.id) as tiene_anulacion
          from pagos p
          order by p.fecha desc, p.creado desc`,
      txn`select codigo, version, contenido->>'titulo' as titulo, sha256, activa, publicada
          from plantillas
          order by codigo, version desc`,
      txn`select id, nombre, documento, domicilio, correo, sha256, utc
          from bws_representante()`,
      txn`select d.id, d.proyecto_id, d.plantilla_codigo, d.plantilla_version, d.orden,
                 d.hash_archivo, aj.sha256_original, aj.sha256_ajustado, aj.nota,
                 aj.tamano, aj.utc as ajuste_utc
          from documentos d
          left join lateral (
            select a.sha256_original, a.sha256_ajustado, a.nota, a.utc,
                   octet_length(a.pdf) as tamano
            from documentos_ajustados a
            where a.documento_id = d.id
            order by a.utc desc, a.id
            limit 1
          ) aj on true
          order by d.proyecto_id, d.orden`,
    ]);

  const representanteFila = ((representantes ?? []) as Record<string, unknown>[])[0];

  return json({
    ok: true,
    hoy,
    clientes: ((clientes ?? []) as Record<string, unknown>[]).map((fila) => ({
      id: String(fila.id),
      razon_social: opcional(fila.razon_social),
      documento_tipo: opcional(fila.documento_tipo),
      documento_numero: opcional(fila.documento_numero),
      domicilio: opcional(fila.domicilio_fiscal),
      telefono: String(fila.telefono),
      correo_factura: opcional(fila.correo_factura),
      nombre: String(fila.nombre),
      correo: String(fila.correo),
      verificado: Boolean(fila.correo_verificado),
      bloqueado: Boolean(fila.bloqueado),
      tiene_firma: Boolean(fila.tiene_firma),
      firmas: Number(fila.firmas),
      ultimo_acceso: instante(fila.ultimo_acceso),
      creado: instante(fila.creado),
    })),
    proyectos: ((proyectos ?? []) as Record<string, unknown>[]).map((fila) => ({
      id: String(fila.id),
      cliente_id: String(fila.cliente_id),
      nombre: String(fila.nombre),
      estado: String(fila.estado),
      dominio: String(fila.dominio),
      plan_clave: String(fila.plan_clave),
      plan_nivel: String(fila.plan_nivel),
      documentos: Number(fila.documentos),
      actos_representante: Number(fila.actos_representante),
      actos_cliente: Number(fila.actos_cliente),
      envios: Number(fila.envios),
      ultimo_envio: instante(fila.ultimo_envio),
      creado: instante(fila.creado),
      enviado: instante(fila.enviado),
    })),
    suscripciones: ((suscripciones ?? []) as Record<string, unknown>[]).map((fila) => {
      const vencimiento = fechaTexto(fila.proximo_vencimiento);
      const gracia = Number(fila.dias_gracia);
      return {
        id: String(fila.id),
        proyecto_id: String(fila.proyecto_id),
        estado: String(fila.estado),
        estado_calculado: estadoPorFecha(vencimiento, gracia, hoy),
        monto_usd: Number(fila.monto_usd),
        moneda: String(fila.moneda),
        dia_cobro: Number(fila.dia_cobro),
        proximo_vencimiento: vencimiento,
        dias_gracia: gracia,
        dias_para_vencer: diasEntre(hoy, vencimiento),
        licencia: fila.licencia ? String(fila.licencia) : null,
        pagos: Number(fila.pagos),
        ultimo_periodo: fila.ultimo_periodo ? String(fila.ultimo_periodo) : null,
        creada: instante(fila.creada),
        actualizada: instante(fila.actualizada),
      };
    }),
    pagos: ((pagos ?? []) as Record<string, unknown>[]).map((fila) => ({
      id: String(fila.id),
      suscripcion_id: String(fila.suscripcion_id),
      periodo: String(fila.periodo),
      monto: Number(fila.monto),
      moneda: String(fila.moneda),
      tasa_bcv: fila.tasa_bcv === null ? null : Number(fila.tasa_bcv),
      referencia: String(fila.referencia),
      fecha: fechaTexto(fila.fecha),
      estado: String(fila.estado),
      anulacion_de: fila.anulacion_de ? String(fila.anulacion_de) : null,
      motivo: fila.motivo ? String(fila.motivo) : null,
      anulado: String(fila.estado) === "anulado",
      vigente: String(fila.estado) === "registrado" && !Boolean(fila.tiene_anulacion),
      creado: instante(fila.creado),
    })),
    plantillas: ((plantillas ?? []) as Record<string, unknown>[]).map((fila) => ({
      codigo: String(fila.codigo),
      version: Number(fila.version),
      titulo: String(fila.titulo),
      sha256: String(fila.sha256),
      activa: Boolean(fila.activa),
      publicada: instante(fila.publicada),
    })),
    documentos: ((documentos ?? []) as Record<string, unknown>[]).map((fila) => ({
      id: String(fila.id),
      proyecto_id: String(fila.proyecto_id),
      codigo: String(fila.plantilla_codigo),
      version: Number(fila.plantilla_version),
      orden: Number(fila.orden),
      hash_archivo: String(fila.hash_archivo),
      ajuste: fila.sha256_ajustado
        ? {
            sha256_original: String(fila.sha256_original),
            sha256_ajustado: String(fila.sha256_ajustado),
            tamano: Number(fila.tamano),
            nota: opcional(fila.nota),
            utc: instante(fila.ajuste_utc),
          }
        : null,
    })),
    representante: representanteFila
      ? {
          id: String(representanteFila.id),
          nombre: String(representanteFila.nombre),
          documento: String(representanteFila.documento),
          domicilio: representanteFila.domicilio ? String(representanteFila.domicilio) : null,
          correo: representanteFila.correo ? String(representanteFila.correo) : null,
          sha256: String(representanteFila.sha256),
          utc: instante(representanteFila.utc),
        }
      : null,
  });
});
