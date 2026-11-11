/* ============================================================
   Tipos del expediente legal
   ------------------------------------------------------------
   Un documento es una plantilla estructurada, no una cadena de
   texto: así el motor PDF puede paginar, medir y maquetar sin
   interpretar HTML, y el hash de la plantilla se calcula sobre una
   forma canónica estable.

   Los campos `{{...}}` se resuelven antes de generar el PDF. Si
   queda uno sin resolver, el expediente no se emite: un contrato
   con un hueco no es un contrato.
   ============================================================ */

export type Bloque =
  | { tipo: "titulo"; texto: string }
  | { tipo: "subtitulo"; texto: string }
  | { tipo: "parrafo"; texto: string }
  | { tipo: "lista"; items: string[]; numerada?: boolean }
  | { tipo: "tabla"; cabecera: string[]; filas: string[][]; anchos?: number[] }
  | { tipo: "aviso"; texto: string }
  /** Tabla de buzones resuelta desde el proyecto (máximo cinco). */
  | { tipo: "buzones" }
  /** Tabla de límites del plan de infraestructura elegido. */
  | { tipo: "limites" };

/** Momento en que se firma el documento. */
export type MomentoFirma = "registro" | "proyecto" | "entrega" | "nda";

export interface DocumentoLegal {
  codigo: string;
  titulo: string;
  version: string;
  fecha: string;
  firma: MomentoFirma;
  resumen: string;
  /** Variables que este documento exige; todas deben llegar con valor. */
  campos: string[];
  bloques: Bloque[];
}

export interface Buzon {
  correo: string;
  uso: string;
}

export interface LimitePlan {
  concepto: string;
  valor: string;
}

export interface DatosExpediente {
  variables: Record<string, string>;
  buzones: Buzon[];
  limites: LimitePlan[];
}

export interface DocumentoResuelto extends Omit<DocumentoLegal, "bloques"> {
  bloques: Bloque[];
  /** Variables efectivamente usadas, para la página de evidencia. */
  usadas: string[];
}

export interface FirmaCapturada {
  /** PNG del trazo, o `null` si se firma en papel. */
  png: Uint8Array | null;
  nombre: string;
  documento: string;
  correo?: string;
  /** ISO 8601 en UTC. */
  utc: string;
  ip?: string;
  agente?: string;
  metodo: "simple_reforzada" | "papel";
}

export interface Evidencia {
  sello: string;
  hashPlantilla: string;
  hashArchivo?: string;
  hashCadena?: string;
  hashAnterior?: string;
  orden?: number;
  utc: string;
  ip?: string;
  agente?: string;
}
