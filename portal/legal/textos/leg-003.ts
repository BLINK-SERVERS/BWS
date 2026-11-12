import type { DocumentoLegal } from "../tipos";

export const LEG_003: DocumentoLegal = {
  codigo: "BWS-LEG-003",
  titulo: "Términos y condiciones del servicio",
  version: "2.0",
  fecha: "2026-11-11",
  firma: "registro",
  resumen:
    "Condiciones generales aplicables a todos los servicios de Blink: cuenta, alcance, precios, mora, propiedad intelectual, datos y responsabilidad.",
  campos: [
    "fecha_documento",
    "bws_razon_social",
    "bws_documento",
    "bws_domicilio",
    "bws_correo",
    "cliente_razon_social",
    "cliente_documento_tipo",
    "cliente_documento_numero",
    "cliente_domicilio",
    "cliente_correo",
    "tarifa_desarrollo",
    "tarifa_infra_pro",
    "demo_plazo",
    "dominio_costo_eur",
    "tasa_bcv_fecha",
    "tasa_bcv_valor",
    "dominio_costo_bs",
    "credito_meses",
    "licencia_duracion",
    "correo_proveedor",
  ],
  bloques: [
    {
      tipo: "parrafo",
      texto:
        "Estos términos regulan la relación entre {{bws_razon_social}} (en adelante, «Blink»), documento {{bws_documento}}, domicilio {{bws_domicilio}}, y {{cliente_razon_social}} (en adelante, «el Cliente»), documento {{cliente_documento_tipo}} {{cliente_documento_numero}}, domicilio {{cliente_domicilio}}. Se aceptan al crear la cuenta y se complementan con el contrato de prestación de servicios (BWS-CON-004), sus anexos y la política de privacidad (BWS-PRI-005). Si hay conflicto, prevalece el contrato firmado para el proyecto.",
    },
    { tipo: "subtitulo", texto: "1. Objeto" },
    {
      tipo: "parrafo",
      texto:
        "Blink diseña, desarrolla, despliega y mantiene aplicaciones web y servicios asociados. El Cliente contrata un resultado descrito en un alcance cerrado. La relación no es de empleo, sociedad, agencia ni franquicia, y ninguna parte compromete a la otra frente a terceros salvo autorización escrita.",
    },
    { tipo: "subtitulo", texto: "2. Definiciones" },
    {
      tipo: "lista",
      items: [
        "«Portal»: el sitio en el que el Cliente se registra, define el proyecto, firma y descarga sus expedientes.",
        "«Proyecto»: la aplicación y los entregables descritos en el anexo A del contrato.",
        "«Expediente»: el conjunto de documentos firmados y sellados de un Proyecto.",
        "«Plan de infraestructura»: el nivel de servicio de alojamiento de la aplicación del Cliente, descrito en el anexo B.",
        "«Licencia de uso»: el derecho limitado a usar el software de Blink, descrito en el anexo F. No es una cesión ni una venta del código.",
      ],
    },
    { tipo: "subtitulo", texto: "3. Cuenta y seguridad" },
    {
      tipo: "parrafo",
      texto:
        "El Cliente debe usar datos veraces, mantener la confidencialidad de su clave y avisar de inmediato cualquier acceso no autorizado a {{bws_correo}}. Responde por las acciones realizadas desde su cuenta mientras no haya notificado el incidente. Blink puede bloquear una cuenta ante indicios razonables de fraude, suplantación o uso contrario a estos términos, y lo comunicará al titular.",
    },
    { tipo: "subtitulo", texto: "4. Alcance y cambios" },
    {
      tipo: "parrafo",
      texto:
        "El alcance es exactamente el que el Cliente envía en el formulario del proyecto y se congela en el anexo A. Lo que no esté descrito allí no forma parte del encargo. Toda función nueva o cambio de alcance se cotiza por escrito y se ejecuta mediante un anexo o una propuesta adicional, con precio y plazo propios. No se considera incluido por la costumbre ni por conversaciones informales.",
    },
    { tipo: "subtitulo", texto: "5. Plazos y entrega" },
    {
      tipo: "parrafo",
      texto:
        "La primera demo funcional se entrega en un plazo estimado de {{demo_plazo}}, contado desde la activación del dominio. Es un plazo de trabajo, no una garantía de fecha: depende de que el Cliente entregue a tiempo contenidos, accesos, aprobaciones y datos. Los retrasos del Cliente desplazan el plazo en la misma medida. La entrega se documenta en el acta del anexo F.",
    },
    { tipo: "subtitulo", texto: "6. Precio y pago" },
    {
      tipo: "lista",
      items: [
        "Desarrollo: {{tarifa_desarrollo}} por mes de desarrollo. El primer mes se paga al entregar la primera demo funcional; los meses siguientes se pagan por adelantado al inicio de cada mes.",
        "Dominio: el registro o la renovación anual del dominio .com.ve tiene un costo de referencia de {{dominio_costo_eur}}, pagadero en bolívares al tipo de cambio oficial del BCV vigente el día del pago. Para este documento se toma la tasa publicada el {{tasa_bcv_fecha}}: {{tasa_bcv_valor}} por dólar, equivalente a {{dominio_costo_bs}}. La fecha y el valor se imprimen en el anexo D del contrato BWS-CON-004.",
        "Plan Pro de infraestructura: {{tarifa_infra_pro}} mensuales, opcional. No se activa automáticamente ni se suma al desarrollo si el Cliente no lo contrata. Es distinto de la tarifa de desarrollo.",
        "Tributos: los impuestos que correspondan (IVA y, en su caso, IGTF) se discriminan en la factura y los soporta el Cliente cuando la ley lo disponga.",
        "Extras: toda función adicional se cotiza y se paga antes de ejecutarse.",
      ],
    },
    { tipo: "subtitulo", texto: "7. Mora y suspensión" },
    {
      tipo: "parrafo",
      texto:
        "El estado de la suscripción se calcula, no se escribe a mano: «al día» hasta el vencimiento y cinco (5) días continuos de gracia; «en mora» después de la gracia; «suspendida» a los diez (10) días de mora, con aviso; «terminada» a los treinta (30) días de mora. Cada transición queda registrada con fecha y motivo.",
    },
    {
      tipo: "parrafo",
      texto:
        "La licencia de uso está condicionada al pago puntual. Al suspenderse, la aplicación del Cliente sale de línea y el Cliente pierde el acceso al servicio. Blink conserva el código, la arquitectura, el despliegue y la infraestructura del Proyecto; no está obligada a entregar el código fuente, y la compra del código o de la arquitectura, si se acuerda, va en un contrato aparte con precio propio, sin que sea un remedio por impago.",
    },
    {
      tipo: "parrafo",
      texto:
        "La suspensión no transfiere a Blink la propiedad de los datos ni del dominio del Cliente. El Cliente conserva sus datos y contenidos; Blink los guarda como encargado durante noventa (90) días para permitir la exportación una vez pagada la deuda, y después los elimina o anonimiza con aviso. El dominio .com.ve está a nombre del Cliente y Blink coopera con su transferencia; la falta de pago del registro puede hacer que el dominio no se renueve, y eso se avisa por escrito. La reactivación exige un pago registrado y deja constancia en la auditoría.",
    },
    { tipo: "subtitulo", texto: "8. Obligaciones del Cliente" },
    {
      tipo: "lista",
      items: [
        "Entregar información veraz, contenidos lícitos y los accesos necesarios para el proyecto.",
        "Usar el servicio conforme a la ley, sin vulnerar derechos de terceros ni enviar comunicaciones no solicitadas.",
        "No compartir credenciales ni revender el acceso sin autorización escrita.",
        "Mantener actualizados sus datos fiscales y de contacto.",
        "Pagar en los plazos acordados y colaborar con la verificación de identidad.",
      ],
    },
    { tipo: "subtitulo", texto: "9. Propiedad intelectual y licencia" },
    {
      tipo: "parrafo",
      texto:
        "El código, la arquitectura, el sistema de diseño, los componentes, las plantillas y la documentación del Proyecto son propiedad de Blink. El Cliente recibe una licencia de uso no exclusiva, no transferible y limitada a su negocio y a {{licencia_duracion}}, en los términos del anexo F. La licencia no incluye el código fuente, no permite revender, sublicenciar ni replicar la arquitectura, y no se cede con la mera terminación del servicio.",
    },
    {
      tipo: "parrafo",
      texto:
        "El Cliente es dueño de sus datos, contenidos y marcas, y autoriza a Blink a tratarlos únicamente para prestar el servicio. La mención «Powered by Blink» es obligatoria durante {{credito_meses}} desde la entrega, salvo renuncia escrita.",
    },
    { tipo: "subtitulo", texto: "10. Datos personales y confidencialidad" },
    {
      tipo: "parrafo",
      texto:
        "El tratamiento de datos personales se rige por la política BWS-PRI-005. Los proveedores de alojamiento, base de datos y correo, incluido {{correo_proveedor}}, pueden procesar datos fuera de Venezuela; el Cliente lo consiente al aceptar esta política. La confidencialidad entre las partes se rige por el acuerdo BWS-NDA-008 cuando se comparta información reservada.",
    },
    { tipo: "subtitulo", texto: "11. Disponibilidad y soporte" },
    {
      tipo: "parrafo",
      texto:
        "Blink presta el servicio con esfuerzo razonable y mantiene ventanas de mantenimiento. No se garantiza una disponibilidad del cien por ciento ni un tiempo de respuesta único: la disponibilidad depende también de los proveedores de infraestructura y de la conexión del Cliente. El plan Pro de infraestructura evita la pausa por inactividad cuando el proveedor lo permite. Los respaldos se realizan según el plan contratado; el Cliente puede exportar sus datos cuando lo solicite. El soporte se atiende por {{bws_correo}} en días hábiles.",
    },
    { tipo: "subtitulo", texto: "12. Responsabilidad" },
    {
      tipo: "parrafo",
      texto:
        "Blink responde por los daños directos que cause con dolo o culpa grave, y corrige sin costo las fallas reproducibles del alcance entregado durante los treinta (30) días siguientes a la entrega. No responde por lucro cesante, pérdida de oportunidades, daños indirectos ni por el uso que el Cliente o terceros hagan de la aplicación. Salvo dolo o fraude, la responsabilidad total se limita al monto pagado por el Cliente a Blink en los doce (12) meses anteriores al hecho. Nada en esta cláusula limita derechos que la ley no permita renunciar.",
    },
    { tipo: "subtitulo", texto: "13. Terminación" },
    {
      tipo: "parrafo",
      texto:
        "Cualquiera de las partes puede terminar el servicio con aviso escrito de treinta (30) días. Blink puede suspender o terminar de inmediato ante impago, uso ilícito, riesgo de seguridad o incumplimiento grave. Al terminar, el Cliente conserva sus datos y puede exportarlos; la licencia de uso termina salvo pacto contrario; las obligaciones de confidencialidad, propiedad intelectual y responsabilidad sobreviven.",
    },
    { tipo: "subtitulo", texto: "14. Modificaciones" },
    {
      tipo: "parrafo",
      texto:
        "Blink puede actualizar estos términos por cambios legales, técnicos o comerciales. La nueva versión se publica con su fecha y versión, y se avisa por correo con quince (15) días de antelación cuando el cambio sea sustancial. El uso continuado después de la entrada en vigor implica aceptación; si el Cliente no acepta, puede terminar el servicio antes de esa fecha.",
    },
    { tipo: "subtitulo", texto: "15. Notificaciones" },
    {
      tipo: "parrafo",
      texto:
        "Las notificaciones se envían a {{cliente_correo}} y a {{bws_correo}}, o a las direcciones que las partes actualicen por escrito. Se entienden recibidas el día hábil siguiente al envío, salvo error de entrega acreditado.",
    },
    { tipo: "subtitulo", texto: "16. Ley y jurisdicción" },
    {
      tipo: "parrafo",
      texto:
        "Estos términos se rigen por las leyes de la República Bolivariana de Venezuela. Las controversias se someten a los tribunales competentes de la ciudad de Caracas, sin perjuicio de la jurisdicción que la ley imponga al consumidor.",
    },
    { tipo: "subtitulo", texto: "17. Disposiciones finales" },
    {
      tipo: "parrafo",
      texto:
        "Si una cláusula resulta nula, las demás conservan su vigencia y la cláusula se interpreta del modo más cercano a su finalidad. La falta de ejercicio de un derecho no es renuncia. Este documento, el contrato y sus anexos forman el acuerdo completo y sustituyen las conversaciones anteriores.",
    },
    {
      tipo: "aviso",
      texto:
        "Blink no declara certificación ni conformidad con norma ISO alguna, ni que sus documentos sean PDF/A. Los PDF se generan en formato PDF 1.7 con fuentes embebidas y un sello de contenido SHA-256, y la alteración del archivo o del registro es detectable al comparar los sellos guardados.",
    },
  ],
};
