import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { api, FalloApi } from "../datos/api";
import { compararPdf, uuidValido, type DocumentoPublico, type ResultadoPdf } from "../datos/verificacion-publica";

type Consulta =
  | { tipo: "cargando" | "invalido" | "no-encontrado" | "error" }
  | { tipo: "listo"; documento: DocumentoPublico };

type Comparacion = ResultadoPdf | "" | "comparando" | "error";

const ESTADOS: Record<DocumentoPublico["estado"], { texto: string; clase: string }> = {
  pendiente: { texto: "Pendiente", clase: "po-etiqueta-aviso" },
  confirmado: { texto: "Confirmado", clase: "po-etiqueta-ok" },
  anulado: { texto: "Anulado", clase: "po-etiqueta-error" },
};

const RESULTADOS: Record<Exclude<Comparacion, "">, string> = {
  comparando: "Comparando el PDF…",
  original: "El PDF coincide con el archivo original registrado. El estado de firmas se muestra por separado arriba.",
  ajustado: "El PDF coincide con un archivo ajustado registrado. La firma registrada no acredita ese ajuste; no lo trate como firmado.",
  distinto: "El PDF no coincide con los archivos registrados para este documento.",
  "no-pdf": "No se reconoció el archivo como PDF. Selecciona un PDF.",
  error: "No se pudo comparar el archivo. Comprueba que tu navegador admite la comparación en una conexión segura e inténtalo de nuevo.",
};

export function VerificacionPublica({ id }: { id: string }) {
  const [consulta, setConsulta] = useState<Consulta>({ tipo: uuidValido(id) ? "cargando" : "invalido" });
  const [intento, setIntento] = useState(0);
  const [comparacion, setComparacion] = useState<Comparacion>("");
  const archivoActual = useRef(0);

  useEffect(() => {
    if (!uuidValido(id)) {
      setConsulta({ tipo: "invalido" });
      return;
    }
    const controlador = new AbortController();
    setConsulta({ tipo: "cargando" });
    api.verificacionPublica(id, controlador.signal).then(
      (documento) => {
        if (!controlador.signal.aborted) setConsulta({ tipo: "listo", documento });
      },
      (fallo: unknown) => {
        if (controlador.signal.aborted) return;
        setConsulta({ tipo: fallo instanceof FalloApi && fallo.estado === 404 ? "no-encontrado" : "error" });
      },
    );
    return () => controlador.abort();
  }, [id, intento]);

  useEffect(() => () => { archivoActual.current += 1; }, []);

  const seleccionarPdf = async (evento: ChangeEvent<HTMLInputElement>, documento: DocumentoPublico) => {
    const archivo = evento.currentTarget.files?.[0];
    // Permite volver a seleccionar el mismo archivo sin mostrar su nombre.
    evento.currentTarget.value = "";
    const actual = ++archivoActual.current;
    if (!archivo) {
      setComparacion("");
      return;
    }
    setComparacion("comparando");
    try {
      const resultado = await compararPdf(archivo, documento);
      if (actual === archivoActual.current) setComparacion(resultado);
    } catch {
      if (actual === archivoActual.current) setComparacion("error");
    }
  };

  return (
    <section className="po-pagina po-pagina-angosta" aria-labelledby="po-verificacion-publica-titulo">
      <p className="po-sello">BLINK TECHNOLOGY CORPORATION</p>
      <h1 className="po-titulo-pagina" id="po-verificacion-publica-titulo">Consulta pública del documento</h1>
      <p className="po-entrada">
        El código QR permite consultar el registro, pero por sí solo no verifica ningún archivo.
      </p>

      {consulta.tipo === "cargando" ? <p className="po-apagado" role="status">Consultando el registro…</p> : null}
      {consulta.tipo === "invalido" ? (
        <p className="po-nota po-nota-aviso" role="alert">El identificador del enlace no es válido. Comprueba que el enlace esté completo.</p>
      ) : null}
      {consulta.tipo === "no-encontrado" ? (
        <p className="po-nota po-nota-aviso" role="alert">No se encontró el documento en el registro.</p>
      ) : null}
      {consulta.tipo === "error" ? (
        <div className="po-nota" role="alert">
          <p>No se pudo consultar el registro. Comprueba tu conexión e inténtalo de nuevo.</p>
          <button className="po-boton po-boton-suave" type="button" onClick={() => setIntento((n) => n + 1)}>
            Reintentar
          </button>
        </div>
      ) : null}
      {consulta.tipo === "listo" ? (
        <>
          <div className="po-tarjeta">
            <h2 className="po-tarjeta-titulo">Datos del registro</h2>
            <dl className="po-datos">
              <div><dt>Titular</dt><dd className="po-texto-largo">{consulta.documento.titular}</dd></div>
              <div><dt>Documento</dt><dd className="po-texto-largo">{consulta.documento.titulo}</dd></div>
              <div>
                <dt>Estado de firmas en el registro</dt>
                <dd><span className={`po-etiqueta ${ESTADOS[consulta.documento.estado].clase}`}>{ESTADOS[consulta.documento.estado].texto}</span></dd>
              </div>
            </dl>
          </div>
          <div className="po-tarjeta">
            <h2 className="po-tarjeta-titulo">Comparar un PDF (opcional)</h2>
            <p className="po-apagado" id="po-pdf-ayuda">
              Selecciona un PDF para compararlo con el registro. El archivo se procesa en este dispositivo y no se sube.
            </p>
            <div className="po-campo po-ajuste">
              <label htmlFor="po-pdf-publico">Seleccionar PDF</label>
              <input
                id="po-pdf-publico"
                type="file"
                accept=".pdf,application/pdf"
                aria-describedby="po-pdf-ayuda po-pdf-resultado"
                onChange={(evento) => void seleccionarPdf(evento, consulta.documento)}
              />
            </div>
            <p className="po-apagado" id="po-pdf-resultado" role="status">
              {comparacion ? RESULTADOS[comparacion] : ""}
            </p>
          </div>
        </>
      ) : null}
    </section>
  );
}
