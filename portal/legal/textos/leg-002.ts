import type { DocumentoLegal } from "../tipos";

export const LEG_002: DocumentoLegal = {
  codigo: "BWS-LEG-002",
  titulo: "Consentimiento informado para el uso de firma electrónica no certificada",
  version: "1.0",
  fecha: "2026-11-11",
  firma: "registro",
  resumen:
    "Explica qué firma se captura, qué significa y qué no, cómo se conserva la evidencia y qué alternativas existen. Se firma antes del trazo.",
  campos: [
    "fecha_documento",
    "bws_razon_social",
    "bws_correo",
    "cliente_razon_social",
    "cliente_documento_tipo",
    "cliente_documento_numero",
    "cliente_correo",
  ],
  bloques: [
    {
      tipo: "parrafo",
      texto:
        "Este documento se entrega a {{cliente_razon_social}}, documento {{cliente_documento_tipo}} {{cliente_documento_numero}}, antes de capturar su firma en el portal de {{bws_razon_social}}. Su finalidad es que usted entienda qué está firmando y qué valor tiene la firma que se captura. Léalo completo antes de continuar.",
    },
    { tipo: "subtitulo", texto: "1. Qué firma se usa" },
    {
      tipo: "parrafo",
      texto:
        "La firma que se captura en el portal es una firma electrónica simple, con evidencia reforzada. No es una firma electrónica certificada. El Decreto-Ley 1.204 sobre Mensajes de Datos y Firmas Electrónicas (2001) reconoce los mensajes de datos y las firmas electrónicas; la firma electrónica certificada exige un certificado emitido por un prestador de servicios de certificación acreditado ante SUSCERTE, y este portal no usa ese tipo de certificado.",
    },
    {
      tipo: "parrafo",
      texto:
        "Tampoco se usa un servicio de firma electrónica avanzada de un tercero, ni una estampilla de tiempo de una autoridad de sellado, ni un dispositivo criptográfico de creación de firma. Lo que se captura es un trazo manuscrito digitalizado, asociado a su cuenta y a un registro de evidencia.",
    },
    { tipo: "subtitulo", texto: "2. Qué significa y qué no significa" },
    {
      tipo: "parrafo",
      texto:
        "La firma simple expresa su voluntad de obligarse por el documento firmado. Su valor es el de una manifestación de voluntad respaldada por evidencia: el trazo, la fecha y hora en UTC, la dirección IP, el agente de usuario, el documento exacto y un sello de contenido SHA-256. No es equivalente a una firma autógrafa y no se le atribuye validez probatoria plena.",
    },
    {
      tipo: "parrafo",
      texto:
        "Ningún sistema puede garantizar el resultado de un juicio. La evidencia ayuda a demostrar quién firmó, cuándo y sobre qué texto; si un tercero desconoce la firma, corresponderá a quien la invoca acreditar su autenticidad por los medios que el juez admita. Si el documento necesita una firma certificada, una autenticación notarial o una firma en papel, se puede hacer así.",
    },
    { tipo: "subtitulo", texto: "3. Cómo se captura y se conserva" },
    {
      tipo: "lista",
      numerada: true,
      items: [
        "El trazo se dibuja una sola vez, en el lienzo del registro, y se guarda como imagen PNG junto con su hash SHA-256.",
        "La firma queda vinculada a su cuenta. La aplicación no permite reemplazarla ni borrarla; un cambio exige una firma nueva, con motivo, y deja rastro en la auditoría.",
        "Cada documento firmado registra un acto de firma independiente, con la firma usada, el sello del documento, la fecha y hora en UTC, la IP y el agente de usuario.",
        "El registro no se puede modificar desde la aplicación. Si alguien altera directamente la base de datos o el archivo, la diferencia se detecta al comparar los sellos SHA-256 guardados.",
        "No se afirma que el registro sea inmutable ni imposible de alterar: se afirma que la alteración es detectable y que la aplicación no ofrece un camino para producirla.",
      ],
    },
    { tipo: "subtitulo", texto: "4. Consentimiento" },
    {
      tipo: "parrafo",
      texto:
        "Usted consiente, de forma libre, expresa e informada, el uso de la firma electrónica simple con evidencia reforzada para los documentos del expediente. Puede retirar el consentimiento para firmas futuras escribiendo a {{bws_correo}}; la retirada no afecta a los documentos ya firmados y puede impedir la prestación del servicio o la generación de nuevos expedientes. La firma en papel sigue disponible como alternativa.",
    },
    { tipo: "subtitulo", texto: "5. Alternativas" },
    {
      tipo: "parrafo",
      texto:
        "Si prefiere no usar la firma electrónica simple, puede firmar en papel o acudir a un prestador acreditado de firma electrónica certificada. Esas alternativas pueden tener costo, plazo y requisitos propios, y deben acordarse antes de iniciar el proyecto. Si su contrato exige firma certificada o autenticación notarial, dígalo antes de firmar este consentimiento.",
    },
    { tipo: "subtitulo", texto: "6. Conservación, acceso y datos" },
    {
      tipo: "parrafo",
      texto:
        "La firma, los actos y los documentos se conservan conforme a la Política de privacidad y tratamiento de datos (BWS-PRI-005). Usted puede solicitar acceso, copia y exportación de su expediente a {{bws_correo}}. La conservación se mantiene mientras dure la relación y durante los plazos necesarios para atender obligaciones o reclamaciones; después se elimina o anonimiza con aviso cuando corresponda.",
    },
    { tipo: "subtitulo", texto: "7. Declaración del firmante" },
    {
      tipo: "parrafo",
      texto:
        "Declaro que leí y entendí este documento, que se me explicó que la firma es electrónica simple y no certificada, que no equivale a una firma autógrafa, y que consiento su uso para los documentos del expediente de {{cliente_razon_social}} ({{cliente_correo}}).",
    },
    {
      tipo: "aviso",
      texto:
        "Si alguna parte de este documento no está clara, no firme: pregunte primero a {{bws_correo}}. Firmar sin entender no mejora la evidencia; la debilita.",
    },
  ],
};
