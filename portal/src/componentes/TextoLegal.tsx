/* ============================================================
   Bloques de un documento legal
   ------------------------------------------------------------
   Los textos se guardan como estructura, no como HTML: aquí se
   convierten en párrafos, listas y tablas reales. Las tablas
   dinámicas (`buzones`, `limites`) no aparecen en los documentos
   del registro. Las negritas inline `**…**` se parten con el mismo
   helper que usa el motor PDF.
   ============================================================ */

import type { Bloque } from "../../legal/tipos";
import { partirRuns } from "../../render/runs";

function Texto({ texto }: { texto: string }) {
  return (
    <>
      {partirRuns(texto).map((run, i) =>
        run.negrita ? <strong key={i}>{run.texto}</strong> : <span key={i}>{run.texto}</span>,
      )}
    </>
  );
}

export function TextoLegal({ bloques, clasico }: { bloques: Bloque[]; clasico?: boolean }) {
  return (
    <div className={clasico ? "po-legal-texto po-legal-clasico" : "po-legal-texto"}>
      {bloques.map((bloque, indice) => {
        const clave = `${bloque.tipo}-${indice}`;
        switch (bloque.tipo) {
          case "titulo":
            return <h3 key={clave}>{bloque.texto}</h3>;
          case "subtitulo":
            return <h3 key={clave}>{bloque.texto}</h3>;
          case "parrafo":
            return (
              <p key={clave}>
                <Texto texto={bloque.texto} />
              </p>
            );
          case "lista":
            return bloque.numerada ? (
              <ol key={clave}>
                {bloque.items.map((item, i) => (
                  <li key={`${clave}-${i}`}>
                    <Texto texto={item} />
                  </li>
                ))}
              </ol>
            ) : (
              <ul key={clave}>
                {bloque.items.map((item, i) => (
                  <li key={`${clave}-${i}`}>
                    <Texto texto={item} />
                  </li>
                ))}
              </ul>
            );
          case "tabla":
            return (
              <div className="po-tabla-marco" key={clave} tabIndex={0}>
                <table>
                  <thead>
                    <tr>
                      {bloque.cabecera.map((celda, i) => (
                        <th key={`${clave}-h-${i}`} scope="col">
                          {celda}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bloque.filas.map((fila, f) => (
                      <tr key={`${clave}-f-${f}`}>
                        {fila.map((celda, c) => (
                          <td key={`${clave}-f-${f}-c-${c}`}>
                            <Texto texto={celda} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "aviso":
            return (
              <p className="po-aviso-legal" key={clave}>
                <Texto texto={bloque.texto} />
              </p>
            );
          case "capitulo":
            return (
              <h3 className="po-legal-capitulo" key={clave}>
                {bloque.texto}
                {bloque.subtitulo ? <span className="po-legal-bajada">{bloque.subtitulo}</span> : null}
              </h3>
            );
          case "clausula":
            return (
              <p key={clave}>
                <strong>{bloque.ordinal}</strong> <Texto texto={bloque.texto} />
              </p>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}