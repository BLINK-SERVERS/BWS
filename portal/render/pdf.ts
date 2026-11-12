/* ============================================================
   Motor PDF del expediente
   ------------------------------------------------------------
   Genera un PDF 1.7 en A4 con fuentes embebidas, cabecera, pie,
   paginación, página de firmas y página de evidencia. El sello se
   calcula fuera del archivo (ver hash.ts) y el hash del PDF se
   guarda aparte: el archivo no puede contener su propio hash.

   Lo que este motor NO hace: no declara PDF/A, no firma con
   certificado digital, no incrusta una estampilla de tiempo de una
   autoridad. Lo que sí hace: deja el documento verificable contra
   los sellos y actos guardados en la base.
   ============================================================ */

import { PDFDocument, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import type {
  Buzon,
  DatosExpediente,
  DocumentoResuelto,
  Evidencia,
  FirmaCapturada,
  LimitePlan,
} from "../legal/tipos";
import { lectorDeFuentes, type LectorFuentes } from "./fuentes";
import {
  ANCHO_CONTENIDO,
  A4,
  COLORES,
  MARGEN,
  cargarFuentes,
  envolver,
  envolverCaracteres,
  formatearUTC,
  type Fuentes,
} from "./maqueta";

export interface OpcionesPDF {
  doc: DocumentoResuelto;
  datos: DatosExpediente;
  firmas: { representante: FirmaCapturada; cliente: FirmaCapturada };
  evidencia: Evidencia;
  /** Fecha fija para que el archivo sea reproducible en las pruebas. */
  fechaCreacion?: Date;
  /** Lector explícito de las fuentes; si falta, se usa el configurado en la entrada. */
  leerFuente?: LectorFuentes;
}

const TAMANO_CUERPO = 10;
const INTERLINEADO_CUERPO = 14.2;
const TAMANO_CELDA = 8.6;
const INTERLINEADO_CELDA = 11.4;
const RELLENO_CELDA = 5;

interface Celda {
  lineas: string[];
  fuente: PDFFont;
  tamano: number;
  interlineado: number;
}

export async function generarPDF(opciones: OpcionesPDF): Promise<Uint8Array> {
  const { doc, datos, firmas, evidencia } = opciones;
  const pdf = await PDFDocument.create();
  const fuentes = await cargarFuentes(pdf, opciones.leerFuente ?? lectorDeFuentes());

  const bws = datos.variables.bws_razon_social ?? "Blink";
  const paginas: PDFPage[] = [];
  let pagina!: PDFPage;
  let y = 0;

  function nuevaPagina(): PDFPage {
    pagina = pdf.addPage([A4.ancho, A4.alto]);
    paginas.push(pagina);
    y = A4.alto - MARGEN.sup;
    return pagina;
  }

  function asegurar(alto: number) {
    if (y - alto < MARGEN.inf) nuevaPagina();
  }

  function texto(
    contenido: string,
    fuente: PDFFont,
    tamano: number,
    color: typeof COLORES.tinta,
    x: number,
    yLinea: number,
  ) {
    pagina.drawText(contenido, { x, y: yLinea, size: tamano, font: fuente, color });
  }

  function parrafo(
    contenido: string,
    opcionesParrafo?: {
      fuente?: PDFFont;
      tamano?: number;
      interlineado?: number;
      color?: typeof COLORES.tinta;
      sangria?: number;
      ancho?: number;
      espacio?: number;
    },
  ) {
    const fuente = opcionesParrafo?.fuente ?? fuentes.serif;
    const tamano = opcionesParrafo?.tamano ?? TAMANO_CUERPO;
    const interlineado = opcionesParrafo?.interlineado ?? INTERLINEADO_CUERPO;
    const color = opcionesParrafo?.color ?? COLORES.tinta;
    const sangria = opcionesParrafo?.sangria ?? 0;
    const ancho = opcionesParrafo?.ancho ?? ANCHO_CONTENIDO - sangria;
    const lineas = envolver(contenido, fuente, tamano, ancho);
    for (const linea of lineas) {
      if (y - interlineado < MARGEN.inf) nuevaPagina();
      texto(linea, fuente, tamano, color, MARGEN.izq + sangria, y);
      y -= interlineado;
    }
    y -= opcionesParrafo?.espacio ?? 7;
  }

  function subtitulo(contenido: string) {
    asegurar(36);
    y -= 5;
    texto(contenido, fuentes.sansBold, 10.5, COLORES.tinta, MARGEN.izq, y);
    y -= 15;
  }

  function tituloBloque(contenido: string) {
    asegurar(44);
    y -= 8;
    const lineas = envolver(contenido, fuentes.sansBold, 12.5, ANCHO_CONTENIDO);
    for (const linea of lineas) {
      texto(linea, fuentes.sansBold, 12.5, COLORES.tinta, MARGEN.izq, y);
      y -= 16;
    }
    y -= 5;
  }

  function lista(items: string[], numerada?: boolean) {
    items.forEach((item, indice) => {
      const marca = numerada ? `${indice + 1}.` : "•";
      const lineas = envolver(item, fuentes.serif, TAMANO_CUERPO, ANCHO_CONTENIDO - 20);
      let primera = true;
      for (const linea of lineas) {
        if (y - INTERLINEADO_CUERPO < MARGEN.inf) nuevaPagina();
        if (primera) {
          texto(marca, fuentes.serifBold, TAMANO_CUERPO, COLORES.secundario, MARGEN.izq, y);
          primera = false;
        }
        texto(linea, fuentes.serif, TAMANO_CUERPO, COLORES.tinta, MARGEN.izq + 20, y);
        y -= INTERLINEADO_CUERPO;
      }
      y -= 3;
    });
    y -= 5;
  }

  function celdasDe(fila: string[], anchos: number[], monoEnHash = false): Celda[] {
    return fila.map((valor, i) => {
      const esHash = monoEnHash && /^[0-9a-f]{64}$/i.test(valor);
      const fuente = esHash ? fuentes.mono : fuentes.serif;
      const tamano = esHash ? 6.9 : TAMANO_CELDA;
      const interlineado = esHash ? 9.4 : INTERLINEADO_CELDA;
      const ancho = anchos[i] - RELLENO_CELDA * 2;
      return {
        lineas: esHash
          ? envolverCaracteres(valor, fuente, tamano, ancho)
          : envolver(valor, fuente, tamano, ancho),
        fuente,
        tamano,
        interlineado,
      };
    });
  }

  function altoDeFila(celdas: Celda[]): number {
    return Math.max(...celdas.map((c) => c.lineas.length)) * Math.max(...celdas.map((c) => c.interlineado)) +
      RELLENO_CELDA * 2;
  }

  function dibujarCabeceraTabla(cabecera: string[], anchos: number[]) {
    const celdas = cabecera.map((valor, i) => {
      const fuente = fuentes.sansBold;
      const tamano = 8.1;
      return {
        lineas: envolver(valor, fuente, tamano, anchos[i] - RELLENO_CELDA * 2),
        fuente,
        tamano,
        interlineado: 10.4,
      };
    });
    const alto = altoDeFila(celdas);
    asegurar(alto + 4);
    pagina.drawRectangle({
      x: MARGEN.izq,
      y: y - alto,
      width: ANCHO_CONTENIDO,
      height: alto,
      color: COLORES.relleno,
    });
    let x = MARGEN.izq;
    celdas.forEach((celda, i) => {
      let yLinea = y - RELLENO_CELDA - celda.tamano;
      for (const linea of celda.lineas) {
        texto(linea, celda.fuente, celda.tamano, COLORES.secundario, x + RELLENO_CELDA, yLinea);
        yLinea -= celda.interlineado;
      }
      x += anchos[i];
    });
    pagina.drawLine({
      start: { x: MARGEN.izq, y: y - alto },
      end: { x: MARGEN.izq + ANCHO_CONTENIDO, y: y - alto },
      thickness: 0.6,
      color: COLORES.borde,
    });
    y -= alto;
  }

  function dibujarTabla(cabecera: string[], filas: string[][], proporciones?: number[], monoEnHash = false) {
    const total = proporciones?.reduce((a, b) => a + b, 0) ?? cabecera.length;
    const anchos = cabecera.map((_, i) => ((proporciones?.[i] ?? 1) / total) * ANCHO_CONTENIDO);
    dibujarCabeceraTabla(cabecera, anchos);
    filas.forEach((fila, indice) => {
      const celdas = celdasDe(fila, anchos, monoEnHash);
      const alto = altoDeFila(celdas);
      if (y - alto < MARGEN.inf) {
        nuevaPagina();
        dibujarCabeceraTabla(cabecera, anchos);
      }
      if (indice % 2 === 1) {
        pagina.drawRectangle({
          x: MARGEN.izq,
          y: y - alto,
          width: ANCHO_CONTENIDO,
          height: alto,
          color: COLORES.relleno,
          opacity: 0.45,
        });
      }
      let x = MARGEN.izq;
      celdas.forEach((celda, i) => {
        let yLinea = y - RELLENO_CELDA - celda.tamano;
        for (const linea of celda.lineas) {
          texto(linea, celda.fuente, celda.tamano, COLORES.tinta, x + RELLENO_CELDA, yLinea);
          yLinea -= celda.interlineado;
        }
        x += anchos[i];
      });
      pagina.drawLine({
        start: { x: MARGEN.izq, y: y - alto },
        end: { x: MARGEN.izq + ANCHO_CONTENIDO, y: y - alto },
        thickness: 0.4,
        color: COLORES.bordeSuave,
      });
      y -= alto;
    });
    y -= 10;
  }

  function aviso(contenido: string) {
    const lineas = envolver(contenido, fuentes.serif, 9.2, ANCHO_CONTENIDO - 26);
    const alto = lineas.length * 12.8 + 20;
    asegurar(alto + 8);
    pagina.drawRectangle({
      x: MARGEN.izq,
      y: y - alto,
      width: ANCHO_CONTENIDO,
      height: alto,
      color: COLORES.relleno,
    });
    pagina.drawRectangle({
      x: MARGEN.izq,
      y: y - alto,
      width: 3,
      height: alto,
      color: COLORES.acento,
    });
    let yLinea = y - 10 - 9.2;
    for (const linea of lineas) {
      texto(linea, fuentes.serif, 9.2, COLORES.secundario, MARGEN.izq + 14, yLinea);
      yLinea -= 12.8;
    }
    y -= alto + 10;
  }

  function filasDeBuzones(buzones: Buzon[]): string[][] {
    if (!buzones.length) return [["No se solicitaron buzones", "—"]];
    return buzones.map((b) => [b.correo, b.uso]);
  }

  function filasDeLimites(limites: LimitePlan[]): string[][] {
    if (!limites.length) return [["No registrado", "—"]];
    return limites.map((l) => [l.concepto, l.valor]);
  }

  function crearCaja(
    x: number,
    yCaja: number,
    ancho: number,
    alto: number,
    etiqueta: string,
    firma: FirmaCapturada,
    imagen: PDFImage | null,
  ) {
    pagina.drawRectangle({
      x,
      y: yCaja,
      width: ancho,
      height: alto,
      borderColor: COLORES.borde,
      borderWidth: 0.7,
    });
    texto(etiqueta, fuentes.sansBold, 9, COLORES.tinta, x + 12, yCaja + alto - 18);

    const yFirma = yCaja + alto - 82;
    if (imagen) {
      const maxAncho = ancho - 24;
      const maxAlto = 52;
      const escala = Math.min(maxAncho / imagen.width, maxAlto / imagen.height);
      const anchoImg = imagen.width * escala;
      const altoImg = imagen.height * escala;
      pagina.drawImage(imagen, {
        x: x + (ancho - anchoImg) / 2,
        y: yFirma - altoImg / 2,
        width: anchoImg,
        height: altoImg,
      });
    } else {
      texto(
        firma.metodo === "papel" ? "Firma en papel" : "Sin imagen de firma",
        fuentes.serifItalic,
        9,
        COLORES.terciario,
        x + 12,
        yFirma - 4,
      );
    }
    pagina.drawLine({
      start: { x: x + 12, y: yFirma - 30 },
      end: { x: x + ancho - 12, y: yFirma - 30 },
      thickness: 0.6,
      color: COLORES.borde,
    });
    texto("Firma", fuentes.sans, 7.2, COLORES.terciario, x + 12, yFirma - 41);

    let yDatos = yFirma - 58;
    const nombre = envolver(firma.nombre, fuentes.sansBold, 9, ancho - 24)[0] ?? firma.nombre;
    texto(nombre, fuentes.sansBold, 9, COLORES.tinta, x + 12, yDatos);
    yDatos -= 12;
    texto(firma.documento, fuentes.sans, 8, COLORES.secundario, x + 12, yDatos);
    yDatos -= 11;
    if (firma.correo) {
      const correo = envolver(firma.correo, fuentes.sans, 7.6, ancho - 24)[0] ?? firma.correo;
      texto(correo, fuentes.sans, 7.6, COLORES.secundario, x + 12, yDatos);
      yDatos -= 11;
    }
    texto(`Firmado: ${formatearUTC(firma.utc)}`, fuentes.sans, 7.6, COLORES.secundario, x + 12, yDatos);
    yDatos -= 10;
    texto(
      firma.metodo === "papel" ? "Firma en papel" : "Firma electrónica simple (no certificada)",
      fuentes.sans,
      7.2,
      COLORES.terciario,
      x + 12,
      yDatos,
    );
  }

  async function paginaDeFirmas() {
    nuevaPagina();
    texto("Firmas", fuentes.serifBold, 17, COLORES.tinta, MARGEN.izq, y);
    y -= 24;
    parrafo(
      "El presente documento se firma con firma electrónica simple con evidencia reforzada, no certificada. La firma del cliente se capturó una sola vez en el registro y se conserva bloqueada; cada documento registra un acto de firma propio con su sello, fecha y hora en UTC.",
      { tamano: 9.2, interlineado: 13, color: COLORES.secundario, espacio: 12 },
    );

    const anchoCaja = (ANCHO_CONTENIDO - 18) / 2;
    const altoCaja = 186;
    asegurar(altoCaja + 30);
    const yCaja = y - altoCaja;

    let imagenRepresentante: PDFImage | null = null;
    let imagenCliente: PDFImage | null = null;
    try {
      if (firmas.representante.png) imagenRepresentante = await pdf.embedPng(firmas.representante.png);
    } catch {
      imagenRepresentante = null;
    }
    try {
      if (firmas.cliente.png) imagenCliente = await pdf.embedPng(firmas.cliente.png);
    } catch {
      imagenCliente = null;
    }

    crearCaja(
      MARGEN.izq,
      yCaja,
      anchoCaja,
      altoCaja,
      "Representante legal de Blink",
      firmas.representante,
      imagenRepresentante,
    );
    crearCaja(
      MARGEN.izq + anchoCaja + 18,
      yCaja,
      anchoCaja,
      altoCaja,
      "Cliente",
      firmas.cliente,
      imagenCliente,
    );
    y = yCaja - 24;

    parrafo(`Lugar y fecha: ${datos.variables.fecha_documento ?? ""}`, {
      fuente: fuentes.sans,
      tamano: 8.6,
      interlineado: 12,
      color: COLORES.secundario,
      espacio: 10,
    });
    parrafo(
      "La firma electrónica simple no sustituye a la firma autógrafa ni a la firma electrónica certificada de un prestador acreditado. Si el documento requiere firma certificada o autenticación notarial, debe solicitarlo antes de firmar. En ese caso, o si prefiere papel, el original firmado se conserva con el expediente y este PDF queda como copia.",
      { tamano: 8.8, interlineado: 12.4, color: COLORES.secundario, espacio: 0 },
    );
  }

  function paginaDeEvidencia() {
    nuevaPagina();
    texto("Constancia de evidencia", fuentes.serifBold, 17, COLORES.tinta, MARGEN.izq, y);
    y -= 24;
    parrafo(
      "El sello de contenido se calcula sobre una representación canónica de los datos del expediente, la plantilla, las firmas y el instante UTC. No se calcula sobre los bytes del PDF, porque un archivo no puede contener el hash de sí mismo sin invalidarse. El hash del archivo se guarda en el portal y se informa en el correo de envío.",
      { tamano: 9.2, interlineado: 13, color: COLORES.secundario, espacio: 12 },
    );

    const filas: string[][] = [
      ["Documento", `${doc.codigo} — ${doc.titulo}`],
      ["Versión de la plantilla", doc.version],
      ["Fecha de la plantilla", doc.fecha],
      ["Hash de la plantilla (SHA-256)", evidencia.hashPlantilla],
      ["Sello de contenido (SHA-256)", evidencia.sello],
      ["Hash de cadena", evidencia.hashCadena ?? "No registrado en esta muestra"],
      ["Hash anterior", evidencia.hashAnterior ?? "No registrado en esta muestra"],
      ["Orden en el expediente", evidencia.orden === undefined ? "No registrado" : String(evidencia.orden)],
      ["Fecha y hora UTC", formatearUTC(evidencia.utc)],
      ["Dirección IP de origen", evidencia.ip ?? "No registrada en esta muestra"],
      ["Agente de usuario", evidencia.agente ?? "No registrado en esta muestra"],
    ];
    dibujarTabla(["Dato de evidencia", "Valor"], filas, [0.36, 0.64], true);

    parrafo(
      "La alteración de un byte del PDF, de una fila de la base o de una firma produce un valor distinto al comparar con el sello y el hash guardados. Esa es la garantía que se ofrece: el registro no se modifica desde la aplicación y la alteración es detectable, no que sea imposible de alterar.",
      { tamano: 9, interlineado: 12.6, color: COLORES.secundario, espacio: 9 },
    );
    parrafo(
      `Para verificar, compare el sello y el hash del archivo con los valores guardados en el portal. El correo de envío incluye el hash del archivo adjunto. Este documento no declara conformidad con PDF/A ni certificación con norma ISO alguna.`,
      { tamano: 9, interlineado: 12.6, color: COLORES.secundario, espacio: 0 },
    );
  }

  // ---------- Construcción ----------
  pagina = nuevaPagina();

  texto(doc.codigo, fuentes.sansBold, 8.5, COLORES.acento, MARGEN.izq, y);
  y -= 17;
  const lineasTitulo = envolver(doc.titulo, fuentes.serifBold, 18, ANCHO_CONTENIDO);
  for (const linea of lineasTitulo) {
    texto(linea, fuentes.serifBold, 18, COLORES.tinta, MARGEN.izq, y);
    y -= 22;
  }
  y -= 2;
  const lineasResumen = envolver(doc.resumen, fuentes.serifItalic, 9.4, ANCHO_CONTENIDO);
  for (const linea of lineasResumen) {
    texto(linea, fuentes.serifItalic, 9.4, COLORES.secundario, MARGEN.izq, y);
    y -= 13;
  }
  y -= 6;
  texto(
    `Versión ${doc.version} · ${doc.fecha} · ${bws}`,
    fuentes.sans,
    8,
    COLORES.terciario,
    MARGEN.izq,
    y,
  );
  y -= 12;
  pagina.drawLine({
    start: { x: MARGEN.izq, y },
    end: { x: MARGEN.izq + ANCHO_CONTENIDO, y },
    thickness: 0.8,
    color: COLORES.borde,
  });
  y -= 16;

  for (const bloque of doc.bloques) {
    switch (bloque.tipo) {
      case "titulo":
        tituloBloque(bloque.texto);
        break;
      case "subtitulo":
        subtitulo(bloque.texto);
        break;
      case "parrafo":
        parrafo(bloque.texto);
        break;
      case "lista":
        lista(bloque.items, bloque.numerada);
        break;
      case "tabla":
        dibujarTabla(bloque.cabecera, bloque.filas, bloque.anchos);
        break;
      case "aviso":
        aviso(bloque.texto);
        break;
      case "buzones":
        dibujarTabla(["Buzón", "Uso"], filasDeBuzones(datos.buzones), [0.46, 0.54]);
        break;
      case "limites":
        dibujarTabla(["Concepto", "Valor del plan"], filasDeLimites(datos.limites), [0.36, 0.64]);
        break;
    }
  }

  await paginaDeFirmas();
  paginaDeEvidencia();

  // Cabecera y pie se dibujan al final: la paginación ya es definitiva.
  const total = paginas.length;
  paginas.forEach((p, indice) => {
    const yCabecera = A4.alto - 46;
    p.drawText("BLINK WEB SERVICES", {
      x: MARGEN.izq,
      y: yCabecera,
      size: 7.4,
      font: fuentes.sansBold,
      color: COLORES.secundario,
    });
    const etiqueta = `${doc.codigo} · v${doc.version}`;
    p.drawText(etiqueta, {
      x: A4.ancho - MARGEN.der - fuentes.sansBold.widthOfTextAtSize(etiqueta, 7.4),
      y: yCabecera,
      size: 7.4,
      font: fuentes.sansBold,
      color: COLORES.secundario,
    });
    p.drawLine({
      start: { x: MARGEN.izq, y: A4.alto - 54 },
      end: { x: A4.ancho - MARGEN.der, y: A4.alto - 54 },
      thickness: 0.6,
      color: COLORES.borde,
    });

    p.drawLine({
      start: { x: MARGEN.izq, y: MARGEN.inf - 10 },
      end: { x: A4.ancho - MARGEN.der, y: MARGEN.inf - 10 },
      thickness: 0.5,
      color: COLORES.bordeSuave,
    });
    p.drawText(`${doc.codigo} · v${doc.version}`, {
      x: MARGEN.izq,
      y: MARGEN.inf - 23,
      size: 7,
      font: fuentes.sans,
      color: COLORES.terciario,
    });
    const paginacion = `Página ${indice + 1} de ${total}`;
    p.drawText(paginacion, {
      x: A4.ancho / 2 - fuentes.sans.widthOfTextAtSize(paginacion, 7) / 2,
      y: MARGEN.inf - 23,
      size: 7,
      font: fuentes.sans,
      color: COLORES.terciario,
    });
    const credito = "Powered by Blink";
    p.drawText(credito, {
      x: A4.ancho - MARGEN.der - fuentes.sans.widthOfTextAtSize(credito, 7),
      y: MARGEN.inf - 23,
      size: 7,
      font: fuentes.sans,
      color: COLORES.terciario,
    });
  });

  pdf.setTitle(`${doc.codigo} — ${doc.titulo}`);
  pdf.setAuthor(bws);
  pdf.setSubject(doc.resumen);
  pdf.setCreator("Blink Web Services");
  pdf.setProducer("BWS · motor PDF 1.0");
  pdf.setLanguage("es-VE");
  const fecha = opciones.fechaCreacion ?? new Date(evidencia.utc);
  pdf.setCreationDate(fecha);
  pdf.setModificationDate(fecha);

  return pdf.save();
}

export type { Fuentes };
