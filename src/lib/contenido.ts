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
  /** El mensaje que ya viene escrito cuando alguien toca «Hablemos». */
  whatsappSaludo: "https://wa.me/16318211938?text=" + encodeURIComponent("Hola BWS: quiero montar una página"),
  ciudad: "Maracaibo, Venezuela",
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
  /* El botón no baja a un formulario: abre la conversación. El sitio no
     captura datos, así que el camino más corto entre la idea y nosotros
     es el WhatsApp que ya contestamos. */
  ctaPrimaria: { texto: "Hablemos", url: CONTACTO.whatsappSaludo },
  ctaSecundaria: { texto: "Ver qué hacemos", ancla: "#que-hacemos" },
};

export const BENEFICIOS = {
  id: "resuelves",
  titulo: "Cosas por las que dejas de preocuparte.",
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
      titulo: "Atado a la tecnología que sostiene a Blink.",
      cuerpo: "No es un experimento: es la forma en que ya trabajamos todos los días.",
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
      cuerpo: "Su negocio, bien presentado, bonito y fácil de explorar para los usuarios.",
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
  titulo: "¿Cómo trabajamos?",
  bajada: "Es muy sencillo.",
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
      titulo: "¿Ya está en Internet?",
      cuerpo: "Cuando menos te lo esperas ya está listo: te entregamos tus correos corporativos, tus credenciales y todo lo que necesites.",
    },
  ],
};

export const PROMESA = {
  id: "promesa",
  /** Sin subtítulo: la promesa se lee sola y no pide que se le explique. */
  titulo: "Tu proyecto funcionará bajo la misma tecnología que hace funcionar a Blink.",
};

export const SOCIOS = {
  id: "aliados",
  titulo: "Trabajamos con los mejores en esto.",
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
        "Nada, para eso estamos nosotros. Tú nos dices cómo se ve y qué hace; del resto nos ocupamos nosotros.",
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
  legal: `© 2026 Blink · ${CONTACTO.ciudad}`,
  enlaces: [
    { texto: "Portal de clientes", url: "/ingreso" },
    { texto: "blink.com.ve", url: ENLACES_FABRICA.blink },
    { texto: "Blink Pay", url: ENLACES_FABRICA.pay },
    { texto: "Blink POS", url: ENLACES_FABRICA.pos },
  ],
};
