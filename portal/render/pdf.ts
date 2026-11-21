/* ============================================================
   Motor PDF del expediente
   ------------------------------------------------------------
   Genera un PDF 1.7 en A4 con fuentes embebidas, membrete,
   paginación y página de firmas. El sello y el hash del PDF se
   calculan y guardan fuera del archivo (ver hash.ts).

   Lo que este motor NO hace: no declara PDF/A, no firma con
   certificado digital, no incrusta una estampilla de tiempo de una
   autoridad. Lo que sí hace: deja el documento verificable contra
   los sellos y actos guardados en la base.
   ============================================================ */

import { PDFDocument, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import qrcode from "qrcode-generator";
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
  CLASICO,
  COLORES,
  MARGEN,
  cargarFuentes,
  envolver,
  envolverRuns,
  type Fuentes,
  type LineaRuns,
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
  /** URL real de verificación; si falta, no se dibuja ningún QR. */
  urlVerificacion?: string;
}

// Tamaños del estilo histórico (Liberation): se conservan idénticos para
// que los PDF ya firmados puedan volver a generarse byte a byte.
const TAMANO_CUERPO = 10;
const INTERLINEADO_CUERPO = 14.2;
const TAMANO_CELDA = 8.6;
const INTERLINEADO_CELDA = 11.4;
const RELLENO_CELDA = 5;
/** Guía del lienzo de firma (720 × 200, línea en 120): 60 % del alto. */
const GUIA_FIRMA = 0.6;

interface Celda {
  lineas: string[];
  fuente: PDFFont;
  tamano: number;
  interlineado: number;
}

export async function generarPDF(opciones: OpcionesPDF): Promise<Uint8Array> {
  const { doc, datos, firmas, evidencia } = opciones;
  const clasico = doc.estilo === "clasico";
  const pdf = await PDFDocument.create();
  const fuentes = await cargarFuentes(pdf, opciones.leerFuente ?? lectorDeFuentes(), { inter: clasico });

  // En el estilo clásico las fuentes serif y sans son Inter: el cuerpo va
  // en 12 con interlineado 18 (1.5) y las celdas acompañan ese tamaño.
  const tamanoCuerpo = clasico ? CLASICO.cuerpo : TAMANO_CUERPO;
  const interlineadoCuerpo = clasico ? CLASICO.interlineadoCuerpo : INTERLINEADO_CUERPO;
  const tamanoCelda = clasico ? CLASICO.celda : TAMANO_CELDA;
  const interlineadoCelda = clasico ? CLASICO.interlineadoCelda : INTERLINEADO_CELDA;

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

  function lineaJustificada(
    linea: LineaRuns,
    fuente: PDFFont,
    fuenteBold: PDFFont,
    tamano: number,
    color: typeof COLORES.tinta,
    xInicial: number,
    yLinea: number,
    ancho: number,
  ) {
    const espacioBase = fuente.widthOfTextAtSize(" ", tamano);
    const huecos = Math.max(linea.palabras.length - 1, 0);
    // anchoTexto ya incluye los espacios normales entre palabras.
    const extra = !linea.final && huecos > 0 ? Math.max((ancho - linea.anchoTexto) / huecos, 0) : 0;
    let x = xInicial;
    for (const palabra of linea.palabras) {
      texto(palabra.texto, palabra.negrita ? fuenteBold : fuente, tamano, color, x, yLinea);
      x += palabra.ancho + espacioBase + extra;
    }
  }

  /** Justifica cada párrafo, salvo su última línea, conservando las negritas inline. */
  function parrafo(
    contenido: string,
    opcionesParrafo?: {
      fuente?: PDFFont;
      fuenteBold?: PDFFont;
      tamano?: number;
      interlineado?: number;
      color?: typeof COLORES.tinta;
      espacio?: number;
      /** Líneas mínimas que deben caber antes de empezar (ordinal + texto). */
      minLineas?: number;
    },
  ) {
    const fuente = opcionesParrafo?.fuente ?? fuentes.serif;
    const fuenteBold = opcionesParrafo?.fuenteBold ?? fuentes.serifBold;
    const tamano = opcionesParrafo?.tamano ?? tamanoCuerpo;
    const interlineado = opcionesParrafo?.interlineado ?? interlineadoCuerpo;
    const color = opcionesParrafo?.color ?? COLORES.tinta;
    const lineas = envolverRuns(contenido, fuente, fuenteBold, tamano, ANCHO_CONTENIDO);
    if (opcionesParrafo?.minLineas) {
      asegurar(Math.min(lineas.length, opcionesParrafo.minLineas) * interlineado);
    }
    for (const linea of lineas) {
      if (y - interlineado < MARGEN.inf) nuevaPagina();
      lineaJustificada(linea, fuente, fuenteBold, tamano, color, MARGEN.izq, y, ANCHO_CONTENIDO);
      y -= interlineado;
    }
    y -= opcionesParrafo?.espacio ?? (clasico ? 10 : 7);
  }

  function centrado(contenido: string, fuente: PDFFont, tamano: number, interlineado: number) {
    for (const linea of envolver(contenido, fuente, tamano, ANCHO_CONTENIDO)) {
      const anchoLinea = fuente.widthOfTextAtSize(linea, tamano);
      texto(linea, fuente, tamano, COLORES.tinta, MARGEN.izq + (ANCHO_CONTENIDO - anchoLinea) / 2, y);
      y -= interlineado;
    }
  }

  function subtitulo(contenido: string) {
    if (clasico) {
      asegurar(CLASICO.interlineadoCapitulo + 14);
      y -= 4;
      centrado(contenido, fuentes.serif, CLASICO.capitulo, CLASICO.interlineadoCapitulo);
      y -= 8;
      return;
    }
    asegurar(36);
    y -= 5;
    texto(contenido, fuentes.sansBold, 10.5, COLORES.tinta, MARGEN.izq, y);
    y -= 15;
  }

  function tituloBloque(contenido: string) {
    if (clasico) {
      asegurar(CLASICO.interlineadoTitulo + 14);
      y -= 4;
      centrado(contenido, fuentes.serifBold, CLASICO.titulo, CLASICO.interlineadoTitulo);
      y -= 6;
      return;
    }
    asegurar(44);
    y -= 8;
    const lineas = envolver(contenido, fuentes.sansBold, 12.5, ANCHO_CONTENIDO);
    for (const linea of lineas) {
      texto(linea, fuentes.sansBold, 12.5, COLORES.tinta, MARGEN.izq, y);
      y -= 16;
    }
    y -= 5;
  }

  function capitulo(contenido: string, bajada?: string) {
    const lineas = envolver(contenido, fuentes.serifBold, CLASICO.capitulo, ANCHO_CONTENIDO);
    const lineasBajada = bajada ? envolver(bajada, fuentes.serif, CLASICO.capitulo, ANCHO_CONTENIDO) : [];
    asegurar((lineas.length + lineasBajada.length) * CLASICO.interlineadoCapitulo + 22);
    y -= 10;
    centrado(contenido, fuentes.serifBold, CLASICO.capitulo, CLASICO.interlineadoCapitulo);
    if (bajada) centrado(bajada, fuentes.serif, CLASICO.capitulo, CLASICO.interlineadoCapitulo);
    y -= 8;
  }

  function clausula(ordinal: string, contenido: string) {
    parrafo(`**${ordinal}** ${contenido}`, { minLineas: 2 });
  }

  function lista(items: string[]) {
    for (const item of items) parrafo(item, { espacio: 4 });
    y -= 6;
  }

  function celdasDe(fila: string[], anchos: number[]): Celda[] {
    return fila.map((valor, i) => ({
      lineas: envolver(valor, fuentes.serif, tamanoCelda, anchos[i] - RELLENO_CELDA * 2),
      fuente: fuentes.serif,
      tamano: tamanoCelda,
      interlineado: interlineadoCelda,
    }));
  }

  function altoDeFila(celdas: Celda[]): number {
    return Math.max(...celdas.map((c) => c.lineas.length * c.interlineado)) + RELLENO_CELDA * 2;
  }

  function dibujarCabeceraTabla(celdas: Celda[], anchos: number[]) {
    const alto = altoDeFila(celdas);
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

  function dibujarTabla(cabecera: string[], filas: string[][], proporciones?: number[]) {
    if (!cabecera.length || filas.some((fila) => fila.length !== cabecera.length)) {
      throw new Error("La tabla debe tener cabecera y el mismo número de celdas en cada fila.");
    }
    if (proporciones && (proporciones.length !== cabecera.length || proporciones.some((n) => !Number.isFinite(n) || n <= 0))) {
      throw new Error("Las proporciones de la tabla no son válidas.");
    }
    const total = proporciones?.reduce((a, b) => a + b, 0) ?? cabecera.length;
    const anchos = cabecera.map((_, i) => ((proporciones?.[i] ?? 1) / total) * ANCHO_CONTENIDO);
    if (anchos.some((ancho) => ancho <= RELLENO_CELDA * 2)) {
      throw new Error("Una columna de la tabla es demasiado estrecha para su contenido.");
    }
    const celdasCabecera = cabecera.map((valor, i) => {
      const fuente = fuentes.sansBold;
      const tamano = clasico ? 9.5 : 8.1;
      return {
        lineas: envolver(valor, fuente, tamano, anchos[i] - RELLENO_CELDA * 2),
        fuente,
        tamano,
        interlineado: clasico ? 13 : 10.4,
      };
    });
    const filasMedidas = filas.map((fila) => celdasDe(fila, anchos));
    for (const fila of [celdasCabecera, ...filasMedidas]) {
      fila.forEach((celda, i) => {
        if (celda.lineas.some((linea) => celda.fuente.widthOfTextAtSize(linea, celda.tamano) > anchos[i] - RELLENO_CELDA * 2 + 0.001)) {
          throw new Error("Una columna de la tabla es demasiado estrecha para mostrar su contenido completo.");
        }
      });
    }
    const altoTabla = altoDeFila(celdasCabecera) + filasMedidas.reduce((suma, fila) => suma + altoDeFila(fila), 0);
    const altoPagina = A4.alto - MARGEN.sup - MARGEN.inf;
    if (altoTabla > altoPagina) {
      throw new Error(`La tabla «${cabecera.join(" / ")}» es demasiado alta para caber completa en una página.`);
    }
    // Reservar también un margen amplio cuando quepa en la misma página.
    const espacioPosterior = 24;
    const altoReservado = altoTabla + espacioPosterior <= altoPagina ? altoTabla + espacioPosterior : altoTabla;
    asegurar(altoReservado);
    dibujarCabeceraTabla(celdasCabecera, anchos);
    filasMedidas.forEach((celdas, indice) => {
      const alto = altoDeFila(celdas);
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
    y -= espacioPosterior;
  }

  function aviso(contenido: string) {
    const tamano = clasico ? 10.5 : 9.2;
    const interlineado = clasico ? 14.5 : 12.8;
    const ancho = ANCHO_CONTENIDO - 26;
    const lineas = envolverRuns(contenido, fuentes.serif, fuentes.serifBold, tamano, ancho);
    const alto = lineas.length * interlineado + 20;
    if (alto + 8 > A4.alto - MARGEN.sup - MARGEN.inf) {
      parrafo(contenido, { tamano, interlineado, color: COLORES.secundario });
      return;
    }
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
    let yLinea = y - 10 - tamano;
    for (const linea of lineas) {
      lineaJustificada(linea, fuentes.serif, fuentes.serifBold, tamano, COLORES.secundario, MARGEN.izq + 14, yLinea, ancho);
      yLinea -= interlineado;
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

  interface DatoFirma {
    lineas: string[];
    fuente: PDFFont;
    tamano: number;
  }

  function datosFirma(valores: string[], ancho: number): DatoFirma[] {
    return valores.map((valor, indice) => {
      const fuente = indice === 0 ? fuentes.sansBold : fuentes.sans;
      const tamano = indice === 0 ? 9 : 8.4;
      return { lineas: envolver(valor, fuente, tamano, ancho - 24), fuente, tamano };
    });
  }

  function crearCaja(
    x: number,
    yCaja: number,
    ancho: number,
    alto: number,
    etiqueta: string,
    datosCaja: DatoFirma[],
    imagen: PDFImage | null,
  ) {
    pagina.drawRectangle({ x, y: yCaja, width: ancho, height: alto, borderColor: COLORES.borde, borderWidth: 0.7 });
    texto(etiqueta, fuentes.sansBold, 9, COLORES.tinta, x + 12, yCaja + alto - 18);

    const yFirma = yCaja + alto - 100;
    if (imagen) {
      const escala = Math.min((ancho - 24) / imagen.width, 62 / imagen.height);
      const anchoImg = imagen.width * escala;
      const altoImg = imagen.height * escala;
      pagina.drawImage(imagen, {
        x: x + (ancho - anchoImg) / 2,
        // La guía del lienzo apoya en la línea, sin recortar la firma.
        y: yFirma - altoImg * (1 - GUIA_FIRMA),
        width: anchoImg,
        height: altoImg,
      });
    }
    pagina.drawLine({
      start: { x: x + 12, y: yFirma },
      end: { x: x + ancho - 12, y: yFirma },
      thickness: 0.6,
      color: COLORES.borde,
    });

    let yDatos = yCaja + alto - 145;
    datosCaja.forEach((dato, indice) => {
      for (const linea of dato.lineas) {
        texto(linea, dato.fuente, dato.tamano, indice === 0 ? COLORES.tinta : COLORES.secundario, x + 12, yDatos);
        yDatos -= 12;
      }
    });
  }

  async function paginaDeFirmas() {
    nuevaPagina();
    texto("Firmas", fuentes.serifBold, 17, COLORES.tinta, MARGEN.izq, y);
    y -= 27;

    const anchoCaja = (ANCHO_CONTENIDO - 18) / 2;
    const representante = datosFirma(["DIEGO BELEÑO", "V-34.201.580", "business@blink.com.ve", "0424-6603660"], anchoCaja);
    const correoCliente = firmas.cliente.correo || datos.variables.cliente_correo;
    const cliente = datosFirma(
      [datos.variables.cliente_razon_social, firmas.cliente.documento, ...(correoCliente ? [correoCliente] : [])],
      anchoCaja,
    );
    const numeroLineas = (campos: DatoFirma[]) => campos.reduce((total, campo) => total + campo.lineas.length, 0);
    const altoCaja = 155 + Math.max(numeroLineas(representante), numeroLineas(cliente)) * 12;

    let qr: ReturnType<typeof qrcode> | undefined;
    let tamanoQR = 0;
    if (opciones.urlVerificacion !== undefined) {
      if (!opciones.urlVerificacion.trim()) throw new Error("La URL de verificación no puede estar vacía.");
      try {
        qr = qrcode(0, "M");
        // La biblioteca no añade ECI: codificar Unicode como URI evita que los lectores
        // interpreten esos bytes como otra codificación sin alterar los escapes existentes.
        const url = opciones.urlVerificacion.replace(/[^\x00-\x7f]/gu, (caracter) => encodeURIComponent(caracter));
        qr.addData(url, "Byte");
        qr.make();
      } catch (error) {
        throw new Error(`No se pudo generar el QR de verificación: ${String(error)}`);
      }
      // Cuatro módulos de zona silenciosa por lado y al menos 1,5 pt por módulo.
      tamanoQR = Math.max(120, (qr.getModuleCount() + 8) * 1.5);
    }
    if (altoCaja + (qr ? 24 + tamanoQR : 0) > y - MARGEN.inf) {
      throw new Error("Los datos de la hoja de firmas no caben completos en una página.");
    }
    const yCaja = y - altoCaja;

    async function imagenDeFirma(firma: FirmaCapturada, etiqueta: string): Promise<PDFImage | null> {
      if (!firma.png) return null;
      try {
        return await pdf.embedPng(firma.png);
      } catch {
        throw new Error(`No se pudo incorporar la imagen de firma de ${etiqueta}.`);
      }
    }
    const imagenRepresentante = await imagenDeFirma(firmas.representante, "representante");
    const imagenCliente = await imagenDeFirma(firmas.cliente, "cliente");

    crearCaja(
      MARGEN.izq,
      yCaja,
      anchoCaja,
      altoCaja,
      "Firma representante legal",
      representante,
      imagenRepresentante,
    );
    crearCaja(
      MARGEN.izq + anchoCaja + 18,
      yCaja,
      anchoCaja,
      altoCaja,
      "Firma cliente",
      cliente,
      imagenCliente,
    );

    if (qr) {
      const modulos = qr.getModuleCount();
      const modulo = tamanoQR / (modulos + 8);
      const xQR = MARGEN.izq + (ANCHO_CONTENIDO - tamanoQR) / 2;
      const yQR = yCaja - 24 - tamanoQR;
      pagina.drawRectangle({ x: xQR, y: yQR, width: tamanoQR, height: tamanoQR, color: COLORES.blanco });
      for (let fila = 0; fila < modulos; fila++) {
        let columna = 0;
        while (columna < modulos) {
          if (!qr.isDark(fila, columna)) {
            columna++;
            continue;
          }
          const inicio = columna;
          while (columna < modulos && qr.isDark(fila, columna)) columna++;
          pagina.drawRectangle({
            x: xQR + (inicio + 4) * modulo,
            y: yQR + (modulos + 3 - fila) * modulo,
            width: (columna - inicio) * modulo,
            height: modulo,
            color: COLORES.tinta,
          });
        }
      }
    }
  }

  // ---------- Construcción ----------
  pagina = nuevaPagina();

  // El contrato clásico incorpora su título en los propios bloques.
  if (!clasico) {
    const lineasTitulo = envolver(doc.titulo, fuentes.serifBold, 18, ANCHO_CONTENIDO);
    for (const linea of lineasTitulo) {
      if (y - 22 < MARGEN.inf) nuevaPagina();
      texto(linea, fuentes.serifBold, 18, COLORES.tinta, MARGEN.izq, y);
      y -= 22;
    }
    y -= 2;
    parrafo(doc.resumen, {
      fuente: fuentes.serifItalic,
      fuenteBold: fuentes.serifItalic,
      tamano: 9.4,
      interlineado: 13,
      color: COLORES.secundario,
      espacio: 16,
    });
  } else if (!doc.bloques.some((bloque) => bloque.tipo === "titulo")) {
    // Los documentos comunes actualizados van en el estilo clásico pero no
    // llevan bloque de título: el título visible se dibuja aquí, centrado.
    y -= 4;
    centrado(doc.titulo, fuentes.serifBold, CLASICO.titulo, CLASICO.interlineadoTitulo);
    y -= 10;
    if (doc.resumen) {
      parrafo(doc.resumen, { color: COLORES.secundario, espacio: 16 });
    }
  }

  for (let indice = 0; indice < doc.bloques.length; indice++) {
    const bloque = doc.bloques[indice];
    switch (bloque.tipo) {
      case "titulo":
        tituloBloque(bloque.texto);
        break;
      case "subtitulo":
        subtitulo(bloque.texto);
        break;
      case "parrafo": {
        // Regla 1.4: el párrafo que introduce una lista o tabla viaja con su
        // primer elemento, nunca queda solo al pie de la hoja.
        const despues = doc.bloques[indice + 1];
        const agrupa = despues && ["lista", "tabla", "buzones", "limites"].includes(despues.tipo);
        if (agrupa && /:\s*$/.test(bloque.texto)) {
          const lineas = envolverRuns(bloque.texto, fuentes.serif, fuentes.serifBold, tamanoCuerpo, ANCHO_CONTENIDO).length;
          asegurar(lineas * interlineadoCuerpo + 2 * interlineadoCuerpo + 18);
        }
        parrafo(bloque.texto);
        break;
      }
      case "lista":
        lista(bloque.items);
        break;
      case "tabla":
        dibujarTabla(bloque.cabecera, bloque.filas, bloque.anchos);
        break;
      case "aviso":
        aviso(bloque.texto);
        break;
      case "capitulo":
        if (/^BWS-CON-/i.test(doc.codigo) && /^CAP[IÍ]TULO\s+II(?:\s|$)/i.test(bloque.texto.trim())) {
          nuevaPagina();
        }
        capitulo(bloque.texto, bloque.subtitulo);
        break;
      case "clausula":
        clausula(bloque.ordinal, bloque.texto);
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

  // El membrete es fijo; el único pie es la paginación, sin códigos ni datos variables.
  const total = paginas.length;
  const membrete = [
    "Blink Technology Corporation",
    "División: Blink Web Services (BWS)",
    "RIF: J-50898639-3",
  ];
  paginas.forEach((p, indice) => {
    membrete.forEach((linea, i) => {
      p.drawText(linea, {
        x: MARGEN.izq,
        y: A4.alto - 26 - i * 10,
        size: 8,
        font: fuentes.sans,
        color: COLORES.secundario,
      });
    });
    // La hoja de firmas no lleva pie.
    if (indice === total - 1) return;
    const paginacion = `Página ${indice + 1} de ${total}`;
    p.drawText(paginacion, {
      x: A4.ancho / 2 - fuentes.sans.widthOfTextAtSize(paginacion, 7) / 2,
      y: MARGEN.inf - 23,
      size: 7,
      font: fuentes.sans,
      color: COLORES.terciario,
    });
  });

  pdf.setTitle(doc.titulo);
  pdf.setAuthor("Blink Technology Corporation");
  pdf.setSubject(doc.resumen);
  pdf.setCreator("Blink Web Services");
  pdf.setProducer("BWS motor PDF 1.0");
  pdf.setLanguage("es-VE");
  const fecha = opciones.fechaCreacion ?? new Date(evidencia.utc);
  pdf.setCreationDate(fecha);
  pdf.setModificationDate(fecha);

  return pdf.save();
}

export type { Fuentes };
