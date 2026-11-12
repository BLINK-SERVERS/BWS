/* ============================================================
   Panel de administración
   ------------------------------------------------------------
   Una sola pantalla para la operación de Blink: la firma del
   representante legal, el expediente de cada proyecto (generar,
   verificar la cadena, enviar y descargar), la suscripción con sus
   pagos y la mora, y las plantillas publicadas.

   Ninguna acción escribe dos veces: generar y enviar son
   idempotentes, y los pagos anulados se conservan con su motivo.
   La administración nunca ve la clave de nadie ni puede reemplazar
   la firma original de un cliente.
   ============================================================ */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  api,
  FalloApi,
  guardarDescarga,
  type ClienteAdmin,
  type PanelAdmin,
  type PagoAdmin,
  type ProyectoAdmin,
  type RepresentanteVista,
  type SesionPortal,
  type SuscripcionAdmin,
  type Verificacion,
} from "../datos/api";
import { Campo } from "../componentes/Campo";
import { LienzoFirma, type LienzoFirmaHandle } from "../componentes/LienzoFirma";

const ESTADOS_PROYECTO: Record<string, string> = {
  borrador: "Borrador",
  enviado: "Enviado",
  en_revision: "En revisión",
  aprobado: "Aprobado",
  entregado: "Entregado",
  terminado: "Terminado",
};

const ESTADOS_SUSCRIPCION: Record<string, string> = {
  al_dia: "Al día",
  mora: "En mora",
  suspendida: "Suspendida",
  terminada: "Terminada",
};

function tono(estado: string): string {
  if (estado === "al_dia" || estado === "activa" || estado === "aprobado") {
    return "po-etiqueta po-etiqueta-ok";
  }
  if (estado === "mora" || estado === "suspendida" || estado === "terminada") {
    return "po-etiqueta po-etiqueta-error";
  }
  return "po-etiqueta po-etiqueta-aviso";
}

function Etiqueta({ estado, texto }: { estado: string; texto?: string }) {
  return <span className={tono(estado)}>{texto ?? ESTADOS_SUSCRIPCION[estado] ?? estado}</span>;
}

function mensajeDe(error: unknown, porDefecto: string): string {
  return error instanceof FalloApi ? error.message : porDefecto;
}

/* ------------------------------------------------------------
   Representante legal
   ------------------------------------------------------------ */

function SeccionRepresentante({
  representante,
  alCambiar,
}: {
  representante: RepresentanteVista | null;
  alCambiar: () => Promise<void>;
}) {
  const [abierto, setAbierto] = useState(!representante);
  const [nombre, setNombre] = useState("");
  const [documento, setDocumento] = useState("");
  const [domicilio, setDomicilio] = useState("");
  const [correo, setCorreo] = useState("");
  const [trazo, setTrazo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const lienzo = useRef<LienzoFirmaHandle>(null);

  const guardar = async () => {
    const png = lienzo.current?.png();
    if (!png || !trazo) {
      setFallo("Dibuja la firma del representante antes de guardar.");
      return;
    }
    setGuardando(true);
    setFallo(null);
    setAviso(null);
    try {
      await api.capturarRepresentante({
        nombre: nombre.trim(),
        documento: documento.trim(),
        domicilio: domicilio.trim(),
        correo: correo.trim(),
        png,
      });
      setAviso("Firma del representante capturada. Los expedientes nuevos la usarán.");
      setNombre("");
      setDocumento("");
      setDomicilio("");
      setCorreo("");
      setAbierto(false);
      await alCambiar();
    } catch (error) {
      setFallo(mensajeDe(error, "No pudimos guardar la firma del representante."));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <section className="po-tarjeta" aria-labelledby="po-admin-representante">
      <h2 className="po-tarjeta-titulo" id="po-admin-representante">
        Representante legal
      </h2>
      {representante ? (
        <dl className="po-datos">
          <div>
            <dt>Nombre</dt>
            <dd>{representante.nombre}</dd>
          </div>
          <div>
            <dt>Documento</dt>
            <dd>{representante.documento}</dd>
          </div>
          <div>
            <dt>Domicilio</dt>
            <dd>{representante.domicilio ?? "Sin domicilio: no se puede generar"}</dd>
          </div>
          <div>
            <dt>Correo</dt>
            <dd>{representante.correo ?? "—"}</dd>
          </div>
          <div>
            <dt>Capturada</dt>
            <dd>
              {representante.utc
                ? new Date(representante.utc).toLocaleString("es-VE")
                : "—"}
            </dd>
          </div>
          <div>
            <dt>Huella (SHA-256)</dt>
            <dd>
              <code className="po-hash">{representante.sha256}</code>
            </dd>
          </div>
        </dl>
      ) : (
        <div className="po-nota po-nota-aviso" role="alert">
          <p>
            Falta la firma del representante legal. Sin ella no se puede generar ningún
            expediente.
          </p>
        </div>
      )}

      <p>
        <button
          type="button"
          className="po-boton po-boton-suave"
          onClick={() => setAbierto((valor) => !valor)}
        >
          {abierto ? "Cerrar captura" : "Capturar otra firma"}
        </button>
      </p>

      {abierto ? (
        <form className="po-formulario" onSubmit={(evento) => evento.preventDefault()} noValidate>
          <div className="po-fila">
            <Campo
              id="representante-nombre"
              etiqueta="Nombre completo"
              valor={nombre}
              alCambiar={setNombre}
            />
            <Campo
              id="representante-documento"
              etiqueta="Documento"
              valor={documento}
              alCambiar={setDocumento}
              ayuda="Por ejemplo V-12345678."
            />
          </div>
          <Campo
            id="representante-domicilio"
            etiqueta="Domicilio"
            valor={domicilio}
            alCambiar={setDomicilio}
            ayuda="BWS-CON-004 lo imprime en el encabezado del contrato."
          />
          <Campo
            id="representante-correo"
            etiqueta="Correo (opcional)"
            tipo="email"
            valor={correo}
            alCambiar={setCorreo}
          />
          <div
            className="po-campo"
            role="group"
            aria-labelledby="representante-lienzo-etiqueta"
          >
            <span id="representante-lienzo-etiqueta" className="po-campo-titulo">
              Firma
            </span>
            <LienzoFirma ref={lienzo} habilitado alCambiar={setTrazo} />
          </div>
          <div className="po-firma-acciones">
            <button
              type="button"
              className="po-boton po-boton-suave"
              onClick={() => lienzo.current?.deshacer()}
              disabled={!trazo}
            >
              Deshacer
            </button>
            <button
              type="button"
              className="po-boton po-boton-suave"
              onClick={() => lienzo.current?.borrar()}
              disabled={!trazo}
            >
              Borrar
            </button>
            <button
              type="button"
              className="po-boton po-boton-principal"
              onClick={() => void guardar()}
              disabled={guardando || !trazo}
            >
              {guardando ? "Guardando…" : "Guardar firma"}
            </button>
          </div>
          {fallo ? (
            <p className="po-campo-error" role="alert">
              {fallo}
            </p>
          ) : null}
        </form>
      ) : null}
      {aviso ? (
        <p className="po-nota po-nota-ok" role="status">
          {aviso}
        </p>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------
   Expedientes
   ------------------------------------------------------------ */

function TarjetaExpediente({
  proyecto,
  cliente,
  alCambiar,
}: {
  proyecto: ProyectoAdmin;
  cliente: ClienteAdmin | undefined;
  alCambiar: () => Promise<void>;
}) {
  const [verificacion, setVerificacion] = useState<Verificacion | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const ejecutar = async (clave: string, accion: () => Promise<string>) => {
    setOcupado(clave);
    setFallo(null);
    setAviso(null);
    try {
      setAviso(await accion());
      await alCambiar();
    } catch (error) {
      setFallo(mensajeDe(error, "La operación no se completó."));
    } finally {
      setOcupado(null);
    }
  };

  const generar = () =>
    ejecutar("generar", async () => {
      const respuesta = await api.generarExpediente(proyecto.id);
      return respuesta.reutilizado
        ? "El expediente ya estaba generado."
        : `Expediente generado: ${respuesta.documentos.length} documentos sellados.`;
    });

  const verificar = async () => {
    setOcupado("verificar");
    setFallo(null);
    try {
      setVerificacion(await api.verificarExpediente(proyecto.id));
    } catch (error) {
      setVerificacion(null);
      setFallo(mensajeDe(error, "No pudimos verificar el expediente."));
    } finally {
      setOcupado(null);
    }
  };

  const enviar = () =>
    ejecutar("enviar", async () => {
      const respuesta = await api.enviarExpediente(proyecto.id);
      return respuesta.reutilizado
        ? "El expediente ya había salido: no se envió un segundo correo."
        : `Enviado al cliente con ${respuesta.enviados} adjuntos y copia a Blink.`;
    });

  const descargar = (codigo: string) =>
    ejecutar(`descargar-${codigo}`, async () => {
      guardarDescarga(await api.descargar(codigo, proyecto.id));
      return `Descarga iniciada: ${codigo}.`;
    });

  const listoParaEnviar =
    proyecto.documentos > 0 &&
    proyecto.actos_representante === proyecto.documentos &&
    proyecto.actos_cliente === proyecto.documentos;

  return (
    <div className="po-admin-bloque">
      <header className="po-admin-bloque-cabecera">
        <div>
          <h3>{proyecto.nombre}</h3>
          <p className="po-apagado">
            {cliente ? (cliente.razon_social ?? cliente.nombre) : "Cliente sin ficha"} ·{" "}
            {proyecto.dominio} · {proyecto.plan_clave}/{proyecto.plan_nivel}
          </p>
        </div>
        <Etiqueta
          estado={proyecto.estado}
          texto={ESTADOS_PROYECTO[proyecto.estado] ?? proyecto.estado}
        />
      </header>

      <dl className="po-datos">
        <div>
          <dt>Documentos</dt>
          <dd>{proyecto.documentos} de 8</dd>
        </div>
        <div>
          <dt>Firmas del representante</dt>
          <dd>{proyecto.actos_representante}</dd>
        </div>
        <div>
          <dt>Firmas del cliente</dt>
          <dd>{proyecto.actos_cliente}</dd>
        </div>
        <div>
          <dt>Envíos</dt>
          <dd>
            {proyecto.envios}
            {proyecto.ultimo_envio
              ? ` · ${new Date(proyecto.ultimo_envio).toLocaleString("es-VE")}`
              : ""}
          </dd>
        </div>
      </dl>

      <div className="po-firma-acciones">
        {proyecto.documentos === 0 && proyecto.estado === "enviado" ? (
          <button
            type="button"
            className="po-boton po-boton-principal"
            onClick={() => void generar()}
            disabled={ocupado !== null}
          >
            {ocupado === "generar" ? "Generando…" : "Generar expediente"}
          </button>
        ) : null}
        {proyecto.documentos > 0 ? (
          <>
            <button
              type="button"
              className="po-boton po-boton-suave"
              onClick={() => void verificar()}
              disabled={ocupado !== null}
            >
              {ocupado === "verificar" ? "Verificando…" : "Verificar cadena"}
            </button>
            <button
              type="button"
              className="po-boton po-boton-suave"
              onClick={() => void enviar()}
              disabled={ocupado !== null || !listoParaEnviar}
            >
              {ocupado === "enviar" ? "Enviando…" : "Enviar al cliente"}
            </button>
          </>
        ) : null}
      </div>
      {!listoParaEnviar && proyecto.documentos > 0 ? (
        <p className="po-apagado">
          El envío espera las dos firmas en los ocho documentos.
        </p>
      ) : null}

      {verificacion ? (
        <div className="po-tabla-marco">
          <table>
            <caption className="po-apagado">
              {verificacion.integro && verificacion.completo
                ? "Cadena íntegra y expediente completo."
                : "Hay comprobaciones en falso: revisa cada fila."}
            </caption>
            <thead>
              <tr>
                <th scope="col">Documento</th>
                <th scope="col">Archivo</th>
                <th scope="col">Sello</th>
                <th scope="col">Cadena</th>
                <th scope="col">Firmas</th>
                <th scope="col">Descargar</th>
              </tr>
            </thead>
            <tbody>
              {verificacion.documentos.map((doc) => (
                <tr key={doc.codigo}>
                  <th scope="row">{doc.codigo}</th>
                  <td>{doc.archivo_ok ? "OK" : "FALLA"}</td>
                  <td>{doc.sello_ok ? "OK" : "FALLA"}</td>
                  <td>{doc.cadena_ok ? "OK" : "FALLA"}</td>
                  <td>
                    {doc.actos.representante.hecho ? "R" : "—"}
                    {doc.actos.cliente.hecho ? "C" : "—"}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="po-boton po-boton-suave po-boton-compacto"
                      onClick={() => void descargar(doc.codigo)}
                      disabled={ocupado !== null}
                    >
                      PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {fallo ? (
        <p className="po-campo-error" role="alert">
          {fallo}
        </p>
      ) : null}
      {aviso ? (
        <p className="po-nota po-nota-ok" role="status">
          {aviso}
        </p>
      ) : null}
    </div>
  );
}

function SeccionExpedientes({
  panel,
  alCambiar,
}: {
  panel: PanelAdmin;
  alCambiar: () => Promise<void>;
}) {
  const clientes = useMemo(
    () => new Map(panel.clientes.map((cliente) => [cliente.id, cliente])),
    [panel.clientes],
  );

  return (
    <section className="po-tarjeta" aria-labelledby="po-admin-expedientes">
      <h2 className="po-tarjeta-titulo" id="po-admin-expedientes">
        Expedientes
      </h2>
      {panel.proyectos.length === 0 ? (
        <p className="po-apagado">Todavía no hay proyectos.</p>
      ) : (
        panel.proyectos.map((proyecto) => (
          <TarjetaExpediente
            key={proyecto.id}
            proyecto={proyecto}
            cliente={clientes.get(proyecto.cliente_id)}
            alCambiar={alCambiar}
          />
        ))
      )}
    </section>
  );
}

/* ------------------------------------------------------------
   Suscripciones y pagos
   ------------------------------------------------------------ */

function FormularioPago({
  suscripcion,
  alCambiar,
}: {
  suscripcion: SuscripcionAdmin;
  alCambiar: () => Promise<void>;
}) {
  const [periodo, setPeriodo] = useState(suscripcion.proximo_vencimiento.slice(0, 7));
  const [monto, setMonto] = useState(String(suscripcion.monto_usd));
  const [moneda, setMoneda] = useState<"USD" | "VES">(suscripcion.moneda);
  const [tasa, setTasa] = useState("");
  const [referencia, setReferencia] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const registrar = async () => {
    setGuardando(true);
    setFallo(null);
    setAviso(null);
    try {
      const respuesta = await api.registrarPago({
        suscripcion_id: suscripcion.id,
        periodo,
        monto: Number(monto.replace(",", ".")),
        moneda,
        tasa_bcv: moneda === "VES" ? Number(tasa.replace(",", ".")) : undefined,
        referencia: referencia.trim(),
        fecha,
      });
      setAviso(
        `Pago registrado. La suscripción pasó de «${respuesta.anterior}» a «${respuesta.suscripcion.estado}».`,
      );
      setReferencia("");
      await alCambiar();
    } catch (error) {
      setFallo(mensajeDe(error, "No pudimos registrar el pago."));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <details className="po-admin-detalle">
      <summary>Registrar un pago</summary>
      <div className="po-formulario">
        <div className="po-fila">
          <Campo
            id={`pago-periodo-${suscripcion.id}`}
            etiqueta="Periodo"
            valor={periodo}
            alCambiar={setPeriodo}
            ayuda="Formato AAAA-MM."
          />
          <Campo
            id={`pago-fecha-${suscripcion.id}`}
            etiqueta="Fecha del pago"
            tipo="date"
            valor={fecha}
            alCambiar={setFecha}
          />
        </div>
        <div className="po-fila">
          <Campo
            id={`pago-monto-${suscripcion.id}`}
            etiqueta="Monto"
            valor={monto}
            alCambiar={setMonto}
          />
          <Campo
            id={`pago-moneda-${suscripcion.id}`}
            etiqueta="Moneda"
            modo="select"
            valor={moneda}
            alCambiar={(valor) => setMoneda(valor as "USD" | "VES")}
          >
            <option value="USD">USD</option>
            <option value="VES">VES (bolívares)</option>
          </Campo>
        </div>
        {moneda === "VES" ? (
          <Campo
            id={`pago-tasa-${suscripcion.id}`}
            etiqueta="Tasa BCV"
            valor={tasa}
            alCambiar={setTasa}
            ayuda="Bolívares por dólar a la fecha del pago."
          />
        ) : null}
        <Campo
          id={`pago-referencia-${suscripcion.id}`}
          etiqueta="Referencia"
          valor={referencia}
          alCambiar={setReferencia}
          ayuda="Número de la operación o del comprobante."
        />
        <div className="po-firma-acciones">
          <button
            type="button"
            className="po-boton po-boton-principal"
            onClick={() => void registrar()}
            disabled={guardando}
          >
            {guardando ? "Registrando…" : "Registrar pago"}
          </button>
        </div>
        {fallo ? (
          <p className="po-campo-error" role="alert">
            {fallo}
          </p>
        ) : null}
        {aviso ? (
          <p className="po-nota po-nota-ok" role="status">
            {aviso}
          </p>
        ) : null}
      </div>
    </details>
  );
}

function TarjetaSuscripcion({
  suscripcion,
  proyecto,
  cliente,
  pagos,
  alCambiar,
}: {
  suscripcion: SuscripcionAdmin;
  proyecto: ProyectoAdmin | undefined;
  cliente: ClienteAdmin | undefined;
  pagos: PagoAdmin[];
  alCambiar: () => Promise<void>;
}) {
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [motivoSuspension, setMotivoSuspension] = useState("");
  const [anulando, setAnulando] = useState<string | null>(null);
  const [motivoAnulacion, setMotivoAnulacion] = useState("");

  const ejecutar = async (clave: string, accion: () => Promise<string>) => {
    setOcupado(clave);
    setFallo(null);
    setAviso(null);
    try {
      setAviso(await accion());
      await alCambiar();
    } catch (error) {
      setFallo(mensajeDe(error, "La operación no se completó."));
    } finally {
      setOcupado(null);
    }
  };

  const suspender = () =>
    ejecutar("suspender", async () => {
      const respuesta = await api.suspenderSuscripcion(
        suscripcion.id,
        motivoSuspension.trim() || "Suspensión manual de la administración",
      );
      return respuesta.cambiado
        ? "Suscripción suspendida y licencia bloqueada."
        : "La suscripción ya estaba suspendida.";
    });

  const reactivar = () =>
    ejecutar("reactivar", async () => {
      const respuesta = await api.reactivarSuscripcion(suscripcion.id);
      if (!respuesta.cambiado) return "La suscripción ya estaba activa.";
      return respuesta.aviso
        ? `Suscripción reactivada. ${respuesta.aviso}`
        : "Suscripción reactivada y licencia activa.";
    });

  const anular = (pago: PagoAdmin) =>
    ejecutar(`anular-${pago.id}`, async () => {
      await api.anularPago(pago.id, motivoAnulacion.trim());
      setAnulando(null);
      setMotivoAnulacion("");
      return `Pago del periodo ${pago.periodo} anulado.`;
    });

  return (
    <div className="po-admin-bloque">
      <header className="po-admin-bloque-cabecera">
        <div>
          <h3>{proyecto?.nombre ?? "Proyecto"}</h3>
          <p className="po-apagado">
            {cliente ? (cliente.razon_social ?? cliente.nombre) : "Cliente sin ficha"} · USD{" "}
            {suscripcion.monto_usd} al mes · cobro el día {suscripcion.dia_cobro}
          </p>
        </div>
        <Etiqueta estado={suscripcion.estado} />
      </header>

      <dl className="po-datos">
        <div>
          <dt>Estado según la fecha</dt>
          <dd>
            <Etiqueta estado={suscripcion.estado_calculado} />
          </dd>
        </div>
        <div>
          <dt>Próximo vencimiento</dt>
          <dd>
            {suscripcion.proximo_vencimiento} ·{" "}
            {suscripcion.dias_para_vencer >= 0
              ? `faltan ${suscripcion.dias_para_vencer} días`
              : `venció hace ${Math.abs(suscripcion.dias_para_vencer)} días`}
          </dd>
        </div>
        <div>
          <dt>Gracia</dt>
          <dd>{suscripcion.dias_gracia} días</dd>
        </div>
        <div>
          <dt>Licencia</dt>
          <dd>{suscripcion.licencia ?? "Sin licencia"}</dd>
        </div>
        <div>
          <dt>Pagos vigentes</dt>
          <dd>
            {suscripcion.pagos}
            {suscripcion.ultimo_periodo ? ` · último ${suscripcion.ultimo_periodo}` : ""}
          </dd>
        </div>
      </dl>

      <div className="po-firma-acciones">
        {suscripcion.estado === "suspendida" ? (
          <button
            type="button"
            className="po-boton po-boton-principal"
            onClick={() => void reactivar()}
            disabled={ocupado !== null}
          >
            {ocupado === "reactivar" ? "Reactivando…" : "Reactivar"}
          </button>
        ) : suscripcion.estado === "terminada" ? null : (
          <>
            <input
              className="po-admin-motivo"
              value={motivoSuspension}
              onChange={(evento) => setMotivoSuspension(evento.target.value)}
              placeholder="Motivo de la suspensión"
              aria-label="Motivo de la suspensión"
            />
            <button
              type="button"
              className="po-boton po-boton-suave"
              onClick={() => void suspender()}
              disabled={ocupado !== null}
            >
              {ocupado === "suspender" ? "Suspendiendo…" : "Suspender"}
            </button>
          </>
        )}
      </div>

      <FormularioPago suscripcion={suscripcion} alCambiar={alCambiar} />

      <div className="po-tabla-marco">
        <table>
          <caption className="po-apagado">Pagos registrados y anulados</caption>
          <thead>
            <tr>
              <th scope="col">Periodo</th>
              <th scope="col">Fecha</th>
              <th scope="col">Monto</th>
              <th scope="col">Referencia</th>
              <th scope="col">Estado</th>
              <th scope="col">Acción</th>
            </tr>
          </thead>
          <tbody>
            {pagos.length === 0 ? (
              <tr>
                <td colSpan={6}>Sin pagos registrados.</td>
              </tr>
            ) : (
              pagos.map((pago) => (
                <tr key={pago.id}>
                  <th scope="row">{pago.periodo}</th>
                  <td>{pago.fecha}</td>
                  <td>
                    {pago.monto} {pago.moneda}
                    {pago.tasa_bcv ? ` · BCV ${pago.tasa_bcv}` : ""}
                  </td>
                  <td>{pago.referencia}</td>
                  <td>
                    {pago.estado === "anulado" ? (
                      <span className="po-etiqueta po-etiqueta-error">Anulación</span>
                    ) : pago.vigente ? (
                      <span className="po-etiqueta po-etiqueta-ok">Registrado</span>
                    ) : (
                      <span className="po-etiqueta po-etiqueta-error">Anulado</span>
                    )}
                    {pago.motivo ? (
                      <span className="po-apagado"> · {pago.motivo}</span>
                    ) : null}
                  </td>
                  <td>
                    {pago.vigente ? (
                      anulando === pago.id ? (
                        <div className="po-admin-anulacion">
                          <input
                            value={motivoAnulacion}
                            onChange={(evento) => setMotivoAnulacion(evento.target.value)}
                            placeholder="Motivo"
                            aria-label={`Motivo para anular el pago ${pago.periodo}`}
                          />
                          <button
                            type="button"
                            className="po-boton po-boton-suave po-boton-compacto"
                            onClick={() => void anular(pago)}
                            disabled={ocupado !== null || motivoAnulacion.trim().length < 5}
                          >
                            Confirmar
                          </button>
                          <button
                            type="button"
                            className="po-boton po-boton-suave po-boton-compacto"
                            onClick={() => setAnulando(null)}
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="po-boton po-boton-suave po-boton-compacto"
                          onClick={() => {
                            setAnulando(pago.id);
                            setMotivoAnulacion("");
                          }}
                        >
                          Anular
                        </button>
                      )
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {fallo ? (
        <p className="po-campo-error" role="alert">
          {fallo}
        </p>
      ) : null}
      {aviso ? (
        <p className="po-nota po-nota-ok" role="status">
          {aviso}
        </p>
      ) : null}
    </div>
  );
}

function FormularioSuscripcion({
  proyectos,
  alCambiar,
}: {
  proyectos: ProyectoAdmin[];
  alCambiar: () => Promise<void>;
}) {
  const [proyectoId, setProyectoId] = useState(proyectos[0]?.id ?? "");
  const [dia, setDia] = useState("5");
  const [gracia, setGracia] = useState("5");
  const [moneda, setMoneda] = useState<"USD" | "VES">("USD");
  const [monto, setMonto] = useState("");
  const [vencimiento, setVencimiento] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  const crear = async () => {
    setGuardando(true);
    setFallo(null);
    try {
      await api.crearSuscripcion({
        proyecto_id: proyectoId,
        dia_cobro: Number(dia),
        dias_gracia: Number(gracia),
        moneda,
        monto_usd: monto.trim() ? Number(monto.replace(",", ".")) : undefined,
        proximo_vencimiento: vencimiento || undefined,
      });
      await alCambiar();
    } catch (error) {
      setFallo(mensajeDe(error, "No pudimos crear la suscripción."));
    } finally {
      setGuardando(false);
    }
  };

  if (!proyectos.length) return null;

  return (
    <details className="po-admin-detalle">
      <summary>Crear una suscripción</summary>
      <div className="po-formulario">
        <Campo
          id="suscripcion-proyecto"
          etiqueta="Proyecto"
          modo="select"
          valor={proyectoId}
          alCambiar={setProyectoId}
        >
          {proyectos.map((proyecto) => (
            <option key={proyecto.id} value={proyecto.id}>
              {proyecto.nombre}
            </option>
          ))}
        </Campo>
        <div className="po-fila">
          <Campo
            id="suscripcion-dia"
            etiqueta="Día de cobro"
            valor={dia}
            alCambiar={setDia}
            ayuda="Del 1 al 28."
          />
          <Campo
            id="suscripcion-gracia"
            etiqueta="Días de gracia"
            valor={gracia}
            alCambiar={setGracia}
            ayuda="Del 0 al 60. Al pasar la gracia, la licencia se suspende."
          />
        </div>
        <div className="po-fila">
          <Campo
            id="suscripcion-monto"
            etiqueta="Monto USD (opcional)"
            valor={monto}
            alCambiar={setMonto}
            ayuda="Vacío toma el precio del plan del proyecto."
          />
          <Campo
            id="suscripcion-moneda"
            etiqueta="Moneda de cobro"
            modo="select"
            valor={moneda}
            alCambiar={(valor) => setMoneda(valor as "USD" | "VES")}
          >
            <option value="USD">USD</option>
            <option value="VES">VES (bolívares)</option>
          </Campo>
        </div>
        <Campo
          id="suscripcion-vencimiento"
          etiqueta="Primer vencimiento (opcional)"
          tipo="date"
          valor={vencimiento}
          alCambiar={setVencimiento}
          ayuda="Vacío usa el próximo día de cobro."
        />
        <div className="po-firma-acciones">
          <button
            type="button"
            className="po-boton po-boton-principal"
            onClick={() => void crear()}
            disabled={guardando || !proyectoId}
          >
            {guardando ? "Creando…" : "Crear suscripción"}
          </button>
        </div>
        {fallo ? (
          <p className="po-campo-error" role="alert">
            {fallo}
          </p>
        ) : null}
      </div>
    </details>
  );
}

function SeccionSuscripciones({
  panel,
  alCambiar,
}: {
  panel: PanelAdmin;
  alCambiar: () => Promise<void>;
}) {
  const [recalculando, setRecalculando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);

  const proyectos = useMemo(
    () => new Map(panel.proyectos.map((proyecto) => [proyecto.id, proyecto])),
    [panel.proyectos],
  );
  const clientes = useMemo(
    () => new Map(panel.clientes.map((cliente) => [cliente.id, cliente])),
    [panel.clientes],
  );
  const pagos = useMemo(() => {
    const mapa = new Map<string, PagoAdmin[]>();
    for (const pago of panel.pagos) {
      const lista = mapa.get(pago.suscripcion_id) ?? [];
      lista.push(pago);
      mapa.set(pago.suscripcion_id, lista);
    }
    return mapa;
  }, [panel.pagos]);

  const conSuscripcion = new Set(panel.suscripciones.map((s) => s.proyecto_id));
  const sinSuscripcion = panel.proyectos.filter(
    (proyecto) =>
      !conSuscripcion.has(proyecto.id) && proyecto.estado !== "borrador" && proyecto.estado !== "terminado",
  );

  const recalcular = async () => {
    setRecalculando(true);
    setFallo(null);
    setResultado(null);
    try {
      const respuesta = await api.recalcularSuscripciones();
      setResultado(
        respuesta.cambiadas === 0
          ? "Ninguna suscripción cambió de estado."
          : `${respuesta.cambiadas} suscripción(es) cambiaron de estado.`,
      );
      await alCambiar();
    } catch (error) {
      setFallo(mensajeDe(error, "No pudimos recalcular los estados."));
    } finally {
      setRecalculando(false);
    }
  };

  return (
    <section className="po-tarjeta" aria-labelledby="po-admin-suscripciones">
      <h2 className="po-tarjeta-titulo" id="po-admin-suscripciones">
        Suscripciones, pagos y mora
      </h2>
      <p className="po-apagado">
        El recálculo solo escala: quien pasa a mora o a suspensión no vuelve solo. La
        reactivación exige un pago o una decisión explícita.
      </p>
      <div className="po-firma-acciones">
        <button
          type="button"
          className="po-boton po-boton-suave"
          onClick={() => void recalcular()}
          disabled={recalculando}
        >
          {recalculando ? "Recalculando…" : "Recalcular estados"}
        </button>
      </div>
      {resultado ? (
        <p className="po-nota po-nota-ok" role="status">
          {resultado}
        </p>
      ) : null}
      {fallo ? (
        <p className="po-campo-error" role="alert">
          {fallo}
        </p>
      ) : null}

      <FormularioSuscripcion proyectos={sinSuscripcion} alCambiar={alCambiar} />

      {panel.suscripciones.length === 0 ? (
        <p className="po-apagado">Todavía no hay suscripciones.</p>
      ) : (
        panel.suscripciones.map((suscripcion) => {
          const proyecto = proyectos.get(suscripcion.proyecto_id);
          return (
            <TarjetaSuscripcion
              key={suscripcion.id}
              suscripcion={suscripcion}
              proyecto={proyecto}
              cliente={proyecto ? clientes.get(proyecto.cliente_id) : undefined}
              pagos={pagos.get(suscripcion.id) ?? []}
              alCambiar={alCambiar}
            />
          );
        })
      )}
    </section>
  );
}

/* ------------------------------------------------------------
   Plantillas
   ------------------------------------------------------------ */

function SeccionPlantillas({ plantillas }: { plantillas: PanelAdmin["plantillas"] }) {
  return (
    <section className="po-tarjeta" aria-labelledby="po-admin-plantillas">
      <h2 className="po-tarjeta-titulo" id="po-admin-plantillas">
        Plantillas publicadas
      </h2>
      <p className="po-apagado">
        Solo lectura. Un expediente ya generado conserva la versión que se le estampó.
      </p>
      <div className="po-tabla-marco" tabIndex={0}>
        <table>
          <thead>
            <tr>
              <th scope="col">Código</th>
              <th scope="col">Título</th>
              <th scope="col">Versión</th>
              <th scope="col">Estado</th>
              <th scope="col">SHA-256</th>
            </tr>
          </thead>
          <tbody>
            {plantillas.map((plantilla) => (
              <tr key={`${plantilla.codigo}-${plantilla.version}`}>
                <th scope="row">{plantilla.codigo}</th>
                <td>{plantilla.titulo}</td>
                <td>{plantilla.version}</td>
                <td>
                  <span
                    className={
                      plantilla.activa
                        ? "po-etiqueta po-etiqueta-ok"
                        : "po-etiqueta po-etiqueta-aviso"
                    }
                  >
                    {plantilla.activa ? "Activa" : "Retirada"}
                  </span>
                </td>
                <td>
                  <code className="po-hash">{plantilla.sha256}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------
   Pantalla
   ------------------------------------------------------------ */

export function Admin({ sesion }: { sesion: SesionPortal | null | undefined }) {
  const [panel, setPanel] = useState<PanelAdmin | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setPanel(await api.panelAdmin());
      setFallo(null);
    } catch (error) {
      setFallo(mensajeDe(error, "No pudimos cargar el panel de administración."));
    }
  }, []);

  useEffect(() => {
    if (sesion?.usuario.rol !== "admin") return;
    void cargar();
  }, [sesion, cargar]);

  if (sesion === undefined) {
    return (
      <section className="po-pagina" aria-live="polite" aria-busy="true">
        <p className="po-apagado">Cargando tu cuenta…</p>
      </section>
    );
  }

  if (!sesion || sesion.usuario.rol !== "admin") {
    return (
      <section className="po-pagina po-pagina-angosta" aria-labelledby="po-admin-titulo">
        <h1 className="po-titulo-pagina" id="po-admin-titulo">
          Esta sección es solo para la administración.
        </h1>
        <p className="po-entrada">
          Entra con una cuenta de administración de Blink para gestionar expedientes,
          pagos y licencias.
        </p>
        <p>
          <a className="po-boton po-boton-principal" href={sesion ? "/panel" : "/ingreso"}>
            {sesion ? "Volver al panel" : "Entrar"}
          </a>
        </p>
      </section>
    );
  }

  if (!panel) {
    return (
      <section className="po-pagina" aria-live="polite" aria-busy="true">
        <h1 className="po-titulo-pagina">Administración</h1>
        {fallo ? (
          <p className="po-campo-error" role="alert">
            {fallo}
          </p>
        ) : (
          <p className="po-apagado">Cargando clientes, expedientes y pagos…</p>
        )}
      </section>
    );
  }

  return (
    <section className="po-pagina" aria-labelledby="po-admin-titulo">
      <p className="po-sello">Administración</p>
      <h1 className="po-titulo-pagina" id="po-admin-titulo">
        Operación de Blink
      </h1>
      <p className="po-entrada">
        {panel.clientes.length} clientes · {panel.proyectos.length} proyectos ·{" "}
        {panel.suscripciones.length} suscripciones · hoy {panel.hoy}
      </p>

      {fallo ? (
        <p className="po-campo-error" role="alert">
          {fallo}
        </p>
      ) : null}

      <SeccionRepresentante representante={panel.representante} alCambiar={cargar} />
      <SeccionExpedientes panel={panel} alCambiar={cargar} />
      <SeccionSuscripciones panel={panel} alCambiar={cargar} />
      <SeccionPlantillas plantillas={panel.plantillas} />
    </section>
  );
}
