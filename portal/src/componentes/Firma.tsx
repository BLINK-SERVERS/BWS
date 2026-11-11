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
import { TextoLegal } from "./TextoLegal";

type Punto = { x: number; y: number };

const ALTO = 180;

export function Firma({ alFirmar }: { alFirmar?: () => void }) {
  const [estado, setEstado] = useState<EstadoFirma | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const [acepta, setAcepta] = useState(false);
  const [tieneTrazo, setTieneTrazo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const lienzo = useRef<HTMLCanvasElement>(null);
  const trazos = useRef<Punto[][]>([]);
  const dibujando = useRef(false);

  const redibujar = useCallback(() => {
    const canvas = lienzo.current;
    if (!canvas) return;
    const contexto = canvas.getContext("2d");
    if (!contexto) return;
    contexto.clearRect(0, 0, canvas.width, canvas.height);
    contexto.strokeStyle = "#111";
    contexto.fillStyle = "#111";
    contexto.lineWidth = 2.2;
    contexto.lineCap = "round";
    contexto.lineJoin = "round";
    for (const trazo of trazos.current) {
      if (trazo.length === 1) {
        contexto.beginPath();
        contexto.arc(trazo[0].x, trazo[0].y, 1.1, 0, Math.PI * 2);
        contexto.fill();
        continue;
      }
      contexto.beginPath();
      trazo.forEach((punto, indice) => {
        if (indice === 0) contexto.moveTo(punto.x, punto.y);
        else contexto.lineTo(punto.x, punto.y);
      });
      contexto.stroke();
    }
  }, []);

  const ajustar = useCallback(() => {
    const canvas = lienzo.current;
    if (!canvas) return;
    const densidad = Math.min(window.devicePixelRatio || 1, 3);
    const ancho = canvas.clientWidth;
    canvas.width = Math.round(ancho * densidad);
    canvas.height = Math.round(ALTO * densidad);
    const contexto = canvas.getContext("2d");
    if (contexto) contexto.setTransform(densidad, 0, 0, densidad, 0, 0);
    redibujar();
  }, [redibujar]);

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

  useEffect(() => {
    const canvas = lienzo.current;
    if (!estado || !estado.verificado || estado.firma || !canvas) return;
    ajustar();
    const observador = new ResizeObserver(() => ajustar());
    observador.observe(canvas);
    window.addEventListener("resize", ajustar);
    return () => {
      observador.disconnect();
      window.removeEventListener("resize", ajustar);
    };
  }, [estado, ajustar]);

  const punto = (evento: React.PointerEvent<HTMLCanvasElement>): Punto => {
    const rect = evento.currentTarget.getBoundingClientRect();
    return { x: evento.clientX - rect.left, y: evento.clientY - rect.top };
  };

  const bajar = (evento: React.PointerEvent<HTMLCanvasElement>) => {
    if (!acepta) return;
    evento.currentTarget.setPointerCapture(evento.pointerId);
    dibujando.current = true;
    trazos.current.push([punto(evento)]);
    setTieneTrazo(true);
    redibujar();
  };

  const mover = (evento: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dibujando.current || !acepta) return;
    const trazo = trazos.current.at(-1);
    if (!trazo) return;
    trazo.push(punto(evento));
    redibujar();
  };

  const subir = () => {
    dibujando.current = false;
  };

  const deshacer = () => {
    trazos.current.pop();
    redibujar();
    setTieneTrazo(trazos.current.length > 0);
  };

  const borrar = () => {
    trazos.current = [];
    redibujar();
    setTieneTrazo(false);
  };

  const enviar = async () => {
    if (!estado || !lienzo.current || !acepta || !tieneTrazo) return;
    setEnviando(true);
    setFallo(null);
    setAviso(null);
    try {
      const png = lienzo.current.toDataURL("image/png");
      const respuesta = await api.firmar(png, estado.consentimiento_hash);
      setEstado({ ...estado, firma: respuesta.firma });
      setAviso("Firma registrada. No se puede reemplazar desde el portal.");
      trazos.current = [];
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
            <a href="#/ingreso">Entrar de nuevo</a>
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

          <div className={acepta ? "po-lienzo-marco" : "po-lienzo-marco po-lienzo-apagado"}>
            <canvas
              ref={lienzo}
              className="po-lienzo"
              style={{ height: `${ALTO}px` }}
              aria-label="Área para dibujar la firma con el ratón o el dedo"
              role="img"
              aria-disabled={!acepta}
              onPointerDown={bajar}
              onPointerMove={mover}
              onPointerUp={subir}
              onPointerCancel={subir}
              onPointerLeave={subir}
            >
              Tu navegador no permite dibujar aquí. La firma en papel sigue disponible.
            </canvas>
            {!acepta ? (
              <p className="po-lienzo-velo">Acepta el consentimiento para dibujar.</p>
            ) : null}
          </div>

          <div className="po-firma-acciones">
            <button
              type="button"
              className="po-boton po-boton-suave"
              onClick={deshacer}
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
