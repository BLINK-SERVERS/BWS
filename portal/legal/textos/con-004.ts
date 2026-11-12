import type { DocumentoLegal } from "../tipos";

export const CON_004: DocumentoLegal = {
  codigo: "BWS-CON-004",
  titulo: "Contrato de prestación de servicios y anexos A–F",
  version: "3.0",
  fecha: "2026-11-11",
  firma: "proyecto",
  resumen:
    "Contrato del proyecto: alcance cerrado, plazos, precio, infraestructura, dominio, datos, licencia y mora. Se firma al enviar el proyecto.",
  campos: [
    "fecha_documento",
    "bws_razon_social",
    "bws_documento",
    "bws_domicilio",
    "bws_correo",
    "bws_telefono",
    "representante_nombre",
    "representante_documento",
    "representante_domicilio",
    "cliente_razon_social",
    "cliente_documento_tipo",
    "cliente_documento_numero",
    "cliente_domicilio",
    "cliente_telefono",
    "cliente_correo",
    "cliente_correo_factura",
    "proyecto_nombre",
    "proyecto_categoria",
    "proyecto_dominio",
    "proyecto_alcance",
    "proyecto_complejidad",
    "plan_nombre",
    "plan_precio",
    "plan_fuente",
    "plan_fecha",
    "dominio_costo_eur",
    "tasa_bcv_fecha",
    "tasa_bcv_valor",
    "dominio_costo_bs",
    "demo_plazo",
    "tarifa_desarrollo",
    "tarifa_infra_pro",
    "licencia_duracion",
    "credito_meses",
    "correo_proveedor",
  ],
  bloques: [
    {
      tipo: "parrafo",
      texto:
        "Entre {{bws_razon_social}}, documento {{bws_documento}}, domicilio {{bws_domicilio}}, teléfono {{bws_telefono}}, representada por {{representante_nombre}}, documento {{representante_documento}}, domicilio {{representante_domicilio}} (en adelante, «Blink»), y {{cliente_razon_social}}, documento {{cliente_documento_tipo}} {{cliente_documento_numero}}, domicilio {{cliente_domicilio}}, teléfono {{cliente_telefono}}, correo {{cliente_correo}} y correo de facturación {{cliente_correo_factura}}, representada por quien suscribe en su nombre (en adelante, «el Cliente»), se celebra el presente contrato, que se rige por las siguientes cláusulas y sus anexos A a F, que forman parte indivisible del mismo.",
    },
    { tipo: "subtitulo", texto: "Primera. Antecedentes" },
    {
      tipo: "parrafo",
      texto:
        "El Cliente desea contratar el diseño, desarrollo, despliegue y mantenimiento de una aplicación web, y Blink declara contar con la capacidad para ejecutarlo. Las partes dejan constancia de que el alcance se definió antes de firmar, en el formulario del portal, y que lo no descrito en el anexo A no está incluido.",
    },
    { tipo: "subtitulo", texto: "Segunda. Objeto" },
    {
      tipo: "parrafo",
      texto:
        "Blink prestará los servicios de diseño, desarrollo, despliegue, configuración de dominio y correos, y mantenimiento del Proyecto «{{proyecto_nombre}}», en la categoría «{{proyecto_categoria}}», bajo las condiciones de este contrato. El objeto incluye los entregables del anexo A y la licencia de uso del anexo F; no incluye la venta del código ni de la arquitectura.",
    },
    { tipo: "subtitulo", texto: "Tercera. Alcance cerrado" },
    {
      tipo: "parrafo",
      texto:
        "El alcance es el descrito en el anexo A y queda congelado al momento de la firma. Toda función, pantalla o integración adicional se cotiza por escrito y se ejecuta mediante un anexo o una propuesta adicional, con precio y plazo propios. No se consideran incluidas las funciones sugeridas, conversadas o insinuadas que no figuren en el anexo A.",
    },
    { tipo: "subtitulo", texto: "Cuarta. Plazo y primera demo" },
    {
      tipo: "parrafo",
      texto:
        "Blink entregará una primera demo funcional en un plazo estimado de {{demo_plazo}}, contado desde la activación del dominio. El plazo es de trabajo y depende de la colaboración del Cliente: la entrega de contenidos, accesos y aprobaciones en tiempo útil. El retraso del Cliente desplaza el plazo en la misma medida. El Cliente dispondrá de cinco (5) días hábiles para observar la demo y reportar fallas reproducibles; si no lo hace, se entiende aceptada.",
    },
    { tipo: "subtitulo", texto: "Quinta. Precio y forma de pago" },
    {
      tipo: "parrafo",
      texto:
        "El precio se detalla en el anexo D. El desarrollo se factura a razón de {{tarifa_desarrollo}} por mes; el primer mes se paga al entregar la primera demo funcional y los siguientes por adelantado al inicio de cada mes. El registro anual del dominio tiene un costo de referencia de {{dominio_costo_eur}}, pagadero en bolívares al tipo de cambio oficial del BCV del día del pago; para este contrato se toma la tasa del {{tasa_bcv_fecha}} ({{tasa_bcv_valor}} por dólar), equivalente a {{dominio_costo_bs}}. El plan Pro de infraestructura, de {{tarifa_infra_pro}} mensuales, es opcional y no se activa automáticamente. Los tributos aplicables se discriminan en la factura.",
    },
    { tipo: "subtitulo", texto: "Sexta. Obligaciones de Blink" },
    {
      tipo: "lista",
      items: [
        "Ejecutar el alcance del anexo A con el cuidado profesional que corresponde a su actividad.",
        "Gestionar el registro o la renovación del dominio .com.ve a nombre del Cliente y la configuración inicial de hasta cinco (5) buzones, incluido el obligatorio no-reply@.",
        "Mantener el Proyecto desplegado y aplicar las medidas razonables de seguridad descritas en la política BWS-PRI-005.",
        "Conservar la evidencia de firma y los sellos de los documentos generados.",
        "Atender por {{bws_correo}} las consultas y fallas que el Cliente reporte.",
        "Guardar los datos del Cliente como encargado y permitir su exportación en los términos del anexo E.",
      ],
    },
    { tipo: "subtitulo", texto: "Séptima. Obligaciones del Cliente" },
    {
      tipo: "lista",
      items: [
        "Pagar en los plazos acordados y soportar los tributos que la ley le imponga.",
        "Entregar contenidos lícitos, veraces y libres de derechos de terceros, y responder por ellos.",
        "Designar a una persona con capacidad para aprobar entregables y dar accesos.",
        "Usar el Proyecto conforme a la ley y a las condiciones de los proveedores de infraestructura.",
        "No solicitar a Blink la ejecución de funciones fuera del anexo A sin la cotización y el anexo correspondientes.",
        "Mantener actualizados sus datos fiscales y de contacto.",
      ],
    },
    { tipo: "subtitulo", texto: "Octava. Propiedad intelectual y licencia" },
    {
      tipo: "parrafo",
      texto:
        "El código, la arquitectura, el sistema de diseño, los componentes, las plantillas y la documentación son propiedad de Blink. El Cliente recibe una licencia de uso no exclusiva, no transferible y limitada a su negocio y a {{licencia_duracion}}, en los términos del anexo F. El Cliente no adquiere el código fuente ni el derecho de revender, sublicenciar o replicar la arquitectura. La compra del código o de la arquitectura, si las partes la acuerdan, se documenta en un contrato aparte, con precio propio, y no se presume por el pago de las mensualidades.",
    },
    {
      tipo: "parrafo",
      texto:
        "El Cliente conserva la propiedad de sus datos, contenidos y marcas, y concede a Blink una autorización limitada para tratarlos con la única finalidad de prestar el servicio. La mención «Powered by Blink» deberá permanecer visible durante {{credito_meses}} desde la entrega, salvo renuncia escrita de Blink.",
    },
    { tipo: "subtitulo", texto: "Novena. Datos personales" },
    {
      tipo: "parrafo",
      texto:
        "El tratamiento de los datos del Cliente en el portal se rige por BWS-PRI-005. Respecto de los datos de los usuarios finales de la aplicación del Cliente, este actúa como responsable y Blink como encargado, en los términos del anexo E. Los proveedores de alojamiento, base de datos y correo, incluido {{correo_proveedor}}, pueden procesar datos fuera de Venezuela; el Cliente lo consiente y lo informará a sus usuarios.",
    },
    { tipo: "subtitulo", texto: "Décima. Confidencialidad" },
    {
      tipo: "parrafo",
      texto:
        "Cada parte mantendrá reservada la información confidencial de la otra y solo la usará para ejecutar este contrato. La obligación se extiende a empleados y proveedores que la necesiten, y sobrevive cinco (5) años a la terminación. Se aplica el acuerdo BWS-NDA-008, que las partes pueden firmar antes de compartir información especialmente sensible.",
    },
    { tipo: "subtitulo", texto: "Undécima. Mora, suspensión y terminación" },
    {
      tipo: "parrafo",
      texto:
        "El estado de la suscripción se calcula: «al día» hasta el vencimiento y cinco (5) días de gracia; «en mora» después; «suspendida» a los diez (10) días de mora, con aviso; «terminada» a los treinta (30) días. La licencia de uso está condicionada al pago puntual. Al suspenderse, la aplicación sale de línea y el Cliente pierde el acceso; Blink conserva el código, la arquitectura, el despliegue y la infraestructura del Proyecto, y no está obligada a entregar el código fuente. La compra del código o de la arquitectura, si se acuerda, va en un contrato aparte y no es un remedio por impago.",
    },
    {
      tipo: "parrafo",
      texto:
        "La suspensión no transfiere a Blink la propiedad de los datos ni del dominio del Cliente. El Cliente conserva sus datos y contenidos; Blink los guarda como encargado durante noventa (90) días para permitir la exportación una vez pagada la deuda, y después los elimina o anonimiza con aviso. El dominio .com.ve está a nombre del Cliente y Blink coopera con su transferencia; la falta de pago del registro puede impedir su renovación y se avisará por escrito. La reactivación exige un pago registrado y deja constancia en la auditoría.",
    },
    {
      tipo: "parrafo",
      texto:
        "Cualquiera de las partes puede terminar el contrato con aviso escrito de treinta (30) días. Blink puede suspender o terminar de inmediato por impago, uso ilícito o riesgo de seguridad. Al terminar, el Cliente puede exportar sus datos; la licencia termina salvo pacto contrario, y sobreviven las cláusulas de propiedad intelectual, confidencialidad y responsabilidad.",
    },
    { tipo: "subtitulo", texto: "Duodécima. Garantía y responsabilidad" },
    {
      tipo: "parrafo",
      texto:
        "Blink corregirá sin costo las fallas reproducibles del alcance entregado que se reporten dentro de los treinta (30) días siguientes a la entrega. No se garantiza que el software esté libre de errores ni que funcione sin interrupciones, y no se declara conformidad con norma ISO ni formato PDF/A. Salvo dolo o fraude, la responsabilidad total de Blink se limita al monto pagado por el Cliente en los doce (12) meses anteriores al hecho, y no comprende lucro cesante ni daños indirectos. Nada limita los derechos que la ley no permita renunciar.",
    },
    { tipo: "subtitulo", texto: "Decimotercera. Notificaciones" },
    {
      tipo: "parrafo",
      texto:
        "Las notificaciones se envían a {{cliente_correo}} y a {{bws_correo}}, o a las direcciones que las partes actualicen por escrito, y se entienden recibidas el día hábil siguiente al envío, salvo error de entrega acreditado.",
    },
    { tipo: "subtitulo", texto: "Decimocuarta. Ley y jurisdicción" },
    {
      tipo: "parrafo",
      texto:
        "Este contrato se rige por las leyes de la República Bolivariana de Venezuela. Las controversias se someten a los tribunales competentes de la ciudad de Caracas, sin perjuicio de la jurisdicción que la ley imponga al consumidor.",
    },
    { tipo: "subtitulo", texto: "Anexo A — Alcance cerrado del Proyecto" },
    {
      tipo: "tabla",
      cabecera: ["Dato", "Valor"],
      anchos: [0.32, 0.68],
      filas: [
        ["Nombre comercial", "{{proyecto_nombre}}"],
        ["Categoría", "{{proyecto_categoria}}"],
        ["Dominio", "{{proyecto_dominio}}"],
        ["Complejidad declarada", "{{proyecto_complejidad}}"],
        ["Plan de infraestructura", "{{plan_nombre}} ({{plan_precio}} mensuales)"],
      ],
    },
    { tipo: "subtitulo", texto: "Descripción del alcance" },
    { tipo: "parrafo", texto: "{{proyecto_alcance}}" },
    {
      tipo: "parrafo",
      texto:
        "El alcance comprende únicamente lo descrito en este anexo. Las funcionalidades, pantallas, integraciones o contenidos no enumerados se consideran fuera de alcance y se cotizan aparte. El Cliente confirma que esta descripción refleja lo que espera recibir.",
    },
    {
      tipo: "subtitulo",
      texto: "Correos corporativos incluidos (máximo cinco, con no-reply@ obligatorio)",
    },
    { tipo: "buzones" },
    { tipo: "subtitulo", texto: "Anexo B — Infraestructura de la aplicación del Cliente" },
    {
      tipo: "tabla",
      cabecera: ["Dato", "Valor"],
      anchos: [0.32, 0.68],
      filas: [
        ["Plan elegido", "{{plan_nombre}}"],
        ["Precio mensual", "{{plan_precio}}"],
        ["Fuente de los límites", "{{plan_fuente}}"],
        ["Fecha de consulta", "{{plan_fecha}}"],
      ],
    },
    { tipo: "subtitulo", texto: "Límites del plan" },
    { tipo: "limites" },
    {
      tipo: "parrafo",
      texto:
        "Los límites son los del proveedor a la fecha indicada y pueden cambiar cuando el proveedor los actualice; el Cliente será informado. El plan Pro es opcional y su activación no es automática. Si el Cliente contrata un plan distinto o su propia cuenta con el proveedor, los límites y el precio se ajustan mediante un anexo. La infraestructura del portal de Blink es distinta de la infraestructura de la aplicación del Cliente y no se factura en este anexo.",
    },
    { tipo: "subtitulo", texto: "Anexo C — Dominio y correos corporativos" },
    {
      tipo: "parrafo",
      texto:
        "Blink gestiona el registro y la configuración inicial del dominio {{proyecto_dominio}} a nombre del Cliente, y hasta cinco (5) buzones, con el buzón no-reply@ obligatorio para notificaciones automáticas. El trámite ante NIC.ve es manual y no dispone de una interfaz pública automatizable: el portal registra la solicitud y su evidencia, pero no promete una automatización que el registro no ofrece. El dominio queda a nombre del Cliente y Blink no lo retiene como garantía; la falta de pago del registro puede impedir su renovación y se avisará por escrito.",
    },
    { tipo: "subtitulo", texto: "Anexo D — Condiciones comerciales" },
    {
      tipo: "tabla",
      cabecera: ["Concepto", "Condición"],
      anchos: [0.32, 0.68],
      filas: [
        ["Desarrollo", "{{tarifa_desarrollo}} por mes de desarrollo"],
        ["Primer pago de desarrollo", "Al entregar la primera demo funcional"],
        ["Meses siguientes", "Por adelantado al inicio de cada mes"],
        ["Demo funcional", "{{demo_plazo}} desde la activación del dominio"],
        ["Dominio .com.ve", "{{dominio_costo_eur}} anuales, en bolívares a la tasa BCV del día del pago"],
        ["Tasa de referencia", "{{tasa_bcv_fecha}}: {{tasa_bcv_valor}} por dólar; {{dominio_costo_bs}}"],
        ["Plan Pro de infraestructura", "{{tarifa_infra_pro}} mensuales, opcional, no automático"],
        ["Funciones adicionales", "Cotización y anexo aparte, pagados antes de ejecutarse"],
        ["Tributos", "IVA y, en su caso, IGTF, discriminados en la factura"],
      ],
    },
    {
      tipo: "parrafo",
      texto:
        "El Cliente no está obligado a contratar el plan Pro de infraestructura. El contrato no debe leerse como una suma automática de desarrollo y plan Pro: son conceptos distintos y se facturan por separado. El registro del dominio no es reembolsable una vez efectuado ante el registro correspondiente.",
    },
    { tipo: "subtitulo", texto: "Anexo E — Encargo de tratamiento de datos" },
    {
      tipo: "parrafo",
      texto:
        "Respecto de los datos de los usuarios finales de la aplicación del Cliente, el Cliente es el responsable y Blink el encargado. El encargo comprende: alojar, procesar, respaldar y dar soporte a los datos, únicamente siguiendo instrucciones documentadas del Cliente y para prestar el servicio. Los datos pueden incluir identidad, contacto, datos fiscales, contenidos, imágenes y registros de uso.",
    },
    {
      tipo: "lista",
      items: [
        "Blink no usará los datos para fines propios, no los venderá ni los cederá, y exigirá confidencialidad a quienes los traten.",
        "Los subencargados son los proveedores de alojamiento, base de datos y correo (Neon, Cloudflare y {{correo_proveedor}}). Neon procesa los datos en Estados Unidos; Cloudflare los procesa en su red global, que puede incluir centros fuera de Estados Unidos, y el proveedor de correo donde opera. Cualquier cambio sustancial de subencargado se informa.",
        "Blink aplica medidas razonables de seguridad: cifrado en tránsito, control de acceso, registro de eventos y respaldos según el plan. No se garantiza una seguridad absoluta.",
        "Ante un incidente que afecte datos personales, Blink avisará al Cliente sin demora indebida y, en todo caso, dentro de las setenta y dos (72) horas de conocido, con la información disponible.",
        "Al terminar, Blink devuelve o elimina los datos en un plazo de noventa (90) días, salvo obligación legal de conservarlos, y certifica la eliminación si se solicita.",
        "El Cliente puede auditar el cumplimiento una vez al año, con aviso y sin acceso a datos de otros clientes.",
      ],
    },
    { tipo: "subtitulo", texto: "Anexo F — Acta de entrega y licencia de uso" },
    {
      tipo: "parrafo",
      texto:
        "En la fecha de entrega se levanta acta con el Proyecto «{{proyecto_nombre}}», el dominio {{proyecto_dominio}} y el alcance del anexo A. La entrega no transfiere la propiedad del software: Blink otorga al Cliente una licencia de uso no exclusiva, no transferible, revocable y limitada a su negocio y a {{licencia_duracion}}.",
    },
    {
      tipo: "lista",
      items: [
        "La licencia permite usar la aplicación y sus componentes para la operación del negocio del Cliente.",
        "No permite obtener, copiar o reutilizar el código fuente, revender, sublicenciar, alquilar ni replicar la arquitectura o el sistema de diseño.",
        "No permite retirar los avisos de propiedad ni la mención «Powered by Blink», que se mantiene {{credito_meses}} desde la entrega salvo renuncia escrita.",
        "La licencia se suspende con la mora y termina con la terminación del contrato, sin perjuicio de los derechos del Cliente sobre sus datos.",
        "La compra del código o de la arquitectura, si las partes la acuerdan, se documenta en un contrato aparte, con precio propio, y no se deduce del pago de las mensualidades.",
        "El Cliente puede exportar sus datos en un formato estándar mientras la licencia esté activa y durante el plazo de gracia del anexo E.",
      ],
    },
    {
      tipo: "aviso",
      texto:
        "La firma de este contrato se realiza con firma electrónica simple con evidencia reforzada, no certificada, según BWS-LEG-002. Si el Cliente requiere firma certificada o autenticación notarial, debe solicitarlo antes de firmar.",
    },
  ],
};
