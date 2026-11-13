/* ============================================================
   POST /api/admin/documentos/ajustar
   ------------------------------------------------------------
   Blink revisa los PDF generados fuera del sistema —los imprime,
   corrige, anexa la firma manuscrita o el sello— y vuelve a subir
   el archivo de cada documento. El generado no se toca: se agrega
   una fila a `documentos_ajustados` con los dos hashes, quién y
   cuándo. Esa fila es la que se sirve en la descarga, la que viaja
   adjunta al correo y la que se ve en el panel del cliente.

   Dos puertas antes de guardar: si el cliente ya confirmó, su
   consentimiento apunta a los archivos que descargó; si el
   expediente ya salió, el correo adjuntó otros bytes. En los dos
   casos el ajuste se rechaza, no se sobreescribe la historia.

   Se acepta un PDF real (cabecera y cierre), entre 1 KB y 8 MB,
   distinto del generado. Subir el mismo archivo dos veces no crea
   dos filas: responde `reutilizado`.
   ============================================================ */

import { createHash } from "node:crypto";
import { agenteDe, ipDe, json, leerJson, objeto, texto } from "../../_lib/http";
import { exigirOrigen } from "../../_lib/csrf";
import { enTransaccion } from "../../_lib/db";
import { manejar } from "../../_lib/manejador";
import { ErrorHttp } from "../../_lib/respuestas";
import { exigirAdmin, leerSesion } from "../../_lib/sesion";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MINIMO = 1024;
const MAXIMO = 8 * 1024 * 1024;

function instante(valor: unknown): string {
  return (valor instanceof Date ? valor : new Date(String(valor))).toISOString();
}

/** Acepta un base64 pelado o un data URL; devuelve los bytes y su SHA-256. */
function pdfValidado(entrada: unknown): { pdf: Buffer; sha256: string } {
  const limpio = texto(entrada)
    .replace(/^data:application\/pdf;base64,/i, "")
    .replace(/\s+/g, "");
  if (!limpio || !/^[A-Za-z0-9+/]+={0,2}$/.test(limpio)) {
    throw new ErrorHttp(400, "El PDF no llegó como archivo.", "archivo");
  }

  const pdf = Buffer.from(limpio, "base64");
  if (pdf.length < MINIMO) {
    throw new ErrorHttp(400, "El PDF está vacío o es demasiado pequeño.", "archivo");
  }
  if (pdf.length > MAXIMO) {
    throw new ErrorHttp(400, "El PDF supera los 8 MB permitidos.", "archivo");
  }
  if (pdf.subarray(0, 5).toString("latin1") !== "%PDF-") {
    throw new ErrorHttp(400, "El archivo no es un PDF: le falta la cabecera.", "archivo");
  }
  if (!pdf.subarray(-1024).includes("%%EOF")) {
    throw new ErrorHttp(400, "Al PDF le falta el cierre: súbelo otra vez entero.", "archivo");
  }

  return { pdf, sha256: createHash("sha256").update(pdf).digest("hex") };
}

export default manejar(["POST"], async (peticion) => {
  exigirOrigen(peticion);
  const sesion = exigirAdmin(await leerSesion(peticion));

  const cuerpo = objeto(await leerJson<unknown>(peticion));
  const documentoId = texto(cuerpo?.documento_id);
  if (!UUID.test(documentoId)) {
    throw new ErrorHttp(400, "Indica el documento del expediente que ajustaste.", "documento");
  }
  const nota = texto(cuerpo?.nota).slice(0, 500) || null;
  const { pdf, sha256 } = pdfValidado(cuerpo?.pdf);

  const [estado] = await enTransaccion(sesion.usuarioId, sesion.rol, (txn) => [
    txn`select d.proyecto_id, d.hash_archivo,
               exists (
                 select 1 from documentos_ajustados aj
                 where aj.documento_id = d.id and aj.sha256_ajustado = ${sha256}
               ) as repetido,
               exists (
                 select 1 from actos_firma a
                 join documentos m on m.id = a.documento_id
                 where m.proyecto_id = d.proyecto_id and a.firmante = 'cliente'
               ) as confirmado,
               exists (
                 select 1 from envios e
                 join documentos m on m.id = e.documento_id
                 where m.proyecto_id = d.proyecto_id
                   and e.clave_idempotencia like 'expediente/%'
               ) as enviado
        from documentos d
        where d.id = ${documentoId}::uuid`,
  ]);

  const fila = (estado ?? [])[0] as Record<string, unknown> | undefined;
  if (!fila) {
    throw new ErrorHttp(404, "Ese documento no está en ningún expediente.", "documento");
  }
  if (fila.enviado) {
    throw new ErrorHttp(
      409,
      "El expediente ya salió por correo con estos archivos. Un ajuste nuevo se registra antes del envío.",
      "ya_enviado",
    );
  }
  if (fila.confirmado) {
    throw new ErrorHttp(
      409,
      "El cliente ya confirmó el expediente: lo que firmó no se cambia.",
      "ya_confirmado",
    );
  }

  const original = String(fila.hash_archivo);
  if (original === sha256) {
    throw new ErrorHttp(
      400,
      "El archivo que subiste es idéntico al generado: no hay ningún ajuste que registrar.",
      "identico",
    );
  }
  if (fila.repetido) {
    return json({ ok: true, reutilizado: true, sha256_ajustado: sha256 });
  }

  const ip = ipDe(peticion);
  const agente = agenteDe(peticion);

  const [nuevas] = await enTransaccion(sesion.usuarioId, sesion.rol, (txn) => [
    txn`with nueva as (
          insert into documentos_ajustados
            (documento_id, proyecto_id, pdf, sha256_original, sha256_ajustado, nota, actor)
          values (${documentoId}::uuid, ${String(fila.proyecto_id)}::uuid, ${pdf},
                  ${original}, ${sha256}, ${nota}, ${sesion.usuarioId}::uuid)
          on conflict (documento_id, sha256_ajustado) do nothing
          returning id, sha256_ajustado, sha256_original, utc, octet_length(pdf) as tamano
        ), evento as (
          insert into eventos (actor, rol, accion, entidad, entidad_id, detalle, ip, agente)
          select ${sesion.usuarioId}, 'admin', 'documento.ajustado', 'documentos',
                 ${documentoId}::text,
                 jsonb_build_object('ajuste_id', nueva.id::text,
                                    'sha256_original', nueva.sha256_original,
                                    'sha256_ajustado', nueva.sha256_ajustado,
                                    'nota', ${nota}::text),
                 ${ip}, ${agente}
          from nueva
          returning 1
        )
        select id, sha256_ajustado, sha256_original, tamano, utc from nueva`,
  ]);

  const nueva = (nuevas ?? [])[0] as Record<string, unknown> | undefined;
  if (!nueva) {
    return json({ ok: true, reutilizado: true, sha256_ajustado: sha256 });
  }

  return json(
    {
      ok: true,
      reutilizado: false,
      ajuste: {
        id: String(nueva.id),
        documento_id: documentoId,
        sha256_original: String(nueva.sha256_original),
        sha256_ajustado: String(nueva.sha256_ajustado),
        tamano: Number(nueva.tamano),
        utc: instante(nueva.utc),
      },
    },
    201,
  );
});
