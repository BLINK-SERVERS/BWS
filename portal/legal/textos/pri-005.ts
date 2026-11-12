import type { DocumentoLegal } from "../tipos";

export const PRI_005: DocumentoLegal = {
  codigo: "BWS-PRI-005",
  titulo: "Política de privacidad y tratamiento de datos",
  version: "2.0",
  fecha: "2026-11-11",
  firma: "registro",
  resumen:
    "Qué datos trata el portal, para qué, con quién se comparten, cuánto se conservan y cómo ejercer los derechos. Se firma al registrarse.",
  campos: [
    "fecha_documento",
    "bws_razon_social",
    "bws_rif",
    "bws_domicilio",
    "bws_correo",
    "bws_telefono",
    "cliente_razon_social",
    "cliente_documento_tipo",
    "cliente_documento_numero",
    "cliente_correo",
    "correo_proveedor",
  ],
  bloques: [
    {
      tipo: "parrafo",
      texto:
        "Esta política explica cómo {{bws_razon_social}} (en adelante, «Blink»), RIF {{bws_rif}}, domicilio {{bws_domicilio}}, trata los datos personales de {{cliente_razon_social}} (documento {{cliente_documento_tipo}} {{cliente_documento_numero}}) y de las personas que usan el portal. Se acepta al crear la cuenta y acompaña al contrato BWS-CON-004.",
    },
    { tipo: "subtitulo", texto: "1. Responsable" },
    {
      tipo: "parrafo",
      texto:
        "El responsable del tratamiento es Blink. El canal para cualquier consulta o solicitud es {{bws_correo}}. El domicilio para notificaciones es {{bws_domicilio}} y el teléfono {{bws_telefono}}.",
    },
    { tipo: "subtitulo", texto: "2. Marco legal y advertencia" },
    {
      tipo: "parrafo",
      texto:
        "Venezuela no cuenta, a la fecha de este documento, con una ley general de protección de datos personales vigente. Esta política se apoya en el derecho constitucional a la privacidad y a la reputación (artículos 28 y 60 de la Constitución), en las reglas del Código Civil sobre obligaciones y buena fe, y en la Ley de Delitos Informáticos. No se invoca una ley general que no exista ni se declara certificación alguna.",
    },
    { tipo: "subtitulo", texto: "3. Datos que se tratan" },
    {
      tipo: "tabla",
      cabecera: ["Categoría", "Ejemplos", "Origen"],
      anchos: [0.28, 0.46, 0.26],
      filas: [
        ["Identidad", "Nombre o razón social, cédula o RIF, domicilio", "Registro del cliente"],
        ["Contacto", "Correo electrónico, teléfono, correo de facturación", "Registro del cliente"],
        ["Firma", "Imagen PNG del trazo manuscrito digitalizado y su hash", "Captura en el portal"],
        ["Proyecto", "Nombre, categoría, dominio, alcance, buzones, plan", "Formulario del proyecto"],
        ["Evidencia", "Fecha y hora UTC, IP, agente de usuario, sellos SHA-256, actos de firma", "Generación automática"],
        ["Facturación", "Pagos registrados, referencias, tasa BCV aplicada", "Administración del servicio"],
        ["Soporte", "Mensajes y datos que el cliente envía al pedir ayuda", "Comunicación con Blink"],
      ],
    },
    {
      tipo: "parrafo",
      texto:
        "La firma manuscrita digitalizada es un dato personal. No se usa para identificar biométricamente a la persona ni se compara con patrones; se usa como manifestación de voluntad y evidencia del acto de firma.",
    },
    { tipo: "subtitulo", texto: "4. Finalidades y bases" },
    {
      tipo: "tabla",
      cabecera: ["Finalidad", "Base"],
      anchos: [0.62, 0.38],
      filas: [
        ["Crear y administrar la cuenta, verificar la identidad y gestionar el acceso", "Consentimiento y ejecución del contrato"],
        ["Elaborar, firmar, sellar y conservar el expediente del proyecto", "Ejecución del contrato y consentimiento"],
        ["Configurar el dominio y los buzones, y desplegar la aplicación", "Ejecución del contrato"],
        ["Facturar, cobrar y atender obligaciones fiscales", "Contrato y obligaciones legales"],
        ["Atender consultas, reclamos y solicitudes de derechos", "Consentimiento y obligaciones legales"],
        ["Prevenir fraude, abuso y accesos no autorizados", "Interés legítimo en la seguridad del servicio"],
        ["Enviar avisos del servicio y del expediente", "Ejecución del contrato"],
      ],
    },
    { tipo: "subtitulo", texto: "5. Destinatarios, encargados y transferencias" },
    {
      tipo: "parrafo",
      texto:
        "Los datos se alojan en proveedores que actúan como encargados: Neon (base de datos), Cloudflare (alojamiento del portal y funciones) y {{correo_proveedor}} (envío de correos). Neon procesa los datos en Estados Unidos; Cloudflare los procesa en su red global, que puede incluir centros fuera de Estados Unidos, y el proveedor de correo donde opera. Al aceptar esta política, el cliente consiente la transferencia internacional necesaria para prestar el servicio y declara que la informará a sus propios usuarios cuando corresponda.",
    },
    {
      tipo: "parrafo",
      texto:
        "Blink no vende datos personales ni los cede a terceros para publicidad. Solo los comunica a los encargados necesarios, a autoridades cuando exista obligación legal, o a un tercero con consentimiento del titular. Los expedientes se envían al correo del cliente y a la copia interna de Blink; no se envían a destinatarios adicionales sin autorización.",
    },
    { tipo: "subtitulo", texto: "6. Conservación" },
    {
      tipo: "parrafo",
      texto:
        "Los datos de la cuenta y del proyecto se conservan mientras el servicio esté activo y durante los noventa (90) días siguientes a la terminación, para permitir la exportación. La firma, los actos y los documentos se conservan mientras subsista la relación y hasta diez (10) años después de la última firma, salvo plazo legal mayor, para atender reclamaciones y obligaciones de evidencia. Los datos de facturación se conservan por los plazos fiscales aplicables. Cumplidos los plazos, se eliminan o anonimizan con aviso cuando sea posible.",
    },
    { tipo: "subtitulo", texto: "7. Derechos del titular" },
    {
      tipo: "parrafo",
      texto:
        "El titular puede solicitar acceso a sus datos, rectificación de los inexactos, actualización, exportación en un formato estándar, oposición a tratamientos no necesarios y eliminación cuando no exista obligación legal de conservarlos. La solicitud se envía a {{bws_correo}} desde {{cliente_correo}} o con identificación suficiente. Blink responde dentro de los quince (15) días hábiles siguientes y puede pedir datos adicionales para verificar la identidad. Si la solicitud afecta a un expediente firmado, se conserva la evidencia y se anota la rectificación; no se borra el acto de firma.",
    },
    { tipo: "subtitulo", texto: "8. Seguridad" },
    {
      tipo: "parrafo",
      texto:
        "Blink aplica medidas razonables: cifrado en tránsito, claves con derivación scrypt, sesiones opacas con cookie HttpOnly, control de acceso por fila, límites de intentos, registro de eventos y sellos SHA-256 para detectar alteraciones. Ningún sistema es completamente seguro y no se garantiza una seguridad absoluta. Si ocurre un incidente que afecte datos personales, Blink lo comunicará a los afectados y a las autoridades cuando corresponda, dentro de las setenta y dos (72) horas de conocido, con la información disponible.",
    },
    { tipo: "subtitulo", texto: "9. Menores de edad" },
    {
      tipo: "parrafo",
      texto:
        "El portal está dirigido a personas mayores de edad con capacidad para contratar. No se recogen datos de menores de forma deliberada. Si aparecen datos de menores en la aplicación del cliente, el cliente es responsable de obtener la autorización de quien ejerza la patria potestad y de cumplir la normativa aplicable.",
    },
    { tipo: "subtitulo", texto: "10. Cookies" },
    {
      tipo: "parrafo",
      texto:
        "El portal usa solo la cookie esencial de sesión descrita en BWS-WEB-006. No usa cookies publicitarias ni de analítica, y no carga recursos de terceros desde el navegador.",
    },
    { tipo: "subtitulo", texto: "11. Cambios" },
    {
      tipo: "parrafo",
      texto:
        "Blink puede actualizar esta política por cambios legales, técnicos o de proveedores. La nueva versión se publica con fecha y versión, y se avisa por correo cuando el cambio sea sustancial. El uso continuado después de la entrada en vigor implica aceptación; si el titular no acepta, puede solicitar la terminación del servicio.",
    },
    { tipo: "subtitulo", texto: "12. Contacto" },
    {
      tipo: "parrafo",
      texto:
        "Para ejercer derechos o plantear una duda: {{bws_correo}}. Para asuntos postales: {{bws_domicilio}}. Para asuntos telefónicos: {{bws_telefono}}.",
    },
    {
      tipo: "aviso",
      texto:
        "Esta política no declara conformidad con norma ISO alguna ni una seguridad del cien por ciento. Describe medidas concretas y sus límites.",
    },
  ],
};
