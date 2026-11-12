import type { DocumentoLegal } from "../tipos";

export const REG_001: DocumentoLegal = {
  codigo: "BWS-REG-001",
  titulo: "Datos de identidad y fiscales del cliente",
  version: "3.0",
  fecha: "2026-11-12",
  firma: "registro",
  resumen:
    "Ficha de identificación del cliente y del prestador, con las declaraciones que sostienen el resto del expediente.",
  campos: [
    "fecha_documento",
    "bws_razon_social",
    "bws_documento",
    "bws_domicilio",
    "bws_correo",
    "bws_telefono",
    "cliente_razon_social",
    "cliente_documento_tipo",
    "cliente_documento_numero",
    "cliente_domicilio",
    "cliente_telefono",
    "cliente_correo",
    "cliente_correo_factura",
  ],
  bloques: [
    {
      tipo: "parrafo",
      texto:
        "Este documento identifica a las partes y deja constancia de los datos que el cliente declara para la contratación de los servicios de Blink. Se completa y firma antes de contratar el proyecto.",
    },
    { tipo: "subtitulo", texto: "1. Cliente" },
    {
      tipo: "tabla",
      cabecera: ["Dato", "Valor declarado"],
      anchos: [0.34, 0.66],
      filas: [
        ["Razón social o nombre", "{{cliente_razon_social}}"],
        ["Tipo de documento", "{{cliente_documento_tipo}}"],
        ["Número de documento", "{{cliente_documento_numero}}"],
        ["Domicilio fiscal", "{{cliente_domicilio}}"],
        ["Teléfono", "{{cliente_telefono}}"],
        ["Correo electrónico", "{{cliente_correo}}"],
        ["Correo de facturación", "{{cliente_correo_factura}}"],
      ],
    },
    { tipo: "subtitulo", texto: "2. Prestador" },
    {
      tipo: "tabla",
      cabecera: ["Dato", "Valor"],
      anchos: [0.34, 0.66],
      filas: [
        ["Razón social", "{{bws_razon_social}}"],
        ["Documento", "{{bws_documento}}"],
        ["Domicilio fiscal", "{{bws_domicilio}}"],
        ["Correo", "{{bws_correo}}"],
        ["Teléfono", "{{bws_telefono}}"],
      ],
    },
    { tipo: "subtitulo", texto: "3. Declaraciones del cliente" },
    {
      tipo: "lista",
      numerada: true,
      items: [
        "Los datos de esta ficha son veraces, completos y están vigentes a la fecha de firma.",
        "Tiene capacidad legal para contratar y actúa en nombre propio o con representación suficiente, que puede ser acreditada si se solicita.",
        "El domicilio fiscal indicado es el lugar donde recibe las notificaciones y donde se entienden practicadas las comunicaciones de Blink.",
        "El correo electrónico indicado es válido para recibir avisos, facturas y expedientes. Si cambia, lo informará por escrito.",
        "Se compromete a notificar cualquier cambio de razón social, documento, domicilio, teléfono o correo dentro de los cinco (5) días hábiles siguientes.",
        "Autoriza el uso del correo electrónico para las notificaciones relacionadas con el servicio y con este expediente.",
        "Entiende que Blink puede solicitar copia legible de la cédula o del RIF para verificar la identidad, y que la falta de colaboración puede impedir la contratación o la entrega.",
      ],
    },
    { tipo: "subtitulo", texto: "4. Tratamiento de los datos" },
    {
      tipo: "parrafo",
      texto:
        "Los datos de esta ficha se tratan conforme a la Política de privacidad y tratamiento de datos (BWS-PRI-005), que forma parte del expediente. Incluyen datos de identidad, fiscales y de contacto, y se conservan mientras dure la relación y durante los plazos necesarios para atender obligaciones o reclamaciones.",
    },
    { tipo: "subtitulo", texto: "5. Firma" },
    {
      tipo: "parrafo",
      texto:
        "Este documento se firma con la firma electrónica simple capturada en el registro, con evidencia reforzada. No se trata de una firma electrónica certificada y no se le atribuye la equivalencia de una firma autógrafa. El alcance y los límites de esa firma se explican en el documento BWS-LEG-002, que se firma antes de capturar el trazo.",
    },
    {
      tipo: "aviso",
      texto:
        "Esta ficha no sustituye al RIF, a la cédula de identidad ni a ningún registro público. No se declara certificación ni conformidad con norma ISO alguna.",
    },
  ],
};
