/* ============================================================
   Contrato de servicios (BWS-CON-009 … BWS-CON-020)
   ------------------------------------------------------------
   Doce variantes de un mismo cuerpo: seis categorías de proyecto
   por dos personas (natural y jurídica). Reemplaza por completo a
   BWS-CON-004 y sus anexos A–F: todo lo operativo vive aquí, en
   capítulos y cláusulas, con el tono del contrato en papel.

   El objeto de la PRIMERA es texto literal por categoría, no una
   variable: la variante se elige al enviar el proyecto y el texto
   no puede quedar ambiguo.
   ============================================================ */

import type { Bloque, DocumentoLegal } from "../tipos";

export type PersonaContrato = "natural" | "juridica";

export const CATEGORIAS_CONTRATO = [
  { categoria: "Sitio web", objeto: "página web", articulo: "una", etiqueta: "Página web" },
  { categoria: "Aplicación web", objeto: "aplicación web (web app)", articulo: "una", etiqueta: "Aplicación web" },
  {
    categoria: "Tienda en línea",
    objeto: "tienda en línea (web app de comercio electrónico)",
    articulo: "una",
    etiqueta: "Tienda en línea",
  },
  {
    categoria: "Sistema interno",
    objeto: "aplicación a medida (app) de uso interno",
    articulo: "una",
    etiqueta: "Sistema interno",
  },
  { categoria: "Portafolio", objeto: "portafolio digital", articulo: "un", etiqueta: "Portafolio" },
  { categoria: "Otro", objeto: "desarrollo informático a medida", articulo: "un", etiqueta: "Otro" },
] as const;

export type CategoriaContrato = (typeof CATEGORIAS_CONTRATO)[number]["categoria"];

export function etiquetaPersona(persona: PersonaContrato): string {
  return persona === "natural" ? "Persona natural" : "Persona jurídica";
}

const PREAMBULO_EMPRESA =
  "Entre **{{representante_nombre}}**, venezolano, mayor de edad, titular de la cédula de identidad No. **{{representante_documento}}**, actuando en nombre y representación de **{{bws_razon_social}}**, constituida y domiciliada en {{bws_domicilio}}, bajo el registro de información fiscal (RIF): **{{bws_documento}}**, en adelante, denominada **LA EMPRESA**.";

const PREAMBULO_NATURAL =
  "Por otra parte, el ciudadano **{{cliente_razon_social}}**, mayor de edad, titular del documento {{cliente_documento_tipo}} No. **{{cliente_documento_numero}}**, actuando en su propio nombre, con domicilio en {{cliente_domicilio}}, en adelante, denominado **EL CLIENTE**.";

const PREAMBULO_JURIDICA =
  "Por otra parte, el ciudadano **{{cliente_rep_nombre}}**, venezolano, mayor de edad, titular de la cédula de identidad No. **{{cliente_rep_documento}}**, actuando en representación de **{{cliente_razon_social}}**, constituida y domiciliada en {{cliente_domicilio}}, bajo el registro de información fiscal (RIF): **{{cliente_documento_numero}}**, en adelante, denominada **EL CLIENTE**.";

function cuerpo(objeto: string, articulo: string, etiqueta: string, persona: PersonaContrato): Bloque[] {
  return [
    { tipo: "titulo", texto: "CONTRATO DE SERVICIOS" },
    { tipo: "subtitulo", texto: `${etiqueta} · ${etiquetaPersona(persona)}` },
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
      texto: `**LA EMPRESA** se compromete a: A) la creación de ${articulo} ${objeto} para **EL CLIENTE**, mediante desarrollos informáticos y estrategia de presencia en Internet; y B) la asesoría, el mantenimiento y la expansión de dicho Proyecto, en los términos de este contrato.`,
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
        "**LA EMPRESA** se obliga a crear el Proyecto **«{{proyecto_nombre}}»**, bajo la dirección Web **{{proyecto_dominio}}**, con el alcance definido en el Capítulo II de este contrato.",
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
        ["Plan de infraestructura", "{{plan_nombre}} ({{plan_precio}} mensuales)"],
      ],
    },
    { tipo: "parrafo", texto: "**Descripción del alcance.** {{proyecto_alcance}}" },
    {
      tipo: "parrafo",
      texto:
        "El Proyecto incluye hasta cinco (5) buzones de correo corporativo, con el buzón no-reply@ obligatorio para notificaciones automáticas:",
    },
    { tipo: "buzones" },
    { tipo: "parrafo", texto: "No están incluidos en el precio ni en el alcance:" },
    {
      tipo: "lista",
      items: [
        "Las funciones, pantallas e integraciones no enumeradas en esta cláusula.",
        "Los contenidos que **EL CLIENTE** no haya entregado a **LA EMPRESA**.",
        "Toda función, mejora o cambio conversado, sugerido o insinuado que no figure por escrito en este contrato o en un anexo firmado.",
      ],
    },
    {
      tipo: "clausula",
      ordinal: "QUINTA:",
      texto:
        "**LA EMPRESA** entregará una primera demo funcional del Proyecto en un plazo estimado de {{demo_plazo}}, contado desde la activación del dominio. Sobre la demo se aplicarán las correcciones acordadas y se hará la entrega definitiva. **EL CLIENTE** debe aportar los contenidos, accesos y aprobaciones en tiempo útil; su retraso desplaza el plazo en la misma medida. Cada entrega se da por aceptada si **EL CLIENTE** no la observa por escrito dentro de los cinco (5) días hábiles siguientes, con fallas reproducibles. La aceptación definitiva se documenta en el acta de entrega y licencia BWS-LIC-007.",
    },
    {
      tipo: "clausula",
      ordinal: "SEXTA:",
      texto:
        "El precio incluye dos (2) rondas de cambios sobre la primera demo funcional. Toda modificación o función adicional se notifica por escrito y se cotiza con precio y plazo propios mediante un anexo unido a este contrato, que se paga antes de ejecutarse.",
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
        "El precio del desarrollo es de **{{mantenimiento_precio}} mensuales**: el primer mes se paga al entregar la primera demo funcional y los siguientes por adelantado al inicio de cada mes. Desde la entrega definitiva, la misma mensualidad de **{{mantenimiento_precio}}** se factura como mantenimiento del servicio. El pago puede hacerse en bolívares a la tasa P2P de Binance del día del pago, o en **treinta y un (31) USDT o USDC**, o su equivalente en **BTC o ETH** a la cotización del momento del registro de este documento. Para este contrato, las cifras quedan congeladas en la tabla siguiente:",
    },
    {
      tipo: "tabla",
      cabecera: ["Concepto", "Valor congelado al registro"],
      anchos: [0.42, 0.58],
      filas: [
        ["Mensualidad", "{{mantenimiento_precio}}"],
        ["Tasa P2P de Binance (USDT/VES)", "{{tasa_p2p_valor}} al {{tasa_p2p_fecha}}"],
        ["Equivalente en bolívares", "{{mantenimiento_bs}}"],
        ["Equivalente en BTC", "{{mantenimiento_btc}}"],
        ["Equivalente en ETH", "{{mantenimiento_eth}}"],
      ],
    },
    {
      tipo: "parrafo",
      texto:
        "La tasa P2P aplicable a los pagos en bolívares es la del día en que se efectúe cada pago; las cifras de esta tabla son la referencia congelada al momento del registro del documento. El precio no incluye tributos: el IVA y, en su caso, el IGTF se discriminan en la factura. Van aparte y se facturan por separado: el registro del dominio, el plan Pro de infraestructura y las funciones adicionales cotizadas.",
    },
    {
      tipo: "clausula",
      ordinal: "NOVENA:",
      texto:
        "El dominio **{{proyecto_dominio}}** queda a nombre de **EL CLIENTE**. **LA EMPRESA** gestiona su registro y configuración ante el registro correspondiente, con hasta cinco (5) buzones incluido el no-reply@ obligatorio. El alojamiento y la infraestructura permanecen en las cuentas de **LA EMPRESA** ante sus proveedores. Al terminar el Proyecto, **EL CLIENTE** recibe sus buzones corporativos y las credenciales del panel de administración de la aplicación; no recibe accesos raíz a los proveedores. **LA EMPRESA** coopera con la transferencia del dominio, y la falta de pago del registro puede impedir su renovación, con aviso por escrito. El registro anual tiene un costo de referencia de {{dominio_costo_eur}}, pagadero en bolívares a la tasa oficial del BCV del día del pago; como referencia, la tasa del {{tasa_bcv_fecha}} es de {{tasa_bcv_valor}} por dólar.",
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
        "Los límites pueden cambiar cuando el proveedor los actualice, con aviso a **EL CLIENTE**. El plan Pro de infraestructura, de {{tarifa_infra_pro}} mensuales, es opcional y no se activa automáticamente.",
    },

    { tipo: "capitulo", texto: "CAPÍTULO IV", subtitulo: "De la propiedad intelectual, los contenidos y la licencia" },
    {
      tipo: "clausula",
      ordinal: "DÉCIMA PRIMERA:",
      texto:
        "El código fuente, la arquitectura, el sistema de diseño, los componentes, las plantillas, la documentación y la totalidad de la página web, aplicación, web app o portafolio desarrollados para **EL CLIENTE** son propiedad exclusiva de **LA EMPRESA**. El pago de las mensualidades no transfiere ni presume la venta del código ni de la arquitectura; su compra, si las partes la acuerdan, se documenta en un contrato aparte con precio propio.",
    },
    {
      tipo: "clausula",
      ordinal: "DÉCIMA SEGUNDA:",
      texto:
        "**LA EMPRESA** otorga a **EL CLIENTE** una licencia de uso no exclusiva, no transferible y revocable, para la operación del negocio de **EL CLIENTE** en cualquier territorio a través de Internet, durante {{licencia_duracion}}. La licencia no permite obtener, copiar o reutilizar el código fuente, revender, sublicenciar, alquilar ni replicar la arquitectura o el sistema de diseño. La mención «Powered by Blink» deberá permanecer visible durante {{credito_meses}} desde la entrega, salvo renuncia escrita de **LA EMPRESA**.",
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
        "El estado de la suscripción se calcula así: «al día» hasta el vencimiento y cinco (5) días de gracia; «en mora» después; «suspendida» a los diez (10) días de mora, con aviso; y «terminada» a los treinta (30) días.",
    },
    {
      tipo: "clausula",
      ordinal: "DÉCIMA QUINTA:",
      texto:
        "La licencia de uso está condicionada al pago puntual de la mensualidad de mantenimiento. Si **EL CLIENTE** deja de pagarla, **LA EMPRESA** se reserva el derecho de quitar el acceso a la aplicación y bloquearla para todos los usuarios, incluidos los usuarios finales de **EL CLIENTE**, sin obligación de entregar el código fuente. Al suspenderse, la aplicación sale de línea y **LA EMPRESA** conserva el código, la arquitectura, el despliegue y la infraestructura. La reactivación exige un pago registrado y deja constancia en la auditoría.",
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
        "Salvo dolo o fraude, la responsabilidad total de **LA EMPRESA** se limita al monto pagado por **EL CLIENTE** en los doce (12) meses anteriores al hecho, y no comprende lucro cesante ni daños indirectos. **EL CLIENTE** responde por sus contenidos y por el uso ilícito del Proyecto. Nada de lo anterior limita los derechos que la ley no permita renunciar.",
    },
    {
      tipo: "clausula",
      ordinal: "DÉCIMA OCTAVA:",
      texto:
        "Cualquiera de las partes puede terminar este contrato con aviso escrito de treinta (30) días. **LA EMPRESA** puede suspender o terminar de inmediato por impago, uso ilícito o riesgo de seguridad. Los meses cursados y el registro del dominio no se reembolsan. Al terminar, **EL CLIENTE** puede exportar sus datos: **LA EMPRESA** los guarda como encargado durante noventa (90) días, pagada la deuda, y después los elimina o anonimiza con aviso. La licencia termina y el código no se entrega; el dominio sigue a nombre de **EL CLIENTE**. Sobreviven las cláusulas de propiedad intelectual, confidencialidad y responsabilidad.",
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
        "Los subencargados son los proveedores de alojamiento, base de datos y correo (Neon, Cloudflare y {{correo_proveedor}}); cualquier cambio sustancial se informa a **EL CLIENTE**.",
        "**LA EMPRESA** aplica medidas razonables de seguridad y avisará de los incidentes que afecten datos personales dentro de las setenta y dos (72) horas de conocidos.",
        "Al terminar, **LA EMPRESA** devuelve o elimina los datos en un plazo de noventa (90) días, y certifica la eliminación si se solicita.",
        "**EL CLIENTE** puede auditar el cumplimiento una vez al año, con aviso y sin acceso a datos de otros clientes.",
      ],
    },
    {
      tipo: "parrafo",
      texto:
        "**EL CLIENTE** consiente el procesamiento de los datos fuera de Venezuela y lo informará a sus usuarios. Los datos del portal se rigen por la política BWS-PRI-005.",
    },
    {
      tipo: "clausula",
      ordinal: "VIGÉSIMA:",
      texto:
        "Cada parte mantiene reservada la información confidencial de la otra y solo la usa para ejecutar este contrato. La obligación se extiende a empleados y proveedores que la necesiten, y sobrevive cinco (5) años a la terminación. **LA EMPRESA** podrá exhibir el Proyecto en su portafolio y en menciones comerciales, sin divulgar información confidencial de **EL CLIENTE**. Para información especialmente sensible se aplica el acuerdo BWS-NDA-008, que las partes pueden firmar antes de compartirla.",
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
        "Este contrato es de carácter mercantil y no crea vínculo laboral alguno entre las partes. Toda controversia derivada de este contrato o que guarde relación con él será resuelta mediante cualquier Medio Alterno de Resolución de Conflictos. Y en caso de no solucionarse el conflicto, cualquiera de las partes podrá acudir ante el Juzgado Civil que corresponda de la jurisdicción de **LA EMPRESA**, con domicilio en {{bws_domicilio}}.",
    },
    {
      tipo: "clausula",
      ordinal: "VIGÉSIMA CUARTA:",
      texto:
        "Este contrato se rige por las leyes de la República Bolivariana de Venezuela. La firma de este documento se realiza con firma electrónica simple con evidencia reforzada, no certificada, según BWS-LEG-002; si **EL CLIENTE** requiere firma certificada o autenticación notarial, debe solicitarlo antes de firmar.",
    },
    {
      tipo: "parrafo",
      texto:
        "Las Partes suscriben el Contrato, en {{bws_domicilio}}, a los {{fecha_documento}}, en dos ejemplares y a un solo efecto.",
    },
  ];
}

const CAMPOS_COMUNES = [
  "fecha_documento",
  "bws_razon_social",
  "bws_documento",
  "bws_domicilio",
  "bws_correo",
  "representante_nombre",
  "representante_documento",
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
  "dominio_costo_eur",
  "tasa_bcv_fecha",
  "tasa_bcv_valor",
  "demo_plazo",
  "tarifa_infra_pro",
  "licencia_duracion",
  "credito_meses",
  "correo_proveedor",
  "mantenimiento_precio",
  "tasa_p2p_valor",
  "tasa_p2p_fecha",
  "mantenimiento_bs",
  "mantenimiento_btc",
  "mantenimiento_eth",
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
    titulo: `Contrato de servicios · ${definicion.etiqueta} · ${etiquetaPersona(persona)}`,
    version: "1.0",
    fecha: "2026-11-18",
    firma: "proyecto",
    resumen:
      "Contrato del proyecto: alcance cerrado, entregas, mensualidad de USD 31, propiedad del código en LA EMPRESA, licencia de uso, mora y bloqueo por impago. Reemplaza a BWS-CON-004 y sus anexos.",
    campos,
    bloques: cuerpo(definicion.objeto, definicion.articulo, definicion.etiqueta, persona),
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
  if (!doc) throw new Error(`No hay contrato para la categoría «${categoria}» y persona ${persona}`);
  return doc;
}