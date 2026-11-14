/* ============================================================
   Panel de administración
   ------------------------------------------------------------
   La operación de Blink, organizada en cinco módulos: el resumen
   con la cola de lo que hay que hacer hoy, el directorio comercial
   de los clientes, el expediente de cada proyecto (generar,
   verificar la cadena, ajustar los PDF a mano, enviar y descargar)
   con su historial de evidencia, la parte documental —firma del
   representante, plantillas y ajustes— y las finanzas con sus
   pagos y su mora.

   La cola no es una lista de tareas guardada en una tabla: se
   calcula sobre los actos, los envíos y las suscripciones que ya
   existen, así que no se puede quedar desactualizada ni a medias.
   Ninguna acción escribe dos veces: generar y enviar son
   idempotentes, un mismo PDF ajustado registrado dos veces se
   reconoce como repetido, y los pagos anulados se conservan con su
   motivo. La administración nunca ve la clave de nadie ni puede
   reemplazar la firma original de un cliente.
   ============================================================ */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  api,
  FalloApi,
  guardarDataUrl,
  guardarDescarga,
  type ClienteAdmin,
  type DocumentoAdmin,
  type EventoAdmin,
  type PanelAdmin,
  type PagoAdmin,
  type ProyectoAdmin,
  type RepresentanteVista,
  type SesionPortal,
  type SuscripcionAdmin,
  type Verificacion,
} from "../datos/api";
import {
  colaDe,
  DIAS_AVISO,
  etapaPorProyecto,
  ETAPAS,
  ETIQUETA_ETAPA,
  metricasDe,
  porVencer,
  textoDeBusqueda,
  type Accion,
  type Etapa,
  type Pendiente,
} from "../datos/cola";
import { Campo } from "../componentes/Campo";
import { LienzoFirma, type LienzoFirmaHandle } from "../componentes/LienzoFirma";

const PDF_MAXIMO = 8 * 1024 * 1024;

function leerComoDataUrl(archivo: File): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => resolver(String(lector.result));
    lector.onerror = () => rechazar(new Error("El archivo no se pudo leer."));
    lector.readAsDataURL(archivo);
  });
}

/** El color de la etapa: cerrada por mora se ve distinta de entregada. */
const TONO_ETAPA: Record<Etapa, string> = {
  borrador: "po-etiqueta po-etiqueta-aviso",
  ficha: "po-etiqueta po-etiqueta-aviso",
  en_revision: "po-etiqueta po-etiqueta-aviso",
  aprobado: "po-etiqueta po-etiqueta-ok",
  entregado: "po-etiqueta po-etiqueta-ok",
  terminado: "po-etiqueta po-etiqueta-error",
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
  const [bajando, setBajando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const lienzo = useRef<LienzoFirmaHandle>(null);

  /** La firma en PNG sale de su propio GET: el panel no baja la imagen. */
  const descargarFirma = async () => {
    setBajando(true);
    setFallo(null);
    setAviso(null);
    try {
      const respuesta = await api.representante();
      const png = respuesta.representante?.png;
      if (!png || !respuesta.representante) {
        setFallo("Todavía no hay una firma del representante guardada.");
        return;
      }
      guardarDataUrl(
        `firma-representante-${respuesta.representante.sha256.slice(0, 16)}.png`,
        png,
      );
      setAviso("Firma descargada en PNG. Adjúntala al PDF y súbelo en el expediente.");
    } catch (error) {
      setFallo(mensajeDe(error, "No pudimos descargar la firma."));
    } finally {
      setBajando(false);
    }
  };

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
        </button>{" "}
        {representante ? (
          <button
            type="button"
            className="po-boton po-boton-suave"
            onClick={() => void descargarFirma()}
            disabled={bajando}
          >
            {bajando ? "Descargando…" : "Descargar mi firma (PNG)"}
          </button>
        ) : null}
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
        </form>
      ) : null}
      {/* Fuera del formulario: el fallo al descargar la firma también
          tiene que verse cuando el panel de captura está cerrado. */}
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
    </section>
  );
}

/* ------------------------------------------------------------
   Expedientes
   ------------------------------------------------------------ */

/**
 * Subida del PDF ajustado de un documento. El ajuste no reemplaza al
 * generado: agrega una fila con los dos hashes, y es la que se sirve
 * al cliente y la que viaja adjunta al correo.
 */
function ControlAjuste({
  documento,
  alCambiar,
}: {
  documento: DocumentoAdmin;
  alCambiar: () => Promise<void>;
}) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [nota, setNota] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const entrada = useRef<HTMLInputElement>(null);

  const subir = async () => {
    if (!archivo) {
      setFallo("Elige primero el PDF ajustado.");
      return;
    }
    if (archivo.size > PDF_MAXIMO) {
      setFallo("El PDF supera los 8 MB permitidos.");
      return;
    }
    setOcupado(true);
    setFallo(null);
    setAviso(null);
    try {
      const respuesta = await api.ajustarDocumento({
        documento_id: documento.id,
        pdf: await leerComoDataUrl(archivo),
        nota: nota.trim() || undefined,
      });
      setArchivo(null);
      setNota("");
      if (entrada.current) entrada.current.value = "";
      setAviso(
        respuesta.reutilizado
          ? "Ese archivo ya estaba registrado en el expediente."
          : "Ajuste registrado: ese es el PDF que descarga el cliente y el que sale adjunto.",
      );
      await alCambiar();
    } catch (error) {
      setFallo(mensajeDe(error, "No pudimos registrar el ajuste."));
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="po-ajuste">
      <div className="po-campo">
        <label className="po-campo-titulo" htmlFor={`ajuste-${documento.id}`}>
          Archivo ajustado — {documento.codigo}
        </label>
        <input
          ref={entrada}
          id={`ajuste-${documento.id}`}
          type="file"
          accept="application/pdf"
          onChange={(evento) => setArchivo(evento.target.files?.[0] ?? null)}
          disabled={ocupado}
        />
      </div>
      <div className="po-campo">
        <label className="po-campo-titulo" htmlFor={`ajuste-nota-${documento.id}`}>
          Qué se ajustó (opcional)
        </label>
        <input
          id={`ajuste-nota-${documento.id}`}
          type="text"
          maxLength={500}
          value={nota}
          placeholder="Firma manuscrita escaneada, anexo 2 corregido…"
          onChange={(evento) => setNota(evento.target.value)}
          disabled={ocupado}
        />
      </div>
      <button
        type="button"
        className="po-boton po-boton-suave po-boton-compacto"
        onClick={() => void subir()}
        disabled={ocupado || !archivo}
      >
        {ocupado ? "Registrando…" : "Registrar ajuste"}
      </button>
      {fallo ? (
        <p className="po-campo-error" role="alert">
          {fallo}
        </p>
      ) : null}
      {aviso ? (
        <p className="po-apagado" role="status">
          {aviso}
        </p>
      ) : null}
    </div>
  );
}

function TarjetaExpediente({
  proyecto,
  cliente,
  documentos,
  etapa,
  alCambiar,
}: {
  proyecto: ProyectoAdmin;
  cliente: ClienteAdmin | undefined;
  documentos: DocumentoAdmin[];
  etapa: Etapa;
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
        ? "El proyecto ya estaba asignado."
        : `Proyecto asignado: ${respuesta.documentos.length} documentos sellados y disponibles para el cliente.`;
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
    <div className="po-admin-bloque" id={`po-proyecto-${proyecto.id}`}>
      <header className="po-admin-bloque-cabecera">
        <div>
          <h3>{proyecto.nombre}</h3>
          <p className="po-apagado">
            {cliente ? (cliente.razon_social ?? cliente.nombre) : "Cliente sin ficha"} ·{" "}
            {proyecto.dominio} · {proyecto.plan_clave}/{proyecto.plan_nivel}
          </p>
        </div>
        <span className={TONO_ETAPA[etapa]}>{ETIQUETA_ETAPA[etapa]}</span>
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

      {documentos.length > 0 ? (
        <div className="po-tabla-marco" tabIndex={0}>
          <table>
            <caption className="po-apagado">
              Ajuste a mano: descarga el archivo que está en uso —al principio el generado—,
              revísalo y adjunta tu firma si hace falta, y vuelve a subirlo aquí. El cliente
              descarga y recibe el archivo ajustado; el sello y la cadena del expediente
              siguen siendo los del generado.
            </caption>
            <thead>
              <tr>
                <th scope="col">Documento</th>
                <th scope="col">Archivo en uso</th>
                <th scope="col">Subir el ajuste</th>
              </tr>
            </thead>
            <tbody>
              {documentos.map((documento) => (
                <tr key={documento.id}>
                  <th scope="row">
                    {documento.codigo}
                    <button
                      type="button"
                      className="po-boton po-boton-suave po-boton-compacto"
                      onClick={() => void descargar(documento.codigo)}
                      disabled={ocupado !== null}
                    >
                      Bajar archivo en uso
                    </button>
                  </th>
                  <td>
                    {documento.ajuste ? (
                      <div className="po-ajuste-hecho">
                        <span className="po-etiqueta po-etiqueta-ajuste">
                          Ajustado a mano
                        </span>
                        {documento.ajuste.utc ? (
                          <span className="po-apagado">
                            {new Date(documento.ajuste.utc).toLocaleString("es-VE")} ·{" "}
                            {Math.round(documento.ajuste.tamano / 1024)} KB
                          </span>
                        ) : null}
                        {documento.ajuste.nota ? <p>{documento.ajuste.nota}</p> : null}
                        <p className="po-hash">
                          generado {documento.hash_archivo.slice(0, 16)}… · ajustado{" "}
                          {documento.ajuste.sha256_ajustado.slice(0, 16)}…
                        </p>
                      </div>
                    ) : (
                      <p className="po-hash">Generado · {documento.hash_archivo.slice(0, 16)}…</p>
                    )}
                  </td>
                  <td>
                    {proyecto.actos_cliente > 0 || proyecto.envios > 0 ? (
                      <p className="po-apagado">
                        Cerrado: el cliente ya confirmó o el expediente ya salió. Lo que se
                        firmó no se cambia.
                      </p>
                    ) : (
                      <ControlAjuste documento={documento} alCambiar={alCambiar} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="po-firma-acciones">
        {proyecto.documentos === 0 && proyecto.estado === "enviado" ? (
          <button
            type="button"
            className="po-boton po-boton-principal"
            onClick={() => void generar()}
            disabled={ocupado !== null}
          >
            {ocupado === "generar" ? "Asignando…" : "Asignar proyecto"}
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
          El correo sale solo cuando el cliente confirma los ocho documentos. Si ese envío
          falló, este botón lo reintenta.
        </p>
      ) : null}

      {verificacion ? (
        <div className="po-tabla-marco" tabIndex={0}>
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
                <th scope="col">Ajuste</th>
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
                  <td>
                    {doc.ajuste
                      ? doc.ajuste_ok
                        ? "OK"
                        : "FALLA"
                      : "—"}
                  </td>
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

      <HistorialExpediente proyectoId={proyecto.id} />

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
  busqueda,
  alCambiar,
}: {
  panel: PanelAdmin;
  busqueda: string;
  alCambiar: () => Promise<void>;
}) {
  const [etapa, setEtapa] = useState<Etapa | null>(null);

  const clientes = useMemo(
    () => new Map(panel.clientes.map((cliente) => [cliente.id, cliente])),
    [panel.clientes],
  );

  const etapas = useMemo(() => etapaPorProyecto(panel), [panel]);

  const porProyecto = useMemo(() => {
    const mapa = new Map<string, DocumentoAdmin[]>();
    for (const documento of panel.documentos) {
      const lista = mapa.get(documento.proyecto_id);
      if (lista) lista.push(documento);
      else mapa.set(documento.proyecto_id, [documento]);
    }
    for (const lista of mapa.values()) lista.sort((a, b) => a.orden - b.orden);
    return mapa;
  }, [panel.documentos]);

  const conteo = useMemo(() => {
    const mapa = new Map<Etapa, number>();
    for (const clave of etapas.values()) mapa.set(clave, (mapa.get(clave) ?? 0) + 1);
    return mapa;
  }, [etapas]);

  const visibles = panel.proyectos.filter((proyecto) => {
    if (etapa && etapas.get(proyecto.id) !== etapa) return false;
    return coincide(
      `${textoDeBusqueda(clientes.get(proyecto.cliente_id), proyecto)} ${ETIQUETA_ETAPA[etapas.get(proyecto.id) ?? "borrador"]}`,
      busqueda,
    );
  });

  return (
    <section className="po-tarjeta" aria-labelledby="po-admin-expedientes">
      <h2 className="po-tarjeta-titulo" id="po-admin-expedientes">
        Expedientes
      </h2>
      <p className="po-apagado">
        La etapa sale de lo que ya está firmado y enviado, no de un botón que alguien
        arrastró: por eso no se puede quedar diciendo una cosa que la evidencia desmiente.
      </p>

      <div className="po-admin-etapas" role="group" aria-label="Filtrar expedientes por etapa">
        <button
          type="button"
          className={`po-admin-etapa${etapa === null ? " po-admin-etapa-activa" : ""}`}
          aria-pressed={etapa === null}
          onClick={() => setEtapa(null)}
        >
          Todos <span>{panel.proyectos.length}</span>
        </button>
        {ETAPAS.map((entrada) => (
          <button
            key={entrada.clave}
            type="button"
            className={`po-admin-etapa${etapa === entrada.clave ? " po-admin-etapa-activa" : ""}`}
            aria-pressed={etapa === entrada.clave}
            title={entrada.ayuda}
            onClick={() => setEtapa(entrada.clave)}
          >
            {entrada.etiqueta} <span>{conteo.get(entrada.clave) ?? 0}</span>
          </button>
        ))}
      </div>

      {panel.proyectos.length === 0 ? (
        <p className="po-apagado">Todavía no hay proyectos.</p>
      ) : visibles.length === 0 ? (
        <p className="po-apagado">Ningún expediente coincide con el filtro.</p>
      ) : (
        visibles.map((proyecto) => (
          <TarjetaExpediente
            key={proyecto.id}
            proyecto={proyecto}
            cliente={clientes.get(proyecto.cliente_id)}
            documentos={porProyecto.get(proyecto.id) ?? []}
            etapa={etapas.get(proyecto.id) ?? "borrador"}
            alCambiar={alCambiar}
          />
        ))
      )}
    </section>
  );
}

/* ------------------------------------------------------------
   Historial de evidencia de un expediente
   ------------------------------------------------------------ */

const ACCIONES: Record<string, string> = {
  "cuenta.creada": "Cuenta del cliente creada",
  "documento.ajustado": "Documento ajustado a mano",
  "documento.descargado": "Documento descargado",
  "expediente.enviado": "Expediente enviado por correo",
  "expediente.firmado": "El cliente confirmó el expediente",
  "expediente.generado": "Expediente generado y sellado",
  "firma.capturada": "Firma del cliente capturada",
  "pago.anulado": "Pago anulado",
  "pago.registrado": "Pago registrado",
  "proyecto.enviado": "Ficha del proyecto enviada",
  "representante.capturado": "Firma del representante capturada",
  "sesion.cerrada": "Sesión cerrada",
  "sesion.iniciada": "Inicio de sesión",
  "suscripcion.creada": "Suscripción creada",
  "suscripcion.reactivada": "Suscripción reactivada",
  "suscripcion.recalculada": "Estado de la suscripción recalculado",
  "suscripcion.suspendida": "Suscripción suspendida",
  "verificacion.reenviada": "Enlace de verificación reenviado",
};

const CLAVES_DETALLE: Record<string, string> = {
  actos: "actos",
  ajustado: "ajustado",
  ajustados: "ajustes",
  anterior: "antes",
  codigo: "documento",
  copia: "copia",
  correo: "correo",
  hash_archivo: "archivo",
  hash_final: "hash final",
  hash_servido: "archivo servido",
  mensaje_id: "mensaje",
  moneda: "moneda",
  monto: "monto",
  motivo: "motivo",
  nuevo: "ahora",
  nota: "nota",
  periodo: "período",
  proyecto_id: "proyecto",
  proveedor: "proveedor",
  proximo_vencimiento: "vence",
  sha256: "huella",
};

function detalleTexto(detalle: Record<string, unknown> | null): string {
  if (!detalle) return "";
  return Object.entries(detalle)
    .map(([clave, valor]) => {
      // Un `null` en la evidencia significa «sin dato», no la palabra null.
      const texto =
        valor === null || valor === undefined
          ? "—"
          : typeof valor === "object"
            ? Array.isArray(valor)
              ? String(valor.length)
              : JSON.stringify(valor)
            : String(valor);
      const corto = texto.length > 24 ? `${texto.slice(0, 24)}…` : texto;
      return `${CLAVES_DETALLE[clave] ?? clave}: ${corto}`;
    })
    .join(" · ");
}

function HistorialExpediente({ proyectoId }: { proyectoId: string }) {
  const [eventos, setEventos] = useState<EventoAdmin[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  const leer = async () => {
    if (cargando) return;
    setCargando(true);
    setFallo(null);
    try {
      setEventos((await api.historialAdmin(proyectoId)).eventos);
    } catch (error) {
      setFallo(mensajeDe(error, "No pudimos leer el historial."));
    } finally {
      setCargando(false);
    }
  };

  return (
    <details
      className="po-admin-detalle"
      onToggle={(evento) => {
        if (evento.currentTarget.open) void leer();
      }}
    >
      <summary>Historial del expediente</summary>
      {cargando ? (
        <p className="po-apagado" aria-busy="true">
          Consultando la evidencia…
        </p>
      ) : null}
      {fallo ? (
        <p className="po-campo-error" role="alert">
          {fallo}
        </p>
      ) : null}
      {eventos ? (
        eventos.length === 0 ? (
          <p className="po-apagado">Todavía no hay movimientos registrados en este proyecto.</p>
        ) : (
          <div className="po-tabla-marco" tabIndex={0}>
            <table>
              <caption className="po-apagado">
                Los últimos {eventos.length} movimientos. La tabla es de solo agregar: aquí no
                hay nada que editar.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Cuándo</th>
                  <th scope="col">Qué pasó</th>
                  <th scope="col">Quién</th>
                  <th scope="col">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {eventos.map((evento) => (
                  <tr key={evento.id}>
                    <th scope="row">
                      {instanteLegible(evento.ocurrido)}
                    </th>
                    <td>{ACCIONES[evento.accion] ?? evento.accion}</td>
                    <td>
                      {evento.actor ?? "—"}
                      {evento.rol ? ` · ${evento.rol}` : ""}
                    </td>
                    <td>
                      <code className="po-hash">{detalleTexto(evento.detalle) || "—"}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}
    </details>
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
      // El campo periodo se quedó en el mes recién cobrado: volver a pulsar
      // daría 409. Se alinea con la fecha que acabamos de mover.
      setPeriodo(respuesta.suscripcion.proximo_vencimiento.slice(0, 7));
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
    <div className="po-admin-bloque" id={`po-suscripcion-${suscripcion.id}`}>
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

      <div className="po-tabla-marco" tabIndex={0}>
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
    <details className="po-admin-detalle" id="po-alta-suscripcion">
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
  busqueda,
  alCambiar,
}: {
  panel: PanelAdmin;
  busqueda: string;
  alCambiar: () => Promise<void>;
}) {
  const [recalculando, setRecalculando] = useState(false);
  const [soloVencidos, setSoloVencidos] = useState(false);
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

  const metricas = useMemo(() => metricasDe(panel), [panel]);
  const porVencer7 = panel.suscripciones.filter(porVencer).length;
  const visibles = panel.suscripciones.filter((suscripcion) => {
    const proyecto = proyectos.get(suscripcion.proyecto_id);
    const cliente = proyecto ? clientes.get(proyecto.cliente_id) : undefined;
    if (!coincide(textoDeBusqueda(cliente, proyecto), busqueda)) return false;
    return !soloVencidos || porVencer(suscripcion);
  });

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
      <div className="po-admin-metricas">
        <Metrica
          etiqueta="Cobrado este mes"
          valor={`${monto(metricas.cobradoMesUsd, "USD")} · ${monto(metricas.cobradoMesVes, "VES")}`}
          ayuda={`Pagos vigentes del periodo ${panel.hoy.slice(0, 7)}. Los dos montos se cuentan aparte: mezclarlos con una tasa inventada sería mentir.`}
        />
        <Metrica
          etiqueta={`Por cobrar en ${DIAS_AVISO} días`}
          valor={monto(metricas.porCobrarUsd, "USD")}
          ayuda={`${metricas.porCobrarEn7} suscripción(es) vencen pronto. Es el monto de referencia en USD; el cobro en bolívares se cierra con la tasa del día en el propio pago.`}
        />
        <Metrica
          etiqueta="En mora"
          valor={String(metricas.enMora)}
          ayuda="Pasaron el vencimiento y la gracia; la licencia sigue activa hasta la suspensión."
          color={metricas.enMora ? "aviso" : "ok"}
        />
        <Metrica
          etiqueta="Suspendidas"
          valor={String(metricas.suspendidas)}
          ayuda="Sin licencia: el expediente no se puede enviar."
          color={metricas.suspendidas ? "error" : "ok"}
        />
      </div>
      <p className="po-apagado">
        El recálculo solo escala: quien pasa a mora o a suspensión no vuelve solo. La
        reactivación exige un pago o una decisión explícita.
      </p>
      <div className="po-admin-filtros">
        <button
          type="button"
          className={`po-boton po-boton-suave po-admin-chip${soloVencidos ? " po-admin-chip-activo" : ""}`}
          aria-pressed={soloVencidos}
          onClick={() => setSoloVencidos((anterior) => !anterior)}
        >
          Vencen en {DIAS_AVISO} días ({porVencer7})
        </button>
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

      {metricas.pagosAnulados > 0 ? (
        <details className="po-admin-detalle">
          <summary>{metricas.pagosAnulados} pago(s) anulado(s)</summary>
          <ul className="po-admin-lista">
            {panel.pagos
              .filter((pago) => pago.anulado)
              .map((pago) => (
                <li key={pago.id}>
                  Periodo {pago.periodo} · {monto(pago.monto, pago.moneda)} ·{" "}
                  {pago.motivo ?? "sin motivo registrado"}
                </li>
              ))}
          </ul>
        </details>
      ) : null}

      <FormularioSuscripcion proyectos={sinSuscripcion} alCambiar={alCambiar} />

      {panel.suscripciones.length === 0 ? (
        <p className="po-apagado">Todavía no hay suscripciones.</p>
      ) : visibles.length === 0 ? (
        <p className="po-apagado">Ninguna suscripción coincide con el filtro.</p>
      ) : (
        visibles.map((suscripcion) => {
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

function SeccionPlantillas({
  plantillas,
  busqueda,
}: {
  plantillas: PanelAdmin["plantillas"];
  busqueda: string;
}) {
  const visibles = plantillas.filter((plantilla) =>
    coincide(
      `${plantilla.codigo} ${plantilla.titulo} ${plantilla.sha256} ${
        plantilla.activa ? "activa" : "retirada"
      }`.toLowerCase(),
      busqueda,
    ),
  );
  return (
    <section className="po-tarjeta" aria-labelledby="po-admin-plantillas">
      <h2 className="po-tarjeta-titulo" id="po-admin-plantillas">
        Plantillas publicadas
      </h2>
      <p className="po-apagado">
        Solo lectura. Un expediente ya generado conserva la versión que se le estampó.
      </p>
      {visibles.length === 0 ? (
        <p className="po-apagado">Ninguna plantilla coincide con la búsqueda.</p>
      ) : (
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
              {visibles.map((plantilla) => (
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
      )}
    </section>
  );
}

/* ------------------------------------------------------------
   Módulos
   ------------------------------------------------------------
   La operación se recorre por función: resumen, comercial,
   expedientes, documental y finanzas. El módulo se guarda en la
   query (`/admin?modulo=finanzas`) para que el enlace se pueda
   compartir y el recarga no te devuelva al principio. No se usa
   `navegar()`: basta con `replaceState`, porque la ruta sigue
   siendo `/admin` y no hay que volver a pedir la sesión.
   ------------------------------------------------------------ */

type Modulo = "resumen" | "comercial" | "expedientes" | "documental" | "finanzas";

const MODULOS: { clave: Modulo; etiqueta: string; ayuda: string }[] = [
  {
    clave: "resumen",
    etiqueta: "Resumen",
    ayuda: "Qué hay que hacer hoy y cómo va la operación.",
  },
  {
    clave: "comercial",
    etiqueta: "Comercial",
    ayuda: "Clientes, correos verificados y accesos.",
  },
  {
    clave: "expedientes",
    etiqueta: "Expedientes",
    ayuda: "Generar, firmar, ajustar, enviar y descargar.",
  },
  {
    clave: "documental",
    etiqueta: "Documental",
    ayuda: "Firma del representante, plantillas y registro de ajustes.",
  },
  {
    clave: "finanzas",
    etiqueta: "Finanzas",
    ayuda: "Suscripciones, pagos, mora y licencias.",
  },
];

const CLAVES_MODULO = MODULOS.map((modulo) => modulo.clave) as string[];

/**
 * La pantalla y el filtro viven en la dirección: `/admin?modulo=finanzas&q=clinica`
 * se puede compartir, recargar o volver atrás sin perder lo que se estaba buscando.
 */
function parametrosDeQuery(): { modulo: Modulo; busqueda: string } {
  const consulta = new URLSearchParams(window.location.search);
  const crudo = consulta.get("modulo");
  return {
    modulo: crudo && CLAVES_MODULO.includes(crudo) ? (crudo as Modulo) : "resumen",
    busqueda: consulta.get("q") ?? "",
  };
}

function direccionDe(modulo: Modulo, busqueda: string): string {
  const consulta = new URLSearchParams({ modulo });
  if (busqueda.trim()) consulta.set("q", busqueda);
  return `/admin?${consulta.toString()}`;
}

/** A dónde salta cada asunto de la cola. */
const DESTINO: Record<
  Exclude<Accion, null>,
  { modulo: Modulo; ancla: string; conId: boolean; texto: string }
> = {
  representante: {
    modulo: "documental",
    ancla: "po-admin-representante",
    conId: false,
    texto: "Ver representante",
  },
  generar: {
    modulo: "expedientes",
    ancla: "po-proyecto-",
    conId: true,
    texto: "Ver expediente",
  },
  verificar: {
    modulo: "expedientes",
    ancla: "po-proyecto-",
    conId: true,
    texto: "Ver expediente",
  },
  enviar: {
    modulo: "expedientes",
    ancla: "po-proyecto-",
    conId: true,
    texto: "Ver expediente",
  },
  reenviar: {
    modulo: "expedientes",
    ancla: "po-proyecto-",
    conId: true,
    texto: "Ver expediente",
  },
  suscripcion: {
    modulo: "finanzas",
    ancla: "po-alta-suscripcion",
    conId: false,
    texto: "Abrir suscripción",
  },
  cobro: {
    modulo: "finanzas",
    ancla: "po-suscripcion-",
    conId: true,
    texto: "Ver cobro",
  },
  verificacion: {
    modulo: "comercial",
    ancla: "po-cliente-",
    conId: true,
    texto: "Ver cliente",
  },
};

function saltoDe(pendiente: Pendiente): { modulo: Modulo; id: string; texto: string } | null {
  if (!pendiente.accion) return null;
  const base = DESTINO[pendiente.accion];
  const identificador = pendiente.suscripcionId ?? pendiente.proyectoId ?? pendiente.clienteId;
  if (base.conId && !identificador) return null;
  return {
    modulo: base.modulo,
    id: base.conId ? `${base.ancla}${identificador}` : base.ancla,
    texto: base.texto,
  };
}

function contadoresDe(panel: PanelAdmin, pendientes: number): Record<Modulo, number> {
  return {
    resumen: pendientes,
    comercial: panel.clientes.length,
    expedientes: panel.proyectos.length,
    documental: panel.plantillas.filter((plantilla) => plantilla.activa).length,
    finanzas: panel.suscripciones.length,
  };
}

/** Búsqueda tolerante: cada palabra tiene que aparecer, en cualquier orden. */
function coincide(texto: string, busqueda: string): boolean {
  const limpio = busqueda.trim().toLowerCase();
  if (!limpio) return true;
  return limpio.split(/\s+/).every((parte) => texto.includes(parte));
}

const NUMERO = new Intl.NumberFormat("es-VE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Los montos nunca se suman entre monedas: cada uno se muestra en la suya. */
function monto(valor: number, moneda: string): string {
  return `${moneda === "USD" ? "$" : "Bs"} ${NUMERO.format(valor)}`;
}

function tamano(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

/** Un instante en la hora de Venezuela; el sello crudo sigue vivo en los eventos. */
function instanteLegible(valor: string | null | undefined): string {
  if (!valor) return "—";
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? "—" : fecha.toLocaleString("es-VE");
}

function Metrica({
  etiqueta,
  valor,
  ayuda,
  color,
}: {
  etiqueta: string;
  valor: string;
  ayuda: string;
  color?: "ok" | "aviso" | "error";
}) {
  return (
    <div className={`po-admin-metrica${color ? ` po-admin-metrica-${color}` : ""}`}>
      <p className="po-admin-metrica-etiqueta">{etiqueta}</p>
      <p className="po-admin-metrica-valor">{valor}</p>
      <p className="po-apagado">{ayuda}</p>
    </div>
  );
}

function BarraModulos({
  activo,
  contadores,
  alCambiar,
}: {
  activo: Modulo;
  contadores: Record<Modulo, number>;
  alCambiar: (modulo: Modulo) => void;
}) {
  return (
    <nav className="po-admin-modulos" aria-label="Módulos de administración">
      {MODULOS.map((modulo) => (
        <button
          key={modulo.clave}
          type="button"
          className={`po-admin-modulo${activo === modulo.clave ? " po-admin-modulo-activo" : ""}`}
          aria-current={activo === modulo.clave ? "page" : undefined}
          title={modulo.ayuda}
          onClick={() => alCambiar(modulo.clave)}
        >
          {modulo.etiqueta}
          <span className="po-admin-modulo-contador">{contadores[modulo.clave]}</span>
        </button>
      ))}
    </nav>
  );
}

function Buscador({
  valor,
  alCambiar,
}: {
  valor: string;
  alCambiar: (valor: string) => void;
}) {
  return (
    <div className="po-admin-buscador">
      <Campo
        id="po-admin-busqueda"
        etiqueta="Buscar cliente, proyecto, dominio o correo"
        valor={valor}
        alCambiar={alCambiar}
        ayuda="Filtra dentro de todos los módulos. Acepta varias palabras: «Inversiones BWS bws.com.ve»."
      />
    </div>
  );
}

/* ------------------------------------------------------------
   Resumen — la cola sale de la evidencia, no de una tabla
   ------------------------------------------------------------ */

function SeccionResumen({
  panel,
  busqueda,
  alIr,
}: {
  panel: PanelAdmin;
  busqueda: string;
  alIr: (modulo: Modulo, id: string) => void;
}) {
  const pendientes = useMemo(() => colaDe(panel), [panel]);
  const metricas = useMemo(() => metricasDe(panel, pendientes), [panel, pendientes]);
  const visibles = pendientes.filter((pendiente) =>
    coincide(`${pendiente.etiqueta} ${pendiente.detalle}`.toLowerCase(), busqueda),
  );
  // Solo cuenta lo que ya se puede mandar: un borrador sin ficha no es un
  // expediente «sin enviar», es un expediente que todavía no existe, y el que
  // está en revisión espera al cliente, no a Blink.
  const listosSinEnviar = metricas.porEtapa.aprobado;

  return (
    <section className="po-tarjeta" aria-labelledby="po-admin-resumen">
      <h2 className="po-tarjeta-titulo" id="po-admin-resumen">
        Hoy
      </h2>
      <div className="po-admin-metricas">
        <Metrica
          etiqueta="Clientes"
          valor={String(metricas.clientes)}
          ayuda={
            metricas.clientesSinVerificar
              ? `${metricas.clientesSinVerificar} con el correo sin verificar.`
              : "Todos con el correo confirmado."
          }
          color={metricas.clientesSinVerificar ? "aviso" : "ok"}
        />
        <Metrica
          etiqueta="Proyectos"
          valor={String(metricas.proyectos)}
          ayuda={`${metricas.pendientes} asunto(s) abiertos en la cola.`}
          color={metricas.pendientes ? "aviso" : "ok"}
        />
        <Metrica
          etiqueta="Cobrado este mes"
          valor={`${monto(metricas.cobradoMesUsd, "USD")} · ${monto(metricas.cobradoMesVes, "VES")}`}
          ayuda={`Pagos vigentes del periodo ${panel.hoy.slice(0, 7)}.`}
        />
        <Metrica
          etiqueta="En mora"
          valor={String(metricas.enMora)}
          ayuda={`${metricas.suspendidas} con la licencia suspendida.`}
          color={metricas.suspendidas ? "error" : metricas.enMora ? "aviso" : "ok"}
        />
        <Metrica
          etiqueta="Listos para entregar"
          valor={String(listosSinEnviar)}
          ayuda={`${metricas.porEtapa.en_revision} esperando que el cliente confirme · ${metricas.expedientesEntregados} ya salieron por correo.`}
          color={listosSinEnviar ? "aviso" : "ok"}
        />
        <Metrica
          etiqueta="Ajustados a mano"
          valor={String(metricas.documentosAjustados)}
          ayuda="PDF corregidos por Blink y registrados con su huella."
        />
      </div>

      {metricas.proyectos > 0 ? (
        <div className="po-admin-tablero">
          <p className="po-admin-tablero-titulo">Dónde están los expedientes</p>
          <div className="po-barra" aria-hidden="true">
            {ETAPAS.map((etapa) => {
              const n = metricas.porEtapa[etapa.clave];
              if (!n) return null;
              return (
                <span
                  key={etapa.clave}
                  className={`po-barra-segmento po-barra-${etapa.clave}`}
                  style={{ width: `${(n / metricas.proyectos) * 100}%` }}
                  title={`${etapa.etiqueta}: ${n}`}
                />
              );
            })}
          </div>
          <p className="po-apagado">
            {ETAPAS.filter((etapa) => metricas.porEtapa[etapa.clave] > 0)
              .map((etapa) => `${etapa.etiqueta} ${metricas.porEtapa[etapa.clave]}`)
              .join(" · ") || "Todavía no hay proyectos."}
          </p>
        </div>
      ) : null}

      <h3 className="po-admin-subtitulo">Cola de trabajo</h3>
      {pendientes.length === 0 ? (
        <p className="po-nota po-nota-ok">
          No hay nada pendiente: cada expediente está enviado y cada cobro, al día.
        </p>
      ) : visibles.length === 0 ? (
        <p className="po-apagado">Ningún asunto de la cola coincide con la búsqueda.</p>
      ) : (
        <ol className="po-admin-cola">
          {visibles.map((pendiente) => {
            const salto = saltoDe(pendiente);
            return (
              <li key={pendiente.id} className="po-admin-cola-item">
                <div>
                  <p className="po-admin-cola-etiqueta">{pendiente.etiqueta}</p>
                  <p className="po-apagado">{pendiente.detalle}</p>
                </div>
                {salto ? (
                  <button
                    type="button"
                    className="po-boton po-boton-suave"
                    onClick={() => alIr(salto.modulo, salto.id)}
                  >
                    {salto.texto}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

/* ------------------------------------------------------------
   Comercial — el directorio de clientes
   ------------------------------------------------------------ */

function SeccionClientes({
  panel,
  busqueda,
  alIr,
}: {
  panel: PanelAdmin;
  busqueda: string;
  alIr: (modulo: Modulo, id: string) => void;
}) {
  const porCliente = useMemo(() => {
    const mapa = new Map<string, ProyectoAdmin[]>();
    for (const proyecto of panel.proyectos) {
      const lista = mapa.get(proyecto.cliente_id) ?? [];
      lista.push(proyecto);
      mapa.set(proyecto.cliente_id, lista);
    }
    return mapa;
  }, [panel.proyectos]);

  const visibles = panel.clientes.filter((cliente) => {
    const proyectos = porCliente.get(cliente.id) ?? [];
    const texto = [
      textoDeBusqueda(cliente, null),
      ...proyectos.map((proyecto) => textoDeBusqueda(null, proyecto)),
    ].join(" ");
    return coincide(texto, busqueda);
  });

  return (
    <section className="po-tarjeta" aria-labelledby="po-admin-clientes">
      <h2 className="po-tarjeta-titulo" id="po-admin-clientes">
        Clientes
      </h2>
      <p className="po-apagado">
        Ficha fiscal, correo y accesos. La administración no ve la clave de nadie: solo si
        el correo está verificado, si la cuenta tiene una sesión abierta ahora mismo,
        cuándo entró por última vez y si está bloqueada.
      </p>
      {panel.clientes.length === 0 ? (
        <p className="po-apagado">Todavía no hay clientes dados de alta.</p>
      ) : visibles.length === 0 ? (
        <p className="po-apagado">Ningún cliente coincide con la búsqueda.</p>
      ) : (
        <div className="po-tabla-marco" tabIndex={0}>
          <table>
            <caption className="po-apagado">
              {visibles.length} de {panel.clientes.length} cliente(s).
            </caption>
            <thead>
              <tr>
                <th scope="col">Cliente</th>
                <th scope="col">Correo</th>
                <th scope="col">Teléfono</th>
                <th scope="col">Domicilio</th>
                <th scope="col">Firma</th>
                <th scope="col">Proyectos</th>
                <th scope="col">Última actividad</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((cliente) => {
                const proyectos = porCliente.get(cliente.id) ?? [];
                return (
                  <tr key={cliente.id} id={`po-cliente-${cliente.id}`}>
                    <th scope="row">
                      <span className="po-admin-celda-titulo">
                        {cliente.razon_social ?? cliente.nombre}
                      </span>
                      <span className="po-apagado">
                        {cliente.nombre}
                        {cliente.documento_numero
                          ? ` · ${cliente.documento_tipo ?? "documento"} ${cliente.documento_numero}`
                          : ""}
                      </span>
                    </th>
                    <td>
                      {cliente.correo}
                      <span
                        className={
                          cliente.verificado
                            ? "po-etiqueta po-etiqueta-ok"
                            : "po-etiqueta po-etiqueta-aviso"
                        }
                      >
                        {cliente.verificado ? "Verificado" : "Sin verificar"}
                      </span>
                      {cliente.bloqueado ? (
                        <span className="po-etiqueta po-etiqueta-error">Bloqueada</span>
                      ) : null}
                    </td>
                    <td>{cliente.telefono}</td>
                    <td>{cliente.domicilio ?? "—"}</td>
                    <td>
                      {cliente.tiene_firma
                        ? `${cliente.firmas} firma(s)`
                        : "Sin firma capturada"}
                    </td>
                    <td>
                      {proyectos.length === 0 ? (
                        <span className="po-apagado">Ninguno</span>
                      ) : (
                        proyectos.map((proyecto) => (
                          <button
                            key={proyecto.id}
                            type="button"
                            className="po-admin-enlace"
                            onClick={() => alIr("expedientes", `po-proyecto-${proyecto.id}`)}
                          >
                            {proyecto.nombre}
                          </button>
                        ))
                      )}
                    </td>
                    <td>
                      {instanteLegible(cliente.ultimo_acceso ?? cliente.creado)}
                      {cliente.sesiones_vivas > 0 ? (
                        <span className="po-etiqueta po-etiqueta-ok">
                          {cliente.sesiones_vivas > 1
                            ? `${cliente.sesiones_vivas} sesiones abiertas`
                            : "Sesión abierta"}
                        </span>
                      ) : (
                        <span className="po-etiqueta">Sin sesión abierta</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------
   Documental — registro de ajustes a mano
   ------------------------------------------------------------ */

const DIAS_REGISTRO = 90;

function SeccionAjustes({ panel, busqueda }: { panel: PanelAdmin; busqueda: string }) {
  const proyectos = useMemo(
    () => new Map(panel.proyectos.map((proyecto) => [proyecto.id, proyecto])),
    [panel.proyectos],
  );
  const clientes = useMemo(
    () => new Map(panel.clientes.map((cliente) => [cliente.id, cliente])),
    [panel.clientes],
  );

  const filas = panel.documentos
    .filter((documento) => documento.ajuste)
    .map((documento) => {
      const proyecto = proyectos.get(documento.proyecto_id);
      const ajuste = documento.ajuste as NonNullable<DocumentoAdmin["ajuste"]>;
      return { documento, proyecto, ajuste };
    })
    .filter(({ ajuste }) => {
      const desde = ajuste.utc ? Date.parse(`${ajuste.utc.slice(0, 10)}T00:00:00Z`) : Number.NaN;
      const hoy = Date.parse(`${panel.hoy}T00:00:00Z`);
      return Number.isFinite(desde) && hoy - desde <= DIAS_REGISTRO * 86_400_000;
    })
    .filter(({ documento, proyecto, ajuste }) =>
      coincide(
        `${textoDeBusqueda(
          proyecto ? clientes.get(proyecto.cliente_id) : null,
          proyecto,
        )} ${documento.codigo} ${ajuste.nota ?? ""}`,
        busqueda,
      ),
    )
    .sort((a, b) => (b.ajuste.utc ?? "").localeCompare(a.ajuste.utc ?? ""));

  return (
    <section className="po-tarjeta" aria-labelledby="po-admin-ajustes">
      <h2 className="po-tarjeta-titulo" id="po-admin-ajustes">
        Ajustes a mano
      </h2>
      <p className="po-apagado">
        Últimos {DIAS_REGISTRO} días. El PDF generado no se reemplaza: el archivo ajustado
        se registra a lado, con las dos huellas, y es el que se sirve y el que sale por
        correo. El sello y la cadena del expediente no se tocan. Quién lo subió está en el
        historial del expediente.
      </p>
      {filas.length === 0 ? (
        <p className="po-apagado">
          Ningún documento tiene un ajuste registrado en estos días.
        </p>
      ) : (
        <div className="po-tabla-marco" tabIndex={0}>
          <table>
            <caption className="po-apagado">{filas.length} ajuste(s).</caption>
            <thead>
              <tr>
                <th scope="col">Documento</th>
                <th scope="col">Generado (SHA-256)</th>
                <th scope="col">Ajustado (SHA-256)</th>
                <th scope="col">Peso</th>
                <th scope="col">Nota</th>
                <th scope="col">Cuándo</th>
              </tr>
            </thead>
            <tbody>
              {filas.map(({ documento, proyecto, ajuste }) => (
                <tr key={documento.id}>
                  <th scope="row">
                    <span className="po-admin-celda-titulo">
                      {documento.codigo} v{documento.version}
                    </span>
                    <span className="po-apagado">{proyecto?.nombre ?? "Proyecto borrado"}</span>
                  </th>
                  <td>
                    <code className="po-hash">{ajuste.sha256_original}</code>
                  </td>
                  <td>
                    <code className="po-hash">{ajuste.sha256_ajustado}</code>
                  </td>
                  <td>{tamano(ajuste.tamano)}</td>
                  <td>{ajuste.nota ?? "—"}</td>
                  <td>{ajuste.utc ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------
   Pantalla
   ------------------------------------------------------------ */

export function Admin({ sesion }: { sesion: SesionPortal | null | undefined }) {
  const [panel, setPanel] = useState<PanelAdmin | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const [modulo, setModulo] = useState<Modulo>(() => parametrosDeQuery().modulo);
  const [busqueda, setBusqueda] = useState<string>(() => parametrosDeQuery().busqueda);
  const [enfocar, setEnfocar] = useState<string | null>(null);

  // Dos `cargar()` seguidos —un refresco mientras el anterior termina—
  // pueden volver desordenados: gana siempre el último que se pidió.
  const ultimaCarga = useRef(0);
  const cargar = useCallback(async () => {
    const numero = ++ultimaCarga.current;
    try {
      const datos = await api.panelAdmin();
      if (numero !== ultimaCarga.current) return;
      setPanel(datos);
      setFallo(null);
    } catch (error) {
      if (numero !== ultimaCarga.current) return;
      setFallo(mensajeDe(error, "No pudimos cargar el panel de administración."));
    }
  }, []);

  useEffect(() => {
    if (sesion?.usuario.rol !== "admin") return;
    void cargar();
  }, [sesion, cargar]);

  const pendientes = useMemo(() => (panel ? colaDe(panel) : []), [panel]);

  const fijar = useCallback((nuevo: Modulo, texto: string) => {
    setModulo(nuevo);
    setBusqueda(texto);
    window.history.replaceState(null, "", direccionDe(nuevo, texto));
  }, []);

  const irA = useCallback(
    (nuevo: Modulo, id?: string) => {
      // Un salto tiene que encontrar su destino: el filtro activo puede
      // taparlo. Cambiar de módulo a secas sí conserva la búsqueda.
      fijar(nuevo, id ? "" : busqueda);
      if (id) setEnfocar(id);
    },
    [busqueda, fijar],
  );

  useEffect(() => {
    if (!enfocar) return;
    setEnfocar(null);
    const elemento = document.getElementById(enfocar);
    if (!elemento) return;
    if (elemento instanceof HTMLDetailsElement) elemento.open = true;
    elemento.scrollIntoView({ block: "center" });
  }, [enfocar]);

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

      <Buscador valor={busqueda} alCambiar={(texto) => fijar(modulo, texto)} />
      <BarraModulos
        activo={modulo}
        contadores={contadoresDe(panel, pendientes.length)}
        alCambiar={(nuevo) => irA(nuevo)}
      />

      {modulo === "resumen" ? (
        <SeccionResumen panel={panel} busqueda={busqueda} alIr={irA} />
      ) : null}
      {modulo === "comercial" ? (
        <SeccionClientes panel={panel} busqueda={busqueda} alIr={irA} />
      ) : null}
      {modulo === "expedientes" ? (
        <SeccionExpedientes panel={panel} busqueda={busqueda} alCambiar={cargar} />
      ) : null}
      {modulo === "documental" ? (
        <>
          <SeccionRepresentante representante={panel.representante} alCambiar={cargar} />
          <SeccionAjustes panel={panel} busqueda={busqueda} />
          <SeccionPlantillas plantillas={panel.plantillas} busqueda={busqueda} />
        </>
      ) : null}
      {modulo === "finanzas" ? (
        <SeccionSuscripciones panel={panel} busqueda={busqueda} alCambiar={cargar} />
      ) : null}
    </section>
  );
}
