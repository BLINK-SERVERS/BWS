/* ============================================================
   Revisor de afirmaciones — BWS
   ------------------------------------------------------------
   Falla si un texto legal afirma algo que el sistema no puede
   demostrar. La regla no es estética: un contrato con una promesa
   falsa es peor que no tener contrato.

   Un término prohibido se acepta solo si la misma frase lo niega
   («no es una firma certificada», «no se declara PDF/A», «no se
   afirma que el registro sea inmutable»).

   npx tsx scripts/revisar-afirmaciones.mjs
   ============================================================ */

import { DOCUMENTOS } from "../legal/index.ts";

const NEGACION = /\b(no|ni|nunca|jamás|sin|tampoco|ningún|ninguna|ninguno)\b/i;
// Hablar de una alternativa que el cliente puede pedir no es afirmar que
// el portal la ofrece: «si su contrato exige firma certificada, dígalo».
const ALTERNATIVA = /\b(necesita|requiere|exige|solicit\w*|puede\s+(pedir|solicitar)|acudir\s+a)\b/i;

const REGLAS = [
  {
    id: "firma-certificada",
    motivo: "la firma capturada no es certificada: es simple con evidencia reforzada",
    patron: /\bcertificad[ao]s?\b/i,
  },
  {
    id: "equivalencia-autografa",
    motivo: "la firma simple no equivale a la firma autógrafa",
    patron: /(equivalen(te|cia)|equivale)\s+(a\s+)?(la\s+|una\s+)?firma\s+aut[óo]grafa/i,
  },
  {
    id: "validez-plena",
    motivo: "no se atribuye validez o valor probatorio pleno",
    patron: /(validez|valor)\s+probatori[oa]\s+plen[oa]|plena\s+validez/i,
  },
  {
    id: "pdf-a",
    motivo: "no hay validación PDF/A: se declara PDF 1.7 sellado",
    patron: /PDF\/A/i,
  },
  {
    id: "iso",
    motivo: "no hay certificación ISO: no se declara conformidad",
    patron: /\bISO(\/IEC)?\s?\d{3,5}\b|norma\s+ISO|cumple\s+ISO|conformidad\s+con\s+(la\s+)?(norma\s+)?ISO/i,
  },
  {
    id: "seguridad-absoluta",
    motivo: "no se promete seguridad absoluta: se describen medidas razonables",
    patron: /(100\s?%|cien\s+por\s+ciento)\s*(de\s+)?segur|totalmente\s+segur|completamente\s+segur|seguridad\s+(total|absoluta)/i,
  },
  {
    id: "inmutabilidad",
    motivo: "no se afirma inmutabilidad: se afirma alteración detectable",
    patron: /\binmutab\w*|imposible\s+de\s+(alterar|modificar)/i,
  },
  {
    id: "garantia-absoluta",
    motivo: "no se garantiza un resultado ni la ausencia de fallas",
    patron: /garantizamos\s+(el\s+resultado|la\s+seguridad|la\s+validez)|garant[íi]a\s+(total|absoluta)/i,
  },
  {
    id: "disponibilidad-total",
    motivo: "no se promete disponibilidad absoluta ni ausencia de caídas",
    patron: /99[.,]9+\s*%|disponibilidad\s+(total|absoluta|garantizada)|(servicio|sistema|portal)\s+(siempre\s+)?(en\s+l[ií]nea|disponible)\s+(siempre|24|todo\s+el\s+d[ií]a)|nunca\s+(falla|se\s+cae)/i,
  },
  {
    id: "borrado-definitivo",
    motivo: "no se promete un borrado definitivo o inmediato: se cumple el plazo y se avisa",
    patron: /borrad[oa]s?\s+(definitiv\w+|de\s+inmediato|para\s+siempre)|eliminaci[oó]n\s+(definitiva|garantizada|inmediata)/i,
  },
  {
    id: "respaldo-permanente",
    motivo: "no se promete un respaldo permanente o indefinido",
    patron: /respald\w+\s+(permanente|indefinido|eterno)|copias?\s+de\s+seguridad\s+(permanentes?|indefinidas?|eternas?)/i,
  },
  {
    id: "acceso-inviolable",
    motivo: "ninguna medida técnica se declara inviolable",
    patron: /inviolab\w+|nadie\s+puede\s+(acceder|leer|modificar)|acceso\s+imposible/i,
  },
];

/** @param {import("../legal/tipos.ts").Bloque} bloque */
function textoDeBloque(bloque) {
  switch (bloque.tipo) {
    case "titulo":
    case "subtitulo":
    case "parrafo":
    case "aviso":
      return bloque.texto;
    case "lista":
      return bloque.items.join("\n");
    case "tabla":
      return [bloque.cabecera.join(" | "), ...bloque.filas.map((f) => f.join(" | "))].join("\n");
    case "buzones":
    case "limites":
      return "";
  }
}

/** @param {import("../legal/tipos.ts").DocumentoLegal} doc */
function frases(doc) {
  const texto = [doc.titulo, doc.resumen, ...doc.bloques.map(textoDeBloque)].join("\n");
  return texto
    .split(/(?<=[.!?])\s+|\n+/)
    .map((f) => f.trim())
    .filter(Boolean);
}

const hallazgos = [];
let aceptadas = 0;

for (const doc of DOCUMENTOS) {
  for (const frase of frases(doc)) {
    for (const regla of REGLAS) {
      if (!regla.patron.test(frase)) continue;
      if (NEGACION.test(frase) || ALTERNATIVA.test(frase)) {
        aceptadas += 1;
        continue;
      }
      hallazgos.push({ codigo: doc.codigo, regla: regla.id, motivo: regla.motivo, frase });
    }
  }
}

if (hallazgos.length) {
  console.error(`✗ ${hallazgos.length} afirmaciones sin calificar:`);
  for (const h of hallazgos) {
    console.error(`  ${h.codigo} · ${h.regla}: ${h.motivo}`);
    console.error(`    «${h.frase}»`);
  }
  process.exit(1);
}

console.log(
  `✓ ${DOCUMENTOS.length} documentos revisados: ninguna afirmación prohibida sin negar (${aceptadas} menciones correctamente calificadas).`,
);
