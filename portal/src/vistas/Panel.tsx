/* ============================================================
   Panel del cliente
   ------------------------------------------------------------
   Lo que ya está hecho: cuenta, ficha fiscal, firma y el alta
   del proyecto con sus anexos. El expediente firmado llega con
   la siguiente entrega; aquí no se promete una pantalla que
   todavía no existe.
   ============================================================ */

import { useEffect, useState, type ReactNode } from "react";
import { api, type ProyectoVista, type SesionPortal } from "../datos/api";
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
            <a className="po-boton po-boton-suave" href="#/proyecto">
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
            <a className="po-boton po-boton-principal" href="#/proyecto">
              Describir mi proyecto
            </a>
          </p>
        </>
      )}
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
          <a className="po-boton po-boton-principal" href="#/ingreso">
            Entrar
          </a>
        </p>
      </section>
    );
  }

  const { usuario, cliente } = sesion;

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
              <Dato titulo="Cliente">{cliente.razon_social}</Dato>
              <Dato titulo="Documento">
                {cliente.documento_tipo === "cedula"
                  ? "Cédula"
                  : cliente.documento_tipo === "pasaporte"
                    ? "Pasaporte"
                    : "RIF"}{" "}
                {cliente.documento_numero}
              </Dato>
              <Dato titulo="Domicilio fiscal">{cliente.domicilio_fiscal}</Dato>
              <Dato titulo="Teléfono">{cliente.telefono}</Dato>
              <Dato titulo="Correo de facturación">{cliente.correo_factura}</Dato>
            </>
          ) : null}
        </dl>
        <p className="po-apagado">
          Los datos fiscales se validan por formato; el portal no consulta al SENIAT.
        </p>
      </section>

      <Firma alFirmar={() => void recargar()} />

      <TarjetaProyecto />
    </section>
  );
}
