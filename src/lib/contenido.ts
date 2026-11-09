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
       repositorio, framework ni deploy.
     · NO aparecen los nombres de las herramientas (viven solo en
       `lib/socios.ts`, como logos, sin una línea de explicación).
     · SI se dice «tu dirección en Internet», «tu correo con el nombre
       de tu empresa», «publicado», «andando».

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
  cinta: "Una división de Blink.",
};

export const CONTACTO = {
  /** Se marca con +1 porque la puerta de entrada es la diáspora. */
  telefono: "+1 (631) 821 1938",
  telefonoMarca: "+16318211938",
  correo: "business@blink.com.ve",
  whatsapp: "https://wa.me/16318211938",
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
  /** La bajada tiene que explicar el negocio de una, porque el titular
      solo no vende: hay que decir qué se lleva uno a cambio. */
  sub: "Nosotros nos encargamos del resto: tu página, tu dirección en Internet y tus correos.",
  ctaPrimaria: { texto: "Hablemos", ancla: "#hablemos" },
  ctaSecundaria: { texto: "Ver qué hacemos", ancla: "#que-hacemos" },
};

export const BENEFICIOS = {
  id: "resuelves",
  etiqueta: "Lo que resuelves con BWS",
  titulo: "Cuatro cosas que dejas de hacer.",
  piezas: [
    {
      titulo: "Todo el trámite, por nuestra cuenta.",
      cuerpo: "Nombres, papeles y altas. No tienes que abrir ni una cuenta.",
    },
    {
      titulo: "Publicado y andando, sin que muevas un dedo.",
      cuerpo: "El día que decimos, tu proyecto está en Internet y la gente lo puede abrir.",
    },
    {
      titulo: "Cero papeleo y cero contraseñas raras.",
      cuerpo: "Tú apruebas. Nosotros guardamos, ordenamos y respondemos por el resto.",
    },
    {
      titulo: "Atado a la misma tecnología que sostiene a Blink.",
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
      titulo: "Páginas que venden.",
      cuerpo: "Su negocio, bien presentado: claro desde el primer segundo y fácil de pedir por teléfono.",
    },
    {
      icono: "app" as const,
      titulo: "Web apps para tu operación.",
      cuerpo: "Ese cuaderno donde anotas todo, convertido en algo que se usa desde el celular y desde la computadora.",
    },
    {
      icono: "portafolio" as const,
      titulo: "Portafolios que te representan.",
      cuerpo: "Tu trabajo, ordenado y con tu nombre, listo para mandar en un solo enlace.",
    },
  ],
};

export const PROCESO = {
  id: "proceso",
  titulo: "Cómo trabajamos",
  bajada: "Tres pasos. Ninguno pide que sepas de tecnología.",
  pasos: [
    {
      titulo: "Cuéntanos la idea.",
      cuerpo: "Un audio, un correo, un boceto en una servilleta. Como te salga.",
    },
    {
      titulo: "Nosotros hacemos todo.",
      cuerpo: "Tu nombre en Internet, tu correo con el nombre de tu empresa, el diseño y la publicación.",
    },
    {
      titulo: "Está en Internet.",
      cuerpo: "Te llega el enlace y ya lo puedes compartir con quien quieras.",
    },
  ],
};

export const PROMESA = {
  id: "promesa",
  etiqueta: "La promesa",
  titulo: "Tu proyecto funcionará bajo la misma tecnología que hace funcionar a Blink.",
  apoyo: "La misma seriedad con la que movemos el pasaje de miles de personas.",
};

export const SOCIOS = {
  id: "aliados",
  titulo: "Trabajamos con los mismos de siempre.",
  /** Nota legal breve: son marcas de terceros y BWS las usa, no las
      representa. Una línea, en cuerpo de nota, sin explicar qué hace
      cada una: la banda es prueba social, no documentación. */
  nota: "Las marcas de esta fila son propiedad de cada una de ellas. BWS las usa para trabajar; no las representa.",
};

export const PREGUNTAS = {
  id: "preguntas",
  titulo: "Preguntas que nos hacen siempre.",
  piezas: [
    {
      pregunta: "¿Cuánto cuesta?",
      respuesta:
        "Depende de lo que quieras montar. Hablemos y te lo decimos claro, en una sola cifra.",
    },
    {
      pregunta: "¿Tengo que comprar algo yo?",
      respuesta:
        "Nada. El nombre, el correo y todo lo demás lo tramitamos nosotros.",
    },
    {
      pregunta: "¿Cuánto tarda?",
      respuesta:
        "Los primeros bocetos llegan en días. Lo demás se acuerda contigo, con una fecha y sin sorpresas.",
    },
    {
      pregunta: "¿Tengo que saber de tecnología?",
      respuesta:
        "No. Para eso estamos nosotros. Tú decides cómo se ve y qué hace; del resto nos ocupamos nosotros.",
    },
    {
      pregunta: "¿De quién es lo que hacen?",
      respuesta:
        "Tuyo. El contenido, los datos y las llaves van a tu nombre desde el primer día.",
    },
  ],
};

export const CIERRE = {
  id: "hablemos",
  titulo: "Hablemos.",
  bajada: "Cuéntanos qué quieres montar. Te decimos cómo, cuándo y cuánto.",
};

export const NOTAS = {
  /** La nota que el sitio necesita por no publicar tarifas: decir por
      qué no están, en una línea, sin pedir disculpas ni explicar de más. */
  piezas: [
    "No publicamos tarifas: cada proyecto se cotiza con nombres y apellidos, en una sola cifra y por escrito.",
    "Blink Web Services es una división de Blink y responde por lo que construye.",
  ],
};

export const PIE = {
  legal: `© 2026 Blink · ${CONTACTO.ciudad}`,
  nota: "Blink Web Services es una división de Blink.",
  enlaces: [
    { texto: "blink.com.ve", url: ENLACES_FABRICA.blink },
    { texto: "Blink Pay", url: ENLACES_FABRICA.pay },
    { texto: "Blink POS", url: ENLACES_FABRICA.pos },
  ],
};
