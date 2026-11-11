/* ============================================================
   Lienzo de firma
   ------------------------------------------------------------
   Canvas de trazo único que comparten la firma del cliente y la
   captura del representante de Blink. Guarda los trazos para
   deshacer y para redibujar si cambia el ancho, y escala por
   densidad de píxeles. El PNG se pide al componente con `png()`.

   Quien no pueda dibujar con el puntero tiene la firma en papel
   como alternativa; este lienzo no la sustituye.
   ============================================================ */

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";

type Punto = { x: number; y: number };

const ALTO = 180;

export interface LienzoFirmaHandle {
  png: () => string | null;
  deshacer: () => void;
  borrar: () => void;
}

export const LienzoFirma = forwardRef<
  LienzoFirmaHandle,
  {
    habilitado: boolean;
    alCambiar?: (tieneTrazo: boolean) => void;
    velo?: string;
  }
>(function LienzoFirma({ habilitado, alCambiar, velo }, ref) {
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

  useEffect(() => {
    ajustar();
    const observador = new ResizeObserver(() => ajustar());
    if (lienzo.current) observador.observe(lienzo.current);
    window.addEventListener("resize", ajustar);
    return () => {
      observador.disconnect();
      window.removeEventListener("resize", ajustar);
    };
  }, [ajustar]);

  const borrar = useCallback(() => {
    trazos.current = [];
    redibujar();
    alCambiar?.(false);
  }, [redibujar, alCambiar]);

  useImperativeHandle(
    ref,
    () => ({
      png: () => lienzo.current?.toDataURL("image/png") ?? null,
      deshacer: () => {
        trazos.current.pop();
        redibujar();
        alCambiar?.(trazos.current.length > 0);
      },
      borrar,
    }),
    [redibujar, borrar, alCambiar],
  );

  const punto = (evento: React.PointerEvent<HTMLCanvasElement>): Punto => {
    const rect = evento.currentTarget.getBoundingClientRect();
    return { x: evento.clientX - rect.left, y: evento.clientY - rect.top };
  };

  const bajar = (evento: React.PointerEvent<HTMLCanvasElement>) => {
    if (!habilitado) return;
    evento.currentTarget.setPointerCapture(evento.pointerId);
    dibujando.current = true;
    trazos.current.push([punto(evento)]);
    alCambiar?.(true);
    redibujar();
  };

  const mover = (evento: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dibujando.current || !habilitado) return;
    const trazo = trazos.current.at(-1);
    if (!trazo) return;
    trazo.push(punto(evento));
    redibujar();
  };

  const subir = () => {
    dibujando.current = false;
  };

  return (
    <div className={habilitado ? "po-lienzo-marco" : "po-lienzo-marco po-lienzo-apagado"}>
      <canvas
        ref={lienzo}
        className="po-lienzo"
        style={{ height: `${ALTO}px` }}
        aria-label="Área para dibujar la firma con el ratón o el dedo"
        role="img"
        aria-disabled={!habilitado}
        onPointerDown={bajar}
        onPointerMove={mover}
        onPointerUp={subir}
        onPointerCancel={subir}
        onPointerLeave={subir}
      >
        Tu navegador no permite dibujar aquí. La firma en papel sigue disponible.
      </canvas>
      {!habilitado && velo ? <p className="po-lienzo-velo">{velo}</p> : null}
    </div>
  );
});
