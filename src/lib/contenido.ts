/* ============================================================
   Copy de Blink Web Services
   ------------------------------------------------------------
   Todo el texto del sitio vive aquí, tipado, para que quien revise la
   página lo lea de corrido sin abrir tres componentes.

   LA REGLA DE ESTA HOJA
   El cliente llega con dos cosas: una idea y dinero para pagarla. No
   tiene que demostrar que sabe de tecnología, y el sitio no tiene que
   hacérselo demostrar. Por eso en todo el copy:

     · NO se dice base de datos, hosting, servidor, CDN, API, DNS,
       repositorio, framework ni deploy. Lo que antes era «dominio, base
       de datos y hosting» se dice como lo diría una persona: «el nombre
       en Internet, el correo con tu marca y el sitio donde vive todo».
     · NO aparecen los nombres de las herramientas (viven solo en
       `lib/socios.ts`, como logos, sin una línea de explicación).
     · SI se dice «tu dirección en Internet», «tu correo con el nombre
       de tu empresa», «publicado», «andando».
     · Frases cortas y afirmativas. Si una línea explica algo que el
       cliente no preguntó, sobra: se va.

   Se comprueba con `npm run verificar` (`scripts/sin-tecnicismos.mjs`),
   que quita los comentarios antes de buscar —si no, esta misma hoja
   aparecería como infracción— y recorre copy, componentes y lo que se
   sirve desde `public/`.

   El español es neutro y de trato directo («tú»), porque el público es
   Venezuela y la diáspora. Frases cortas: el que lee en el móvil no
   vuelve a empezar el párrafo.
   ============================================================ */

export const MARCA = {
  nombre: "Blink Web Services",
  sigla: "BWS",
  sub: "Web Services",
};

export const CONTACTO = {
  /** Se marca con +1 porque la puerta de entrada es la diáspora. */
  telefono: "+1 (631) 821 1938",
  telefonoMarca: "+16318211938",
  correo: "business@blink.com.ve",
  whatsapp: "https://wa.me/16318211938",
  /** El mensaje que ya viene escrito cuando alguien toca el botón del
      pie, que es el único sitio del sitio donde vive el canal. */
  whatsappSaludo: "https://wa.me/16318211938?text=" + encodeURIComponent("Hola BWS: quiero montar una página"),
  /** El horario no es una promesa de reparto: es el aviso de que el
      canal está abierto cuando el cliente puede hablar, que en la
      diáspora suele ser de madrugada. */
  horario: "24/7",
  ciudad: "Maracaibo",
  region: "Zulia",
};

export const ENLACES_FABRICA = {
  blink: "https://blink.com.ve",
  pay: "https://pay.blink.com.ve",
  pos: "https://pos.blink.com.ve",
};

/** Navegación superior: solo anclas de la propia página. */
export const NAV = [
  { texto: "Qué hacemos", ancla: "#que-hacemos" },
  { texto: "Cómo trabajamos", ancla: "#proceso" },
  { texto: "Preguntas", ancla: "#preguntas" },
];

export const HERO = {
  titulo: "Solo traes dos cosas: una idea y el dinero.",
  /** La bajada es una sola línea y no repite el titular: dice qué pasa
      con todo lo que el cliente no trae. */
  sub: "Nosotros nos encargamos del resto.",
  /* Arriba no se abre el canal: arriba se abre la cuenta. El que llega
     y todavía no leyó nada no tiene nada que preguntar, y el WhatsApp
     vive solo en el pie — así el recorrido es la página entera, y el
     canal aparece cuando ya sabe qué le están ofreciendo. */
  ctaPrimaria: { texto: "Crear cuenta", url: "/registro" },
  ctaSecundaria: { texto: "Ver qué hacemos", ancla: "#que-hacemos" },
};

export const BENEFICIOS = {
  id: "resuelves",
  titulo: "Lo que dejas de cargar.",
  piezas: [
    {
      titulo: "Todo el trámite.",
      cuerpo: "El nombre en Internet, el correo con tu marca y el sitio donde vive todo. No abres ni una cuenta.",
    },
    {
      titulo: "Publicado el día que decimos.",
      cuerpo: "Tu proyecto está en Internet y la gente lo puede abrir, sin que muevas un dedo.",
    },
    {
      titulo: "Cero papeleo. Cero contraseñas raras.",
      cuerpo: "Tú apruebas. Nosotros guardamos, ordenamos y respondemos por el resto.",
    },
    {
      titulo: "Que algo se caiga un domingo.",
      cuerpo: "Si el sitio deja de responder o el correo con tu marca se atasca, avisas por el canal del pie y lo dejamos andando otra vez. Está abierto a la hora que sea, también un domingo.",
    },
  ],
};

export const SERVICIOS = {
  id: "que-hacemos",
  titulo: "Qué hacemos",
  bajada: "Lo diseñamos, lo construimos y lo publicamos. Tú solo lo revisas y lo apruebas.",
  piezas: [
    {
      icono: "pagina" as const,
      titulo: "Páginas web",
      cuerpo: "Tu negocio, bien presentado, bonita y fácil de explorar para los usuarios.",
    },
    {
      icono: "app" as const,
      titulo: "Web apps",
      cuerpo: "Para que tus usuarios no tengan que descargar nada: todo funciona en la nube, sin ocupar espacio en sus teléfonos.",
    },
    {
      icono: "portafolio" as const,
      titulo: "Portafolios",
      cuerpo: "Tu trabajo, tus proyectos o tu marca personal.",
    },
  ],
};

export const PROCESO = {
  id: "proceso",
  titulo: "Así trabajamos",
  bajada: "Tres pasos.",
  pasos: [
    {
      titulo: "Cuéntanos la idea",
      cuerpo: "Un audio, un correo, un boceto en una servilleta. Como te salga.",
    },
    {
      titulo: "Paga y espera",
      cuerpo: "Tu proyecto ya está en marcha: solo tienes que esperar y, tal vez, responder algunas preguntas.",
    },
    {
      titulo: "Ya está en Internet",
      cuerpo: "Cuando menos te lo esperas ya está listo: te entregamos tus correos corporativos, tus credenciales y todo lo que necesites.",
    },
  ],
};

export const PROMESA = {
  id: "promesa",
  /** Sin subtítulo: la promesa se lee sola y no pide que se le explique. */
  titulo: "Tu proyecto, sobre la tecnología que sostiene a Blink.",
};

export const SOCIOS = {
  id: "aliados",
  titulo: "Los que ya lo hacen.",
  /* Sin nota legal y sin líneas de apoyo: la banda se dibuja, no se
     explica. Los nombres solo se leen como texto de marca, al lado de
     cada logo. */
};

export const PREGUNTAS = {
  id: "preguntas",
  titulo: "Preguntas que nos hacen siempre.",
  piezas: [
    {
      pregunta: "¿Cuánto cuesta?",
      respuesta:
        "Depende de lo que quieras crear. Hablemos y te cotizamos tu proyecto; puede que nos adaptemos a tu presupuesto.",
    },
    {
      pregunta: "¿Tengo que comprar algo yo?",
      respuesta:
        "Solo danos tus datos y el nombre de tu proyecto. Lo demás lo tramitamos nosotros.",
    },
    {
      pregunta: "¿Cuánto tarda?",
      respuesta:
        "Las primeras demos llegan entre una y dos semanas. El proyecto final depende de la complejidad.",
    },
    {
      pregunta: "¿Tengo que saber de tecnología?",
      respuesta:
        "Nada, para eso estamos nosotros. Nos dices cómo quieres que se vea y qué debe hacer el sitio, y lo dejamos listo para que lo revises y des el visto bueno.",
    },
    {
      pregunta: "¿Por qué no publican tarifas?",
      respuesta:
        "Porque cada proyecto se cotiza con nombres y apellidos: una sola cifra, por escrito, antes de empezar.",
    },
  ],
};

export const CIERRE = {
  id: "hablemos",
  titulo: "Hablemos.",
  bajada: "Cuéntanos qué quieres montar. Te decimos cómo, cuándo y cuánto.",
};

export const PIE = {
  /* El pie se lee en el orden en que se decide: primero el canal, con
     el horario y el sitio para que nadie crea que va a esperar un
     correo que llega al día siguiente; después cómo se paga, en logos
     y no como una pregunta; al final las páginas que alguien va a
     buscar una vez que ya dijo que sí. La marca y los enlaces de la
     familia cierran, que es donde siempre estuvieron. */
  canal: {
    texto: "Escribir por WhatsApp",
    url: CONTACTO.whatsappSaludo,
    horario: `Atención ${CONTACTO.horario}`,
    lugar: `${CONTACTO.ciudad}, ${CONTACTO.region}`,
  },
  politicas: [
    { texto: "Privacidad", url: "/privacidad/" },
    { texto: "Términos de servicio", url: "/terminos/" },
    { texto: "Cómo se paga", url: "/pagos/" },
  ],
  legal: `© 2026 Blink · ${CONTACTO.ciudad}, ${CONTACTO.region}`,
  enlaces: [
    { texto: "Portal de clientes", url: "/ingreso" },
    { texto: "blink.com.ve", url: ENLACES_FABRICA.blink },
    { texto: "Blink Pay", url: ENLACES_FABRICA.pay },
    { texto: "Blink POS", url: ENLACES_FABRICA.pos },
  ],
};
