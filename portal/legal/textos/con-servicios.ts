/* ============================================================
   Contrato de servicios (BWS-CON-009 … BWS-CON-020)
   ------------------------------------------------------------
   Doce variantes de un mismo cuerpo: seis categorías de proyecto
   por dos personas (natural y jurídica). Sus cláusulas reúnen las
   condiciones operativas en un contrato de estilo clásico.

   El título visible es siempre "CONTRATO DE SERVICIOS"; la
   categoría y la persona solo cambian el objeto de la PRIMERA y el
   nombre del archivo. La comparecencia define a **LA EMPRESA**, así
   que el cuerpo la cita así y nunca repite la razón social.

   El objeto de la PRIMERA es texto literal por categoría, no una
   variable. La integración de estas variantes al expediente real
   es independiente de esta plantilla.
   ============================================================ */

import type { Bloque, DocumentoLegal } from "../tipos";

export type PersonaContrato = "natural" | "juridica";

export const CATEGORIAS_CONTRATO = [
  { categoria: "Sitio web", objeto: "página web", articulo: "una" },
  { categoria: "Aplicación web", objeto: "aplicación web (web app)", articulo: "una" },
  { categoria: "Tienda en línea", objeto: "tienda en línea (web app de comercio electrónico)", articulo: "una" },
  { categoria: "Sistema interno", objeto: "aplicación a medida (app) de uso interno", articulo: "una" },
  { categoria: "Portafolio", objeto: "portafolio digital", articulo: "un" },
  { categoria: "Otro", objeto: "desarrollo informático a medida", articulo: "un" },
] as const;

export type CategoriaContrato = (typeof CATEGORIAS_CONTRATO)[number]["categoria"];

const PREAMBULO_EMPRESA =
  "Entre **DIEGO ANDRES BELEÑO VILLALOBOS**, titular de la cédula de identidad **V-34.201.580**, actuando en nombre y representación de **BLINK TECHNOLOGY CORPORATION**, domiciliada en {{bws_domicilio}}, inscrita en el registro de información fiscal con el RIF **J-50898639-3**, denominada en adelante **LA EMPRESA**.";

const PREAMBULO_NATURAL =
  "Por otra parte, el ciudadano **{{cliente_razon_social}}**, mayor de edad, titular del documento {{cliente_documento_tipo}} No. **{{cliente_documento_numero}}**, actuando en su propio nombre, con domicilio en {{cliente_domicilio}}, en adelante, denominado **EL CLIENTE**.";

const PREAMBULO_JURIDICA =
  "Por otra parte, **{{cliente_razon_social}}**, domiciliada en {{cliente_domicilio}}, con registro de información fiscal (RIF) **{{cliente_documento_numero}}**, en adelante, denominada **EL CLIENTE**, representada en este acto por **{{cliente_rep_nombre}}**, titular de la cédula de identidad **{{cliente_rep_documento}}**, quien firma en su representación.";

function cuerpo(objeto: string, articulo: string, persona: PersonaContrato): Bloque[] {
  return [
    { tipo: "titulo", texto: "CONTRATO DE SERVICIOS" },
    { tipo: "parrafo", texto: PREAMBULO_EMPRESA },
    { tipo: "parrafo", texto: persona === "natural" ? PREAMBULO_NATURAL : PREAMBULO_JURIDICA },
    {
      tipo: "parrafo",
      texto:
        "Ambas partes, reconociéndose capacidad legal suficiente para obligarse, convienen en celebrar el presente **Contrato de Servicios**, que se regirá por las siguientes cláusulas:",
    },

    { tipo: "capitulo", texto: "CAPÍTULO I", subtitulo: "Disposiciones generales" },
    {
      tipo: "clausula",
      ordinal: "PRIMERA:",
      texto: `**LA EMPRESA** se compromete a crear ${articulo} ${objeto} para **EL CLIENTE**, mediante desarrollos informáticos y estrategia de presencia en Internet. También prestará asesoría, mantenimiento y expansión del Proyecto en los términos de este contrato.`,
    },
    {
      tipo: "clausula",
      ordinal: "SEGUNDA:",
      texto:
        "**LA EMPRESA** es una empresa especializada en hardware, software y comunicaciones, y declara contar con la capacidad técnica y profesional para ejecutar el objeto de este contrato.",
    },
    {
      tipo: "clausula",
      ordinal: "TERCERA:",
      texto:
        "**LA EMPRESA** se obliga a crear el Proyecto **{{proyecto_nombre}}**, bajo la dirección web **{{proyecto_dominio}}**, con el alcance definido en el Capítulo II de este contrato.",
    },

    { tipo: "capitulo", texto: "CAPÍTULO II", subtitulo: "Del objeto, el alcance y las entregas" },
    {
      tipo: "clausula",
      ordinal: "CUARTA:",
      texto:
        "El alcance del Proyecto es el descrito en esta cláusula y queda cerrado y congelado al momento de la firma. Los datos del Proyecto son los siguientes:",
    },
    {
      tipo: "tabla",
      cabecera: ["Dato", "Valor"],
      anchos: [0.32, 0.68],
      filas: [
        ["Nombre comercial", "{{proyecto_nombre}}"],
        ["Categoría", "{{proyecto_categoria}}"],
        ["Dominio", "{{proyecto_dominio}}"],
        ["Complejidad declarada", "{{proyecto_complejidad}}"],
        ["Plan de infraestructura", "{{plan_nombre}}"],
      ],
    },
    { tipo: "parrafo", texto: "**Descripción técnica y alcance del formulario.** {{proyecto_alcance}}" },
    {
      tipo: "parrafo",
      texto:
        "Las tecnologías, herramientas y configuraciones del Proyecto se definirán según el alcance descrito por **EL CLIENTE** en el formulario y los acuerdos escritos de las partes, sin imponer una tecnología específica.",
    },
    {
      tipo: "parrafo",
      texto:
        "El Proyecto incluye hasta cinco (5) buzones de correo corporativo:",
    },
    { tipo: "buzones" },
    { tipo: "parrafo", texto: "No están incluidos en el precio ni en el alcance:" },
    {
      tipo: "lista",
      items: [
        "Las funciones, pantallas e integraciones no enumeradas en esta cláusula.",
        "Los contenidos que **EL CLIENTE** no haya entregado a **LA EMPRESA**.",
        "Toda función, mejora o cambio conversado, sugerido o insinuado que no figure por escrito en este contrato o en un acuerdo escrito entre las partes.",
      ],
    },
    {
      tipo: "clausula",
      ordinal: "QUINTA:",
      texto:
        "**LA EMPRESA** entregará una primera demo funcional del Proyecto en un plazo estimado de catorce (14) a cuarenta y dos (42) días hábiles, contado desde la activación del dominio. Sobre la demo se aplicarán las correcciones acordadas y se hará la entrega definitiva. **EL CLIENTE** debe aportar los contenidos, accesos y aprobaciones en tiempo útil. Su retraso desplaza el plazo en la misma medida. Cada entrega se da por aceptada si **EL CLIENTE** no la observa por escrito dentro de los cinco (5) días hábiles siguientes, con fallas reproducibles. La aceptación definitiva puede expresarse por escrito o producirse conforme al plazo indicado.",
    },
    {
      tipo: "clausula",
      ordinal: "SEXTA:",
      texto:
        "El precio incluye dos (2) rondas de cambios sobre la primera demo funcional. Toda modificación o función adicional se notifica por escrito y requiere un acuerdo escrito de las partes sobre su precio y plazo propios. Se paga antes de ejecutarse.",
    },
    {
      tipo: "clausula",
      ordinal: "SÉPTIMA:",
      texto:
        "**LA EMPRESA** ejecutará el Proyecto con la diligencia y calidad profesionales propias de su actividad, y responde por la corrección y precisión de los documentos que aporte. Avisará sin dilación a **EL CLIENTE** de los errores que advierta en la ejecución, y responde por los actos de sus empleados y subcontratistas en los términos de este contrato.",
    },

    { tipo: "capitulo", texto: "CAPÍTULO III", subtitulo: "Del precio, la facturación y los gastos" },
    {
      tipo: "clausula",
      ordinal: "OCTAVA:",
      texto:
        "La tarifa mensual de desarrollo y mantenimiento es **{{tarifa_desarrollo}}**. El primer mes se paga al entregar la primera demo funcional y los siguientes por adelantado al inicio de cada mes. Desde la entrega definitiva, esa misma tarifa cubre el mantenimiento del servicio.",
    },
    {
      tipo: "parrafo",
      texto:
        "El pago puede hacerse en bolívares mediante Pago Móvil o transferencia bancaria. También puede hacerse en USDT, USDC, BTC o ETH. El monto correspondiente se acuerda al momento de cada pago, sin fijar tasas ni equivalentes de conversión para pagos futuros.",
    },
    {
      tipo: "parrafo",
      texto:
        "En cada pago, los tributos y las retenciones aplicables se calculan y gestionan, y los soportes o comprobantes correspondientes se emiten y gestionan, según la condición fiscal declarada por **EL CLIENTE** y lo que corresponda. El plan de infraestructura elegido y las funciones adicionales cotizadas se cobran según lo acordado. El dominio se rige por la cláusula siguiente.",
    },
    {
      tipo: "clausula",
      ordinal: "NOVENA:",
      texto:
        "El dominio **{{proyecto_dominio}}** se registra a nombre y por cuenta de **LA EMPRESA**, que gestiona y paga su registro y renovación, y conserva la propiedad del dominio y la cuenta de registro para agilizar el proceso sin solicitar credenciales personales a **EL CLIENTE** ni vulnerar sus datos. Se recomienda la extensión .com.ve, cuyo costo es de **EUR 16,04 al año**, porque **LA EMPRESA** la paga y gestiona directamente para asegurar su correcto funcionamiento. Las demás extensiones están sujetas a precio y disponibilidad. **LA EMPRESA** coopera con la transferencia del dominio si **EL CLIENTE** la solicita. Al finalizar el Proyecto, **EL CLIENTE** recibe sus correos corporativos, claves y credenciales correspondientes, incluidas las del panel de administración de la aplicación. El alojamiento y la infraestructura permanecen en las cuentas de **LA EMPRESA** y no se entregan accesos raíz a los proveedores.",
    },
    {
      tipo: "clausula",
      ordinal: "DÉCIMA:",
      texto:
        "El Proyecto se despliega sobre el plan de infraestructura siguiente, cuyos límites son los del proveedor a la fecha indicada:",
    },
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
    { tipo: "limites" },
    {
      tipo: "parrafo",
      texto:
        "Los límites pueden cambiar cuando el proveedor los actualice, con aviso a **EL CLIENTE**. Un plan de infraestructura distinto del elegido es opcional y no se activa automáticamente.",
    },

    { tipo: "capitulo", texto: "CAPÍTULO IV", subtitulo: "De la propiedad intelectual, los contenidos y la licencia" },
    {
      tipo: "clausula",
      ordinal: "DÉCIMA PRIMERA:",
      texto:
        "El código fuente, la arquitectura, el sistema de diseño, los componentes, las plantillas, la documentación y la totalidad de la página web, aplicación, web app o portafolio desarrollados para **EL CLIENTE** son propiedad exclusiva de **LA EMPRESA**. El pago de las mensualidades no transfiere ni presume la venta del código ni del sistema. Su compra total, si las partes la acuerdan, se documenta por escrito con un precio acordado y debe pagarse en su totalidad.",
    },
    {
      tipo: "clausula",
      ordinal: "DÉCIMA SEGUNDA:",
      texto:
        "**LA EMPRESA** otorga a **EL CLIENTE** una licencia de uso no exclusiva, no transferible y revocable, para la operación de su negocio a través de Internet durante la vida del servicio contratado. La licencia no permite obtener, copiar o reutilizar el código fuente, revender, sublicenciar, alquilar ni replicar la arquitectura o el sistema de diseño. La mención **Powered by Blink** permanecerá visible hasta que la compra total del código y del sistema sea acordada por escrito y pagada en su totalidad.",
    },
    {
      tipo: "clausula",
      ordinal: "DÉCIMA TERCERA:",
      texto:
        "Los textos, fotografías, logotipos y demás contenidos que **EL CLIENTE** entrega son de su propiedad o cuenta con derechos para usarlos, y **EL CLIENTE** puede seguir usándolos libremente. **EL CLIENTE** declara que son lícitos y libres de derechos de terceros y responde por ellos. **LA EMPRESA** recibe una autorización limitada para tratarlos con la única finalidad de prestar el servicio y no adquiere derecho alguno sobre ellos.",
    },

    { tipo: "capitulo", texto: "CAPÍTULO V", subtitulo: "De la mora, la suspensión, la garantía y la responsabilidad" },
    {
      tipo: "clausula",
      ordinal: "DÉCIMA CUARTA:",
      texto:
        "No existe período de gracia. Al vencimiento de una mensualidad impagada, **LA EMPRESA** puede suspender el servicio. Las mensualidades vencidas se acumulan como deuda mientras el contrato permanezca vigente, incluso durante la suspensión. Podrán aplicarse intereses si las partes los acuerdan por escrito o si resultan aplicables, sin fijar una tasa en este contrato.",
    },
    {
      tipo: "clausula",
      ordinal: "DÉCIMA QUINTA:",
      texto:
        "La licencia de uso está condicionada al pago puntual de la mensualidad. Si **EL CLIENTE** deja de pagarla, **LA EMPRESA** puede quitar el acceso a la aplicación y bloquearla para todos los usuarios, incluidos los usuarios finales de **EL CLIENTE**, sin obligación de entregar el código fuente. Al suspenderse, la aplicación sale de línea y **LA EMPRESA** conserva el código, la arquitectura, el despliegue y la infraestructura. La reactivación exige el pago de todas las mensualidades acumuladas y los intereses moratorios aplicables, y el registro correspondiente.",
    },
    {
      tipo: "clausula",
      ordinal: "DÉCIMA SEXTA:",
      texto:
        "**LA EMPRESA** corregirá sin costo las fallas reproducibles del alcance entregado que **EL CLIENTE** reporte dentro de los treinta (30) días siguientes a la entrega definitiva. Quedan fuera de la garantía: el uso indebido, los cambios hechos por terceros, los contenidos de **EL CLIENTE**, las funciones fuera de alcance y las fallas de los proveedores de infraestructura. Vencida la garantía, la atención de fallas y el soporte continúan con la mensualidad de mantenimiento.",
    },
    {
      tipo: "clausula",
      ordinal: "DÉCIMA SÉPTIMA:",
      texto:
        "Cada parte responde por sus obligaciones conforme a este contrato. **EL CLIENTE** responde por sus contenidos y por el uso ilícito del Proyecto.",
    },
    {
      tipo: "clausula",
      ordinal: "DÉCIMA OCTAVA:",
      texto:
        "Cualquiera de las partes puede terminar este contrato con aviso escrito de treinta (30) días. **LA EMPRESA** puede suspender o terminar de inmediato por impago, uso ilícito o riesgo de seguridad. Los meses cursados no se reembolsan. Al terminar, **EL CLIENTE** puede exportar sus datos. **LA EMPRESA** los conserva durante noventa (90) días y después los elimina o anonimiza con aviso. La licencia termina y el código no se entrega, salvo que se haya acordado y pagado su compra total. El dominio sigue a nombre de **LA EMPRESA**, que coopera con su transferencia a solicitud de **EL CLIENTE**. Sobreviven las cláusulas de propiedad intelectual, confidencialidad y responsabilidad.",
    },

    { tipo: "capitulo", texto: "CAPÍTULO VI", subtitulo: "De los datos personales y la confidencialidad" },
    {
      tipo: "clausula",
      ordinal: "DÉCIMA NOVENA:",
      texto:
        "Respecto de los datos de los usuarios finales de la aplicación, **EL CLIENTE** es el responsable del tratamiento y **LA EMPRESA** la encargada. El encargo comprende:",
    },
    {
      tipo: "lista",
      items: [
        "Alojar, procesar, respaldar y dar soporte a los datos únicamente siguiendo instrucciones documentadas de **EL CLIENTE** y para prestar el servicio.",
        "**LA EMPRESA** no usará los datos para fines propios, no los venderá ni los cederá.",
        "Los subencargados son los proveedores de alojamiento, base de datos y correo que se contraten para el Proyecto. Cualquier cambio sustancial se informa a **EL CLIENTE**.",
        "**LA EMPRESA** aplica medidas razonables de seguridad y avisará de los incidentes que afecten datos personales dentro de las setenta y dos (72) horas de conocidos.",
        "Al terminar, **LA EMPRESA** devuelve o elimina los datos en un plazo de noventa (90) días, y certifica la eliminación si se solicita.",
        "**EL CLIENTE** puede auditar el cumplimiento una vez al año, con aviso y sin acceso a datos de otros clientes.",
      ],
    },
    {
      tipo: "parrafo",
      texto:
        "**EL CLIENTE** consiente el procesamiento de los datos fuera de Venezuela y lo informará a sus usuarios. Los datos del portal se rigen por la política de privacidad del portal.",
    },
    {
      tipo: "clausula",
      ordinal: "VIGÉSIMA:",
      texto:
        "Cada parte mantiene reservada la información confidencial de la otra y solo la usa para ejecutar este contrato. La obligación se extiende a empleados y proveedores que la necesiten y continúa, incluso después de la terminación, hasta que las partes acuerden por escrito términos definitivos de confidencialidad. **LA EMPRESA** podrá exhibir el Proyecto en su portafolio y en menciones comerciales, sin divulgar información confidencial de **EL CLIENTE**. Para información especialmente sensible las partes pueden firmar un acuerdo de confidencialidad antes de compartirla.",
    },

    { tipo: "capitulo", texto: "CAPÍTULO VII", subtitulo: "De las políticas de uso y disposiciones finales" },
    {
      tipo: "clausula",
      ordinal: "VIGÉSIMA PRIMERA:",
      texto:
        "**EL CLIENTE** es el único responsable de determinar si los servicios se ajustan a sus necesidades, y de hacer constar sus datos identificativos y su aviso de política de uso en los contenidos del Proyecto.",
    },
    {
      tipo: "clausula",
      ordinal: "VIGÉSIMA SEGUNDA:",
      texto:
        "Las notificaciones entre las partes se envían por correo electrónico con acuse de recibo a {{cliente_correo}} y a {{bws_correo}}, o a las direcciones que las partes actualicen por escrito, y se entienden recibidas el día hábil siguiente al envío, salvo error de entrega acreditado.",
    },
    {
      tipo: "clausula",
      ordinal: "VIGÉSIMA TERCERA:",
      texto:
        "Este contrato se rige por las estipulaciones de este contrato y las políticas internas de la plataforma. Es de carácter mercantil y no crea vínculo laboral alguno entre las partes. Las partes acuerdan someter toda controversia derivada de este contrato o relacionada con él a la jurisdicción exclusiva de los tribunales competentes de Maracaibo, Estado Zulia.",
    },
    {
      tipo: "clausula",
      ordinal: "VIGÉSIMA CUARTA:",
      texto:
        "Al estampar su firma, **EL CLIENTE** acepta expresamente la totalidad de los términos y cláusulas descritos en este contrato.",
    },
    {
      tipo: "parrafo",
      texto:
        "Las partes suscriben este contrato el {{fecha_documento}}.",
    },
  ];
}

const CAMPOS_COMUNES = [
  "fecha_documento",
  "bws_domicilio",
  "bws_correo",
  "cliente_razon_social",
  "cliente_documento_numero",
  "cliente_domicilio",
  "cliente_correo",
  "proyecto_nombre",
  "proyecto_categoria",
  "proyecto_dominio",
  "proyecto_alcance",
  "proyecto_complejidad",
  "plan_nombre",
  "plan_precio",
  "plan_fuente",
  "plan_fecha",
  "tarifa_desarrollo",
];

/** Una variante por categoría y persona: BWS-CON-009 … BWS-CON-020. */
export function construirContrato(categoria: CategoriaContrato, persona: PersonaContrato): DocumentoLegal {
  const indice = CATEGORIAS_CONTRATO.findIndex((c) => c.categoria === categoria);
  if (indice < 0) throw new Error(`Categoría de contrato desconocida: ${categoria}`);
  const definicion = CATEGORIAS_CONTRATO[indice];
  const numero = 9 + indice * 2 + (persona === "juridica" ? 1 : 0);
  const codigo = `BWS-CON-${String(numero).padStart(3, "0")}`;
  const campos =
    persona === "natural"
      ? [...CAMPOS_COMUNES, "cliente_documento_tipo"]
      : [...CAMPOS_COMUNES, "cliente_rep_nombre", "cliente_rep_documento"];
  return {
    codigo,
    titulo: "CONTRATO DE SERVICIOS",
    version: "1.0",
    fecha: "2026-11-18",
    firma: "proyecto",
    resumen:
      "Contrato del proyecto: alcance, entregas, tarifa mensual de desarrollo y mantenimiento, propiedad del código de la empresa, licencia de uso y suspensión por impago.",
    campos,
    bloques: cuerpo(definicion.objeto, definicion.articulo, persona),
    estilo: "clasico",
  };
}

/** Las doce variantes, en orden de categoría y persona. */
export const CONTRATOS: DocumentoLegal[] = [];
export const CONTRATO_POR_CLAVE = new Map<string, DocumentoLegal>();
for (const c of CATEGORIAS_CONTRATO) {
  for (const persona of ["natural", "juridica"] as const) {
    const doc = construirContrato(c.categoria, persona);
    CONTRATOS.push(doc);
    CONTRATO_POR_CLAVE.set(`${c.categoria}|${persona}`, doc);
  }
}

export function contratoDe(categoria: string, persona: PersonaContrato): DocumentoLegal {
  const doc = CONTRATO_POR_CLAVE.get(`${categoria}|${persona}`);
  if (!doc) throw new Error(`No hay contrato para la categoría ${categoria} y persona ${persona}`);
  return doc;
}