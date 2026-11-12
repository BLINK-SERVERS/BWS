/* ============================================================
   Panel del cliente
   ------------------------------------------------------------
   Lo que ya está hecho: cuenta, ficha fiscal, firma y el alta
   del proyecto con sus anexos. El expediente firmado llega con
   la siguiente entrega; aquí no se promete una pantalla que
   todavía no existe.
   ============================================================ */

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  api,
  FalloApi,
  guardarDescarga,
  type DocumentoExpediente,
  type ProyectoVista,
  type SesionPortal,
  type VistaSuscripcionCliente,
} from "../datos/api";
import { Firma } from "../componentes/Firma";

const ESTADOS: Record<string, string> = {
  borrador: "Borrador",
  enviado: "Enviado",
  en_revision: "En revisión",
  aprobado: "Aprobado",
  entregado: "Entregado",
  terminado: "Terminado",
};

function Dato({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div>
      <dt>{titulo}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function TarjetaProyecto() {
  const [proyecto, setProyecto] = useState<ProyectoVista | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vigente = true;
    api
      .proyecto()
      .then((respuesta) => {
        if (vigente) setProyecto(respuesta.proyecto);
      })
      .catch(() => {
        if (vigente) setProyecto(null);
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, []);

  return (
    <section className="po-tarjeta" aria-labelledby="po-proyecto-titulo">
      <h2 className="po-tarjeta-titulo" id="po-proyecto-titulo">
        Proyecto
      </h2>
      {cargando ? (
        <p className="po-apagado" aria-live="polite">
          Consultando tu proyecto…
        </p>
      ) : proyecto ? (
        <>
          <dl className="po-datos">
            <Dato titulo="Nombre">{proyecto.nombre}</Dato>
            <Dato titulo="Estado">
              <span
                className={
                  proyecto.estado === "borrador"
                    ? "po-etiqueta po-etiqueta-aviso"
                    : "po-etiqueta po-etiqueta-ok"
                }
              >
                {ESTADOS[proyecto.estado] ?? proyecto.estado}
              </span>
            </Dato>
            <Dato titulo="Plan de infraestructura">
              {proyecto.plan.nombre} ·{" "}
              {proyecto.plan.precio_usd === 0
                ? "sin costo mensual"
                : `USD ${proyecto.plan.precio_usd}/mes`}
            </Dato>
            <Dato titulo="Dominio">{proyecto.dominio}</Dato>
          </dl>
          <p>
            <a className="po-boton po-boton-suave" href="/proyecto">
              {proyecto.estado === "borrador" ? "Continuar el borrador" : "Ver el proyecto enviado"}
            </a>
          </p>
        </>
      ) : (
        <>
          <p className="po-apagado">
            Todavía no describiste tu proyecto. El alcance, el dominio, los buzones y el
            plan de infraestructura se convierten en el anexo A y el anexo B del contrato.
          </p>
          <p>
            <a className="po-boton po-boton-principal" href="/proyecto">
              Describir mi proyecto
            </a>
          </p>
        </>
      )}
    </section>
  );
}

function TarjetaLicencia() {
  const [vista, setVista] = useState<VistaSuscripcionCliente | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    api
      .suscripcionCliente()
      .then((respuesta) => {
        if (vigente) {
          setVista(respuesta);
          setFallo(null);
        }
      })
      .catch((error) => {
        if (!vigente) return;
        if (error instanceof FalloApi && error.estado === 404) {
          setVista(null);
          return;
        }
        setFallo(
          error instanceof FalloApi ? error.message : "No pudimos consultar tu licencia.",
        );
      });
    return () => {
      vigente = false;
    };
  }, []);

  const suscripcion = vista?.suscripcion ?? null;
  if (!vista || !vista.proyecto) {
    return fallo ? (
      <section className="po-tarjeta" aria-labelledby="po-licencia-titulo">
        <h2 className="po-tarjeta-titulo" id="po-licencia-titulo">
          Licencia de uso
        </h2>
        <p className="po-campo-error" role="alert">
          {fallo}
        </p>
      </section>
    ) : null;
  }

  const etiqueta =
    suscripcion?.estado === "al_dia"
      ? "po-etiqueta po-etiqueta-ok"
      : suscripcion?.estado === "mora"
        ? "po-etiqueta po-etiqueta-aviso"
        : "po-etiqueta po-etiqueta-error";

  const terminada =
    suscripcion?.estado === "terminada" || suscripcion?.licencia === "terminada";

  return (
    <section className="po-tarjeta" aria-labelledby="po-licencia-titulo">
      <h2 className="po-tarjeta-titulo" id="po-licencia-titulo">
        Licencia de uso
      </h2>
      {suscripcion ? (
        <>
          <dl className="po-datos">
            <Dato titulo="Estado">
              <span className={etiqueta}>
                {suscripcion.estado === "al_dia"
                  ? "Al día"
                  : suscripcion.estado === "mora"
                    ? "En mora"
                    : suscripcion.estado === "suspendida"
                      ? "Suspendida"
                      : "Terminada"}
              </span>
            </Dato>
            <Dato titulo="Monto">
              {suscripcion.monto_usd === 0
                ? "Sin costo mensual"
                : `USD ${suscripcion.monto_usd}/mes`}
            </Dato>
            <Dato titulo="Próximo pago">
              {suscripcion.proximo_vencimiento}
              {suscripcion.dias_para_vencer >= 0
                ? ` · faltan ${suscripcion.dias_para_vencer} días`
                : ` · venció hace ${Math.abs(suscripcion.dias_para_vencer)} días`}
            </Dato>
            <Dato titulo="Licencia">
              {suscripcion.licencia === "activa"
                ? "Activa"
                : (suscripcion.licencia ?? "Sin registrar")}
            </Dato>
          </dl>
          {suscripcion.bloqueada ? (
            <div className="po-nota po-nota-aviso" role="alert">
              <p>
                {terminada
                  ? "La licencia terminó: no se generan documentos nuevos. Tus datos siguen disponibles para exportarlos y el dominio sigue a tu nombre."
                  : "La licencia está suspendida: no se generan documentos nuevos. Tus datos siguen disponibles para exportarlos y el dominio sigue a tu nombre."}{" "}
                Escríbenos a{" "}
                <a href="mailto:business@blink.com.ve">business@blink.com.ve</a>{" "}
                {terminada ? "para acordar la exportación." : "para regularizar el pago."}
              </p>
            </div>
          ) : null}
          {vista.pagos.length > 0 ? (
            <div className="po-tabla-marco">
              <table>
                <caption className="po-apagado">Pagos registrados</caption>
                <thead>
                  <tr>
                    <th scope="col">Periodo</th>
                    <th scope="col">Fecha</th>
                    <th scope="col">Monto</th>
                    <th scope="col">Referencia</th>
                  </tr>
                </thead>
                <tbody>
                  {vista.pagos.map((pago) => (
                    <tr key={pago.id}>
                      <th scope="row">{pago.periodo}</th>
                      <td>{pago.fecha}</td>
                      <td>
                        {pago.monto} {pago.moneda}
                      </td>
                      <td>{pago.referencia}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="po-apagado">Todavía no hay pagos registrados.</p>
          )}
        </>
      ) : (
        <p className="po-apagado">
          La infraestructura del proyecto todavía no tiene una suscripción registrada. Si
          elegiste un plan con costo mensual, Blink la activa al aprobar el proyecto.
        </p>
      )}
    </section>
  );
}

function TarjetaExpediente() {
  const [documentos, setDocumentos] = useState<DocumentoExpediente[] | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const respuesta = await api.documentosCliente();
      setDocumentos(respuesta.documentos);
      setFallo(null);
    } catch (error) {
      if (error instanceof FalloApi && error.estado === 404) {
        setDocumentos([]);
        return;
      }
      setFallo(
        error instanceof FalloApi ? error.message : "No pudimos cargar tu expediente.",
      );
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const descargar = async (codigo: string) => {
    setOcupado(codigo);
    setFallo(null);
    try {
      guardarDescarga(await api.descargar(codigo));
    } catch (error) {
      setFallo(
        error instanceof FalloApi ? error.message : "No pudimos descargar el documento.",
      );
    } finally {
      setOcupado(null);
    }
  };

  const firmar = async () => {
    setOcupado("firmar");
    setFallo(null);
    setAviso(null);
    try {
      const respuesta = await api.firmarExpediente();
      setAviso(
        `Confirmaste ${respuesta.actos} de ${respuesta.documentos} documentos. El expediente se envía por correo cuando la administración lo cierra.`,
      );
      await cargar();
    } catch (error) {
      setFallo(
        error instanceof FalloApi ? error.message : "No pudimos registrar tu confirmación.",
      );
    } finally {
      setOcupado(null);
    }
  };

  if (!documentos || documentos.length === 0) return null;

  const firmados = documentos.filter((documento) => documento.firmado).length;
  const completo = firmados === documentos.length;

  return (
    <section className="po-tarjeta" aria-labelledby="po-expediente-titulo">
      <h2 className="po-tarjeta-titulo" id="po-expediente-titulo">
        Expediente
      </h2>
      <p className="po-entrada">
        Tu expediente reúne el contrato y sus anexos. Cada descarga queda auditada.
      </p>
      <div className="po-tabla-marco">
        <table>
          <thead>
            <tr>
              <th scope="col">Documento</th>
              <th scope="col">Versión</th>
              <th scope="col">Tu confirmación</th>
              <th scope="col">Descargar</th>
            </tr>
          </thead>
          <tbody>
            {documentos.map((documento) => (
              <tr key={documento.codigo}>
                <th scope="row">
                  {documento.codigo} · {documento.titulo}
                </th>
                <td>{documento.version}</td>
                <td>
                  {documento.firmado ? (
                    <span className="po-etiqueta po-etiqueta-ok">Confirmado</span>
                  ) : (
                    <span className="po-etiqueta po-etiqueta-aviso">Pendiente</span>
                  )}
                </td>
                <td>
                  <button
                    type="button"
                    className="po-boton po-boton-suave po-boton-compacto"
                    onClick={() => void descargar(documento.codigo)}
                    disabled={ocupado !== null}
                  >
                    {ocupado === documento.codigo ? "Descargando…" : "PDF"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {completo ? (
        <p className="po-nota po-nota-ok" role="status">
          Confirmaste los {documentos.length} documentos. El envío por correo lo hace la
          administración.
        </p>
      ) : (
        <>
          <p className="po-apagado">
            Confirmar el expediente registra tu acto de firma en cada documento con la
            firma electrónica simple que capturaste una sola vez. No es una firma
            certificada.
          </p>
          <div className="po-firma-acciones">
            <button
              type="button"
              className="po-boton po-boton-principal"
              onClick={() => void firmar()}
              disabled={ocupado !== null}
            >
              {ocupado === "firmar" ? "Confirmando…" : "Confirmar el expediente"}
            </button>
          </div>
        </>
      )}

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

export function Panel({
  sesion,
  recargar,
}: {
  sesion: SesionPortal | null | undefined;
  recargar: () => Promise<void>;
}) {
  if (sesion === undefined) {
    return (
      <section className="po-pagina" aria-live="polite">
        <p className="po-apagado">Cargando tu cuenta…</p>
      </section>
    );
  }

  if (sesion === null) {
    return (
      <section className="po-pagina po-pagina-angosta" aria-labelledby="po-panel-titulo">
        <h1 className="po-titulo-pagina" id="po-panel-titulo">
          Necesitas entrar.
        </h1>
        <p className="po-entrada">
          Esta sección es privada. Entra con tu correo y tu clave para ver tu expediente.
        </p>
        <p>
          <a className="po-boton po-boton-principal" href="/ingreso">
            Entrar
          </a>
        </p>
      </section>
    );
  }

  const { usuario, cliente } = sesion;

  if (usuario.rol === "admin") {
    return (
      <section className="po-pagina po-pagina-angosta" aria-labelledby="po-panel-admin">
        <h1 className="po-titulo-pagina" id="po-panel-admin">
          Esta cuenta opera la administración.
        </h1>
        <p className="po-entrada">
          Los clientes usan este panel. Tú gestionas expedientes, pagos y licencias desde
          la administración.
        </p>
        <p>
          <a className="po-boton po-boton-principal" href="/admin">
            Ir a la administración
          </a>
        </p>
      </section>
    );
  }

  return (
    <section className="po-pagina" aria-labelledby="po-panel-titulo">
      <p className="po-sello">Panel</p>
      <h1 className="po-titulo-pagina" id="po-panel-titulo">
        {usuario.nombre || usuario.correo}
      </h1>
      <p className="po-entrada">
        {usuario.verificado
          ? "Tu correo está confirmado y tu cuenta puede firmar."
          : "Tu cuenta está creada. Falta confirmar el correo para poder firmar."}
      </p>

      <section className="po-tarjeta" aria-labelledby="po-cuenta-titulo">
        <h2 className="po-tarjeta-titulo" id="po-cuenta-titulo">
          Cuenta
        </h2>
        <dl className="po-datos">
          <Dato titulo="Correo">{usuario.correo}</Dato>
          <Dato titulo="Estado">
            {usuario.verificado ? (
              <span className="po-etiqueta po-etiqueta-ok">Correo confirmado</span>
            ) : (
              <span className="po-etiqueta po-etiqueta-aviso">Sin confirmar</span>
            )}
          </Dato>
          {cliente ? (
            <>
              <Dato titulo="Cliente">{cliente.razon_social ?? "Pendiente"}</Dato>
              <Dato titulo="Documento">
                {cliente.documento_numero
                  ? `${cliente.documento_tipo === "cedula"
                    ? "Cédula"
                    : cliente.documento_tipo === "pasaporte"
                      ? "Pasaporte"
                      : "RIF"} ${cliente.documento_numero}`
                  : "Pendiente"}
              </Dato>
              <Dato titulo="Domicilio fiscal">{cliente.domicilio_fiscal ?? "Pendiente"}</Dato>
              <Dato titulo="Teléfono">{cliente.telefono}</Dato>
              <Dato titulo="Correo de facturación">
                {cliente.correo_factura ?? "Pendiente"}
              </Dato>
            </>
          ) : null}
        </dl>
        <p className="po-apagado">
          Los datos que faltan se completan al crear el proyecto. El portal valida el
          formato; no consulta al SENIAT.
        </p>
      </section>

      <Firma alFirmar={() => void recargar()} />

      <TarjetaProyecto />
      <TarjetaExpediente />
      <TarjetaLicencia />
    </section>
  );
}
