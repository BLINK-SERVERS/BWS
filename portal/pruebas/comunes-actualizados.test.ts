import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CAMPO_POR_CLAVE } from "../legal/campos.ts";
import { canonica } from "../legal/canonica.ts";
import { datosDePrueba, DOCUMENTOS_BASE, DOCUMENTO_POR_CODIGO } from "../legal/index.ts";
import { DOCUMENTOS_COMUNES_ACTUALIZADOS } from "../legal/textos/comunes-actualizados.ts";
import type { DocumentoLegal } from "../legal/tipos.ts";
import { resolver, validarPlantilla, variablesUsadas } from "../legal/validar.ts";
import { hashPlantilla, sha256Hex } from "../render/hash.ts";

// Huellas de los objetos y del contenido usado para verificar expedientes históricos.
const HISTORICOS = {
  "BWS-REG-001": ["3.0", "2788a041aaa5befa42fccf0189f5d5a256550e5ec12b42d114cede4318fa5503", "ef05c14e29d5e59486dd10f88d7ce82f4a5a9607a1cf9f84dbb38a9b88d10dfb"],
  "BWS-LEG-002": ["2.0", "84fdf16297826a401173f4f24da4c00d0e887c6991898c0020c5aecf284486f8", "173c04e6dd6bcba1793b24f993b1ca798e95e9b9b7d4060b9adda2261c9adc05"],
  "BWS-LEG-003": ["3.0", "8d582725528aae9e7214ddc176e8fc37998d577e09be0e48b2948b6af69a6ca7", "6eeb93fe7df7c1f2308ac8f8fde4fb3e1e2cd083d69c27de927cc5b1768f0ae4"],
  "BWS-PRI-005": ["4.0", "1c88dadd371b86c490194be51d22c4248d3c264cecc22a8e1ca23f0f09334073", "7cdf542885e05f67ce53ba054c493443cc9c215915a3ee26ccc04c3a3395b946"],
  "BWS-WEB-006": ["1.0", "6bcc05c4bc73f1e3824122db65ed83baae4d0bfd9743a7467a2406126c77f749", "185e99fad1877bda95d742466bbca3f316bf63b14492d6c6c41aad3be0c82ab8"],
  "BWS-LIC-007": ["1.0", "4753e5d55acbea8a6494f58456071c2fb684cc6facb9850257e992e27d117a68", "3103ae4abd2285c87a729f87206f6007cb87f62f6d7f4df19fb6687b4a4da4e4"],
  "BWS-NDA-008": ["2.0", "cca78f62d1fd440a295b6d8204f02d28e96397be4f69b4ba2f57772727cee02b", "6d5f00a731b539244ff56dadd2a2e4cae2c148bd447dcec30b4357e6bfac02ad"],
} as const;

const porCodigo = new Map(DOCUMENTOS_COMUNES_ACTUALIZADOS.map((doc) => [doc.codigo, doc]));

function documento(codigo: keyof typeof HISTORICOS): DocumentoLegal {
  const doc = porCodigo.get(codigo);
  assert.ok(doc, codigo);
  return doc;
}

function textoVisible(doc: DocumentoLegal): string {
  const resuelto = resolver(doc, datosDePrueba());
  return [doc.titulo, doc.resumen, JSON.stringify(resuelto.bloques)].join("\n");
}

function textoDeSeccion(doc: DocumentoLegal, titulo: string): string {
  const inicio = doc.bloques.findIndex((bloque) => bloque.tipo === "subtitulo" && bloque.texto === titulo);
  assert.notEqual(inicio, -1, `${doc.codigo}: ${titulo}`);
  const siguientes = doc.bloques.slice(inicio + 1);
  const fin = siguientes.findIndex((bloque) => bloque.tipo === "subtitulo");
  return JSON.stringify(fin < 0 ? siguientes : siguientes.slice(0, fin));
}

describe("plantillas comunes actualizadas", () => {
  it("contiene exactamente los siete códigos, con la siguiente versión entera y el mismo momento de firma", () => {
    assert.equal(DOCUMENTOS_COMUNES_ACTUALIZADOS.length, 7);
    assert.equal(porCodigo.size, 7);
    assert.deepEqual([...porCodigo.keys()].sort(), Object.keys(HISTORICOS).sort());
    for (const anterior of DOCUMENTOS_BASE) {
      const nuevo = porCodigo.get(anterior.codigo);
      assert.ok(nuevo, anterior.codigo);
      assert.match(anterior.version, /^\d+\.0$/);
      assert.equal(nuevo.version, `${Number.parseInt(anterior.version, 10) + 1}.0`, anterior.codigo);
      assert.equal(nuevo.firma, anterior.firma, anterior.codigo);
      assert.notStrictEqual(nuevo, anterior);
      assert.notStrictEqual(nuevo.campos, anterior.campos);
      assert.notStrictEqual(nuevo.bloques, anterior.bloques);
      assert.notEqual(hashPlantilla(nuevo), hashPlantilla(anterior));
    }
  });

  it("declara exactamente las variables existentes utilizadas y resuelve cada texto", () => {
    for (const doc of DOCUMENTOS_COMUNES_ACTUALIZADOS) {
      assert.deepEqual(validarPlantilla(doc), [], doc.codigo);
      assert.equal(new Set(doc.campos).size, doc.campos.length, doc.codigo);
      assert.deepEqual([...doc.campos].sort(), variablesUsadas(doc).sort(), doc.codigo);
      for (const campo of doc.campos) assert.ok(CAMPO_POR_CLAVE.has(campo), `${doc.codigo}: ${campo}`);
      const resuelto = resolver(doc, datosDePrueba());
      assert.doesNotMatch(JSON.stringify(resuelto.bloques), /\{\{|\}\}/, doc.codigo);
    }
  });

  it("usa comparecencia fija y no expone códigos, abreviaturas, anexos ni caracteres prohibidos en sus textos", () => {
    for (const doc of DOCUMENTOS_COMUNES_ACTUALIZADOS) {
      const visible = textoVisible(doc);
      assert.match(visible, /DIEGO ANDRES BELEÑO VILLALOBOS/);
      assert.match(visible, /V-34\.201\.580/);
      assert.match(visible, /representación de BLINK TECHNOLOGY CORPORATION/);
      assert.match(visible, /J-50898639-3/);
      assert.doesNotMatch(visible, /BWS-[A-Z]{3}-\d{3}|[;«»]/, doc.codigo);
      assert.doesNotMatch(visible, /\banex[oa]s?\b/i, doc.codigo);
      const textoPlantilla = [doc.titulo, doc.resumen, JSON.stringify(doc.bloques)].join("\n");
      const sinNombresCompletos = textoPlantilla.replaceAll("BLINK TECHNOLOGY CORPORATION", "").replaceAll("Powered by Blink", "");
      assert.doesNotMatch(sinNombresCompletos, /\bBlink\b/i, doc.codigo);
      for (const campo of ["bws_razon_social", "bws_documento", "representante_nombre", "representante_documento"]) {
        assert.ok(!doc.campos.includes(campo), `${doc.codigo}: identidad no debe depender de ${campo}`);
      }
    }
  });

  it("fija condiciones comerciales coherentes sin depender de los valores históricos configurables", () => {
    const doc = documento("BWS-LEG-003");
    const texto = textoVisible(doc);
    assert.match(texto, /catorce \(14\) a cuarenta y dos \(42\) días hábiles desde la activación del dominio/);
    assert.match(texto, /mensualidad de desarrollo y mantenimiento parte de treinta y un dólares \(USD 31\)/);
    assert.match(texto, /tarifa mensual acordada se establece en el Contrato de servicios/);
    assert.match(texto, /primera demo funcional y los siguientes por adelantado/);
    assert.match(texto, /misma mensualidad corresponde al mantenimiento/);
    const alcance = textoDeSeccion(doc, "3. Alcance, cambios y entrega");
    assert.match(alcance, /incluye dos \(2\) rondas de cambios sobre la primera demo funcional/);
    assert.match(alcance, /demás cambios y funciones adicionales requieren un acuerdo escrito entre las partes sobre su precio y plazo propios y se pagan antes de ejecutarse/);
    assert.match(textoDeSeccion(doc, "9. Disponibilidad, soporte y responsabilidad"), /treinta \(30\) días siguientes a la entrega definitiva/);
    assert.match(texto, /dominio se registra a nombre y por cuenta de BLINK TECHNOLOGY CORPORATION/);
    assert.match(texto, /transferencia del dominio si el cliente la solicita/);
    assert.match(texto, /dominio permanece a nombre de BLINK TECHNOLOGY CORPORATION y puede transferirse a petición del cliente/);
    assert.match(texto, /No hay período de gracia/);
    assert.match(texto, /impagada después de su vencimiento/);
    assert.match(texto, /podrá suspender el servicio y la licencia, sin que la suspensión sea automática/);
    assert.match(texto, /mensualidades vencidas se acumulan como deuda mientras el contrato permanezca vigente, incluso durante la suspensión/);
    assert.match(texto, /deuda acumulada ni los intereses que correspondan conforme a lo pactado o a la ley/);
    assert.match(texto, /no fija una tasa de interés/);
    assert.doesNotMatch(texto, /(?:cinco|diez|treinta) \(\d+\) días (?:de gracia|de mora)/i);
    assert.doesNotMatch(texto, /\b\d+(?:[.,]\d+)?\s*(?:%|por ciento\b)/i);
    for (const campo of ["demo_plazo", "tarifa_desarrollo", "mantenimiento_precio", "credito_meses"]) {
      assert.ok(!doc.campos.includes(campo), campo);
    }
  });

  it("mantiene el crédito hasta la compra total acordada y pagada en condiciones y licencia", () => {
    const condiciones = textoVisible(documento("BWS-LEG-003"));
    const licencia = textoVisible(documento("BWS-LIC-007"));
    assert.match(condiciones, /Powered by Blink permanecerá visible hasta que las partes acuerden por escrito la compra total del proyecto y esta se pague íntegramente/);
    assert.match(licencia, /Powered by Blink permanece visible hasta que el operador y BLINK TECHNOLOGY CORPORATION acuerden por escrito la compra total del proyecto y esta se pague íntegramente/);
    assert.doesNotMatch(condiciones + licencia, /Powered by Blink.{0,50}(?:meses|años)/i);
    for (const codigo of ["BWS-REG-001", "BWS-LEG-002", "BWS-PRI-005", "BWS-WEB-006", "BWS-NDA-008"] as const) {
      assert.doesNotMatch(textoVisible(documento(codigo)), /USD 31|Powered by Blink|período de gracia/, codigo);
    }
  });

  it("aplica la condición fiscal declarada sin imponer facturas ni tributos indistintos", () => {
    const precio = textoDeSeccion(documento("BWS-LEG-003"), "4. Precio, dominio y pago");
    assert.match(precio, /tributos y las retenciones aplicables se gestionarán y los soportes o comprobantes correspondientes a cada operación se emitirán/i);
    assert.match(precio, /condición fiscal declarada por el cliente y la normativa aplicable/);
    assert.doesNotMatch(precio, /facturas?|se discriminan en la factura|los soporta el cliente/i);
    assert.doesNotMatch(precio, /(?:sin|no (?:se )?(?:cobra|aplica|emite)) (?:IVA|facturas?)/i);
  });

  it("establece la jurisdicción de Maracaibo sin excluir la jurisdicción legal del consumidor", () => {
    for (const [codigo, titulo] of [
      ["BWS-LEG-003", "11. Notificaciones y ley"],
      ["BWS-LIC-007", "8. Régimen aplicable y contacto"],
      ["BWS-NDA-008", "8. Régimen, firma y notificaciones"],
    ] as const) {
      const seccion = textoDeSeccion(documento(codigo), titulo);
      assert.match(seccion, /tribunales competentes de Maracaibo, Estado Zulia/, codigo);
      assert.doesNotMatch(seccion, /Caracas/, codigo);
      if (codigo !== "BWS-NDA-008") assert.match(seccion, /sin perjuicio de la jurisdicción.*consumidor/, codigo);
    }
    for (const doc of DOCUMENTOS_COMUNES_ACTUALIZADOS) {
      assert.doesNotMatch(JSON.stringify(doc.bloques), /\bCaracas\b/i, doc.codigo);
    }
  });

  it("protege la información anterior y mantiene la reserva hasta el acuerdo escrito posterior", () => {
    const doc = documento("BWS-NDA-008");
    const informacion = textoDeSeccion(doc, "1. Información confidencial");
    const excepciones = textoDeSeccion(doc, "2. Excepciones");
    const plazo = textoDeSeccion(doc, "5. Plazo y devolución");
    assert.match(informacion, /haya compartido con la otra antes de la firma o comparta durante la relación/);
    assert.match(informacion, /carácter reservado sea identificable razonablemente por su naturaleza o por las circunstancias/);
    assert.match(excepciones, /ya conocía lícitamente, sin deber de confidencialidad, por una fuente distinta de la parte divulgadora antes de recibirla de esta/);
    assert.match(plazo, /durante la relación y después de su terminación hasta que las partes acuerden por escrito, en un acuerdo posterior, términos definitivos de confidencialidad/);
    assert.match(plazo, /obligaciones legales sobre datos personales y secretos comerciales se mantienen conforme a la ley/);
    assert.match(plazo, /devuelve o destruye la información confidencial/);
    assert.match(plazo, /conservación autorizada sigue sujeta a las obligaciones de confidencialidad aplicables/);
    assert.doesNotMatch(JSON.stringify(doc.bloques), /(?:cinco|5)\s*(?:\(5\)\s*)?años/i);
  });

  it("conserva información útil sobre consentimiento, firma y privacidad sin certificarla", () => {
    const firma = textoVisible(documento("BWS-LEG-002"));
    for (const expresion of [
      /firma electrónica simple con evidencia reforzada/i,
      /No es una firma electrónica certificada/i,
      /No se presenta como equivalente a la firma autógrafa/i,
      /ni se le atribuye validez probatoria plena/i,
      /SHA-256/,
      /fecha y hora en UTC/i,
      /dirección IP/i,
      /agente de usuario/i,
      /referencias conservadas no hayan sido también alteradas/i,
      /retirar su consentimiento para firmas futuras/i,
      /firma en papel/i,
      /prestador acreditado/i,
      /copia o exportación/i,
      /no firme todavía/i,
    ]) assert.match(firma, expresion);

    const privacidad = textoVisible(documento("BWS-PRI-005"));
    for (const expresion of [
      /Identidad/, /Contacto/, /Firma/, /Evidencia/, /Facturación/, /Finalidad/,
      /Neon/, /Cloudflare/, /correo transaccional/, /transferencias fuera de Venezuela/,
      /consiente las transferencias necesarias descritas/,
      /No debe consentir hasta entender la información necesaria/,
      /retirar el consentimiento para tratamientos futuros/,
      /noventa \(90\) días/, /diez \(10\) años/, /rectificación/, /exportación/,
      /no para identificación biométrica/, /ningún sistema garantiza seguridad absoluta/i,
      /setenta y dos \(72\) horas/, /no declara conformidad con una norma ISO/i,
    ]) assert.match(privacidad, expresion);
    const cookies = textoVisible(documento("BWS-WEB-006"));
    assert.match(cookies, /consentimiento previo, informado y revocable/);
    assert.match(cookies, /Hasta 12 horas o hasta cerrar sesión/);
  });

  it("mantiene intactos los objetos y huellas históricos y el índice aún apunta a ellos", () => {
    assert.equal(DOCUMENTOS_BASE.length, 7);
    for (const doc of DOCUMENTOS_BASE) {
      const esperado = HISTORICOS[doc.codigo as keyof typeof HISTORICOS];
      assert.ok(esperado, doc.codigo);
      assert.equal(doc.version, esperado[0], doc.codigo);
      assert.equal(sha256Hex(canonica(doc)), esperado[1], doc.codigo);
      assert.equal(hashPlantilla(doc), esperado[2], doc.codigo);
      assert.strictEqual(DOCUMENTO_POR_CODIGO.get(doc.codigo), doc);
    }
  });
});
