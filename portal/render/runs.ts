/* ============================================================
   Tramos de negrita inline
   ------------------------------------------------------------
   Los textos legales marcan las negritas con `**…**`. Este módulo
   es puro (sin pdf-lib) para que el navegador pueda partir los
   mismos tramos al mostrar la vista previa del documento.
   ============================================================ */

export interface Run {
  texto: string;
  negrita: boolean;
}

/** Parte un texto en tramos alternando normal y negrita (`**…**`). */
export function partirRuns(texto: string): Run[] {
  const runs: Run[] = [];
  String(texto)
    .split("**")
    .forEach((parte, indice) => {
      if (parte) runs.push({ texto: parte, negrita: indice % 2 === 1 });
    });
  return runs;
}