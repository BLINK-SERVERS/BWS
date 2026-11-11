import type { DocumentoLegal } from "../tipos";

export const WEB_006: DocumentoLegal = {
  codigo: "BWS-WEB-006",
  titulo: "Política de cookies y aviso web",
  version: "1.0",
  fecha: "2026-11-11",
  firma: "registro",
  resumen:
    "El portal usa una sola cookie esencial de sesión, no carga terceros desde el navegador y no hace seguimiento publicitario.",
  campos: ["fecha_documento", "bws_razon_social", "bws_correo", "cliente_razon_social"],
  bloques: [
    {
      tipo: "parrafo",
      texto:
        "Esta política describe el uso de cookies y almacenamiento del navegador en el portal de {{bws_razon_social}}, utilizado por {{cliente_razon_social}}. Se acepta junto con la política de privacidad BWS-PRI-005.",
    },
    { tipo: "subtitulo", texto: "1. Qué es una cookie" },
    {
      tipo: "parrafo",
      texto:
        "Una cookie es un pequeño archivo que un sitio guarda en el navegador para recordar información entre peticiones. Puede ser esencial para que el sitio funcione o tener fines de medición o publicidad.",
    },
    { tipo: "subtitulo", texto: "2. Qué usa el portal" },
    {
      tipo: "tabla",
      cabecera: ["Nombre", "Tipo", "Finalidad", "Duración"],
      anchos: [0.26, 0.16, 0.42, 0.16],
      filas: [
        [
          "__Host-bws_sesion",
          "Esencial",
          "Mantener la sesión iniciada y proteger la cuenta",
          "Hasta 8 horas o hasta cerrar sesión",
        ],
      ],
    },
    {
      tipo: "parrafo",
      texto:
        "No se usan cookies de analítica, publicidad, redes sociales ni de terceros. El portal no carga tipografías, scripts, imágenes ni píxeles desde dominios ajenos: todo se sirve desde su propio origen. Los proveedores de datos y correo trabajan en el servidor, no en el navegador.",
    },
    { tipo: "subtitulo", texto: "3. Almacenamiento técnico" },
    {
      tipo: "parrafo",
      texto:
        "Además de la cookie de sesión, el navegador puede guardar de forma temporal el estado de un formulario para no perder lo escrito si la conexión falla. Ese almacenamiento no se usa para identificar al usuario ni se comparte con terceros.",
    },
    { tipo: "subtitulo", texto: "4. Consentimiento" },
    {
      tipo: "parrafo",
      texto:
        "La cookie de sesión es necesaria para prestar el servicio y no requiere consentimiento adicional. Si en el futuro se incorpora una cookie no esencial, se pedirá consentimiento previo, informado y revocable antes de activarla, y esta política se actualizará.",
    },
    { tipo: "subtitulo", texto: "5. Cómo administrarlas" },
    {
      tipo: "parrafo",
      texto:
        "El usuario puede borrar o bloquear las cookies desde la configuración de su navegador. Si bloquea la cookie de sesión, no podrá iniciar sesión ni firmar documentos. El portal no ofrece un panel de preferencias de cookies porque no hay cookies opcionales que configurar.",
    },
    { tipo: "subtitulo", texto: "6. Cambios y contacto" },
    {
      tipo: "parrafo",
      texto:
        "Los cambios sustanciales se avisan por correo y se publican con nueva versión. Las dudas se atienden en {{bws_correo}}.",
    },
  ],
};
