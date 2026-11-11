/* ============================================================
   Panel del cliente
   ------------------------------------------------------------
   Lo que ya está hecho: cuenta, ficha fiscal y firma. El alta
   del proyecto se monta en la siguiente entrega; aquí se dice
   así, sin prometer una pantalla que todavía no existe.
   ============================================================ */

import type { ReactNode } from "react";
import type { SesionPortal } from "../datos/api";
import { Firma } from "../componentes/Firma";

function Dato({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div>
      <dt>{titulo}</dt>
      <dd>{children}</dd>
    </div>
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

      <section className="po-tarjeta" aria-labelledby="po-proyecto-titulo">
        <h2 className="po-tarjeta-titulo" id="po-proyecto-titulo">
          Proyecto
        </h2>
        <p className="po-apagado">
          El alta del proyecto —alcance, dominio, buzones, plan y anexos— se habilita en la
          siguiente entrega del portal. Cuando esté disponible, aparecerá aquí con su
          expediente y el estado de la licencia.
        </p>
      </section>
    </section>
  );
}
