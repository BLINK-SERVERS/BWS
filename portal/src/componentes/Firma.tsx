/* ============================================================
   Captura de la firma
   ------------------------------------------------------------
   Un solo trazo por firma, guardado como PNG con su hash. La
   firma no se reemplaza desde el portal: si ya existe una, esta
   pantalla solo la muestra.

   El lienzo usa eventos de puntero y escala por densidad de
   píxeles; se guardan los trazos para poder deshacer y para
   redibujar si cambia el ancho. Quien no pueda dibujar con el
   puntero tiene la firma en papel como alternativa.
   ============================================================ */

import { useCallback, useEffect, useRef, useState } from "react";
import { api, FalloApi, type EstadoFirma } from "../datos/api";
import { LienzoFirma, type LienzoFirmaHandle } from "./LienzoFirma";
import { TextoLegal } from "./TextoLegal";

export function Firma({ alFirmar }: { alFirmar?: () => void }) {
  const [estado, setEstado] = useState<EstadoFirma | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const [acepta, setAcepta] = useState(false);
  const [tieneTrazo, setTieneTrazo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const lienzo = useRef<LienzoFirmaHandle>(null);

  const cargar = useCallback(async () => {
    try {
      const respuesta = await api.estadoFirma();
      setEstado(respuesta);
      setFallo(null);
    } catch (error) {
      setFallo(
        error instanceof FalloApi
          ? error.estado === 401
            ? "Tu sesión venció. Vuelve a entrar para firmar."
            : error.message
          : "No pudimos cargar el consentimiento.",
      );
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const borrar = () => {
    lienzo.current?.borrar();
    setTieneTrazo(false);
  };

  const enviar = async () => {
    if (!estado || !acepta || !tieneTrazo) return;
    const png = lienzo.current?.png();
    if (!png) return;
    setEnviando(true);
    setFallo(null);
    setAviso(null);
    try {
      const respuesta = await api.firmar(png, estado.consentimiento_hash);
      setEstado({ ...estado, firma: respuesta.firma });
      setAviso("Firma registrada. No se puede reemplazar desde el portal.");
      lienzo.current?.borrar();
      setAcepta(false);
      alFirmar?.();
    } catch (error) {
      setFallo(
        error instanceof FalloApi ? error.message : "No pudimos registrar la firma.",
      );
      await cargar();
    } finally {
      setEnviando(false);
    }
  };

  if (!estado) {
    return (
      <section className="po-tarjeta" aria-live="polite">
        <h2 className="po-tarjeta-titulo">Firma</h2>
        <p className="po-apagado">{fallo ?? "Cargando el consentimiento…"}</p>
        {fallo ? (
          <p>
            <a href="/ingreso">Entrar de nuevo</a>
          </p>
        ) : null}
      </section>
    );
  }

  const firma = estado.firma;

  return (
    <section className="po-tarjeta" aria-labelledby="po-firma-titulo">
      <h2 className="po-tarjeta-titulo" id="po-firma-titulo">
        {firma ? "Tu firma" : "Firmar el consentimiento"}
      </h2>

      {!estado.verificado ? (
        <div className="po-nota po-nota-aviso" role="status">
          <p>
            Confirma tu correo antes de firmar. Revisa el mensaje que enviamos al crear la
            cuenta; si no llegó, escribe a{" "}
            <a href="mailto:business@blink.com.ve">business@blink.com.ve</a>.
          </p>
        </div>
      ) : null}

      {firma ? (
        <div className="po-firma-hecha">
          {firma.png ? (
            <img
              className="po-firma-imagen"
              src={firma.png}
              alt={`Firma registrada el ${new Date(firma.utc).toLocaleString("es-VE")}`}
            />
          ) : null}
          <dl className="po-datos">
            <div>
              <dt>Registrada</dt>
              <dd>{new Date(firma.utc).toLocaleString("es-VE")}</dd>
            </div>
            <div>
              <dt>Método</dt>
              <dd>Firma electrónica simple, con evidencia reforzada</dd>
            </div>
            <div>
              <dt>Huella del trazo (SHA-256)</dt>
              <dd>
                <code className="po-hash">{firma.sha256}</code>
              </dd>
            </div>
          </dl>
          <p className="po-apagado">
            La firma original no se reemplaza dentro del portal. Si necesitas corregirla,
            escribe a <a href="mailto:business@blink.com.ve">business@blink.com.ve</a>.
          </p>
        </div>
      ) : null}

      {estado.verificado && !firma ? (
        <>
          <p className="po-entrada">
            La firma que captures es una firma electrónica simple, no certificada. Queda
            ligada a tu cuenta con el trazo, la fecha y hora en UTC, la dirección IP, el
            agente del navegador y el sello del documento.
          </p>

          <details className="po-consentimiento" open>
            <summary>
              {estado.consentimiento.codigo} · {estado.consentimiento.titulo}
            </summary>
            <div className="po-consentimiento-texto">
              <TextoLegal bloques={estado.consentimiento.bloques} />
            </div>
          </details>

          <label className="po-casilla">
            <input
              type="checkbox"
              checked={acepta}
              onChange={(evento) => {
                setAcepta(evento.target.checked);
                if (!evento.target.checked) borrar();
              }}
            />
            <span>
              Leí y acepto el consentimiento {estado.consentimiento.codigo} para usar la
              firma electrónica simple en este expediente.
            </span>
          </label>

          <LienzoFirma
            ref={lienzo}
            habilitado={acepta}
            alCambiar={setTieneTrazo}
            velo="Acepta el consentimiento para dibujar."
          />

          <div className="po-firma-acciones">
            <button
              type="button"
              className="po-boton po-boton-suave"
              onClick={() => lienzo.current?.deshacer()}
              disabled={!tieneTrazo}
            >
              Deshacer
            </button>
            <button
              type="button"
              className="po-boton po-boton-suave"
              onClick={borrar}
              disabled={!tieneTrazo}
            >
              Borrar
            </button>
            <button
              type="button"
              className="po-boton po-boton-principal"
              onClick={() => void enviar()}
              disabled={!acepta || !tieneTrazo || enviando}
            >
              {enviando ? "Registrando…" : "Firmar"}
            </button>
          </div>

          <p className="po-apagado">
            Si no puedes dibujar con el puntero, la firma en papel sigue disponible:
            escríbenos y coordinamos la entrega. La firma no se sustituye por una
            certificada.
          </p>
        </>
      ) : null}

      {aviso ? (
        <p className="po-nota po-nota-ok" role="status">
          {aviso}
        </p>
      ) : null}
      {fallo ? (
        <p className="po-campo-error" role="alert">
          {fallo}
        </p>
      ) : null}
    </section>
  );
}
