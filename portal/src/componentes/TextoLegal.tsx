/* ============================================================
   Bloques de un documento legal
   ------------------------------------------------------------
   Los textos se guardan como estructura, no como HTML: aquí se
   convierten en párrafos, listas y tablas reales. Las tablas
   dinámicas (`buzones`, `limites`) no aparecen en los documentos
   del registro.
   ============================================================ */

import type { Bloque } from "../../legal/tipos";

export function TextoLegal({ bloques }: { bloques: Bloque[] }) {
  return (
    <div className="po-legal-texto">
      {bloques.map((bloque, indice) => {
        const clave = `${bloque.tipo}-${indice}`;
        switch (bloque.tipo) {
          case "titulo":
            return <h3 key={clave}>{bloque.texto}</h3>;
          case "subtitulo":
            return <h3 key={clave}>{bloque.texto}</h3>;
          case "parrafo":
            return <p key={clave}>{bloque.texto}</p>;
          case "lista":
            return bloque.numerada ? (
              <ol key={clave}>
                {bloque.items.map((item, i) => (
                  <li key={`${clave}-${i}`}>{item}</li>
                ))}
              </ol>
            ) : (
              <ul key={clave}>
                {bloque.items.map((item, i) => (
                  <li key={`${clave}-${i}`}>{item}</li>
                ))}
              </ul>
            );
          case "tabla":
            return (
              <div className="po-tabla-marco" key={clave}>
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
                          <td key={`${clave}-f-${f}-c-${c}`}>{celda}</td>
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
                {bloque.texto}
              </p>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
