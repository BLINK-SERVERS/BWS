import type { DocumentoLegal } from "../tipos";

export const LIC_007: DocumentoLegal = {
  codigo: "BWS-LIC-007",
  titulo: "Licencia de uso final para los usuarios de la aplicación del cliente",
  version: "1.0",
  fecha: "2026-11-11",
  firma: "entrega",
  resumen:
    "Condiciones para las personas que usan la aplicación del cliente. El cliente opera el servicio; Blink es titular del software y tercero beneficiario.",
  campos: [
    "fecha_documento",
    "bws_razon_social",
    "bws_correo",
    "cliente_razon_social",
    "cliente_correo",
    "proyecto_nombre",
    "proyecto_dominio",
    "licencia_duracion",
    "credito_meses",
  ],
  bloques: [
    {
      tipo: "parrafo",
      texto:
        "Este acuerdo regula el uso de la aplicación «{{proyecto_nombre}}», disponible en {{proyecto_dominio}}, entre {{cliente_razon_social}} (en adelante, «el Operador»), que presta el servicio, y cada persona que lo usa (en adelante, «el Usuario»). {{bws_razon_social}} (en adelante, «Blink») es titular del software y tercero beneficiario de este acuerdo; no presta el servicio al Usuario ni responde por la relación entre el Operador y el Usuario.",
    },
    { tipo: "subtitulo", texto: "1. Licencia" },
    {
      tipo: "parrafo",
      texto:
        "El Operador otorga al Usuario una licencia personal, limitada, no exclusiva, no transferible y revocable para usar la aplicación conforme a este acuerdo y a las condiciones del servicio del Operador. La licencia dura mientras el Usuario mantenga una cuenta activa y el Operador cuente con la licencia de Blink, y en todo caso no más de {{licencia_duracion}}.",
    },
    { tipo: "subtitulo", texto: "2. Restricciones" },
    {
      tipo: "lista",
      items: [
        "No copiar, modificar, traducir, descompilar ni intentar obtener el código fuente de la aplicación, salvo en la medida en que la ley lo permita expresamente.",
        "No revender, alquilar, sublicenciar ni poner la aplicación a disposición de terceros sin autorización del Operador.",
        "No eludir medidas de seguridad, límites de uso ni controles de acceso.",
        "No usar la aplicación para actividades ilícitas, para vulnerar derechos de terceros ni para enviar comunicaciones no solicitadas.",
        "No retirar avisos de propiedad intelectual ni la mención «Powered by Blink».",
      ],
    },
    { tipo: "subtitulo", texto: "3. Cuenta y contenido del Usuario" },
    {
      tipo: "parrafo",
      texto:
        "El Usuario debe dar datos veraces, mantener la confidencialidad de sus credenciales y avisar al Operador de cualquier acceso no autorizado. El contenido que publique sigue siendo suyo; concede al Operador la autorización necesaria para alojarlo y mostrarlo dentro del servicio. El Usuario responde por la licitud de su contenido.",
    },
    { tipo: "subtitulo", texto: "4. Privacidad" },
    {
      tipo: "parrafo",
      texto:
        "El Operador es responsable de los datos personales de sus usuarios. La política de privacidad aplicable es la del Operador, disponible en {{proyecto_dominio}} o solicitándola a {{cliente_correo}}. Blink trata los datos como encargado del Operador y aplica las medidas descritas en su política BWS-PRI-005. Las dudas sobre datos del Usuario se dirigen al Operador.",
    },
    { tipo: "subtitulo", texto: "5. Actualizaciones y disponibilidad" },
    {
      tipo: "parrafo",
      texto:
        "La aplicación puede actualizarse, cambiar de interfaz o suspender funciones para mantenimiento. El Operador no garantiza disponibilidad ininterrumpida ni ausencia de errores; el servicio depende de proveedores de infraestructura y de la conexión del Usuario. Las funciones nuevas pueden estar sujetas a condiciones adicionales del Operador.",
    },
    { tipo: "subtitulo", texto: "6. Propiedad intelectual y créditos" },
    {
      tipo: "parrafo",
      texto:
        "El software, la arquitectura, el sistema de diseño y los componentes son propiedad de Blink o de sus licenciantes. La mención «Powered by Blink» se mantiene visible durante {{credito_meses}} desde la entrega, salvo renuncia escrita. El Usuario no adquiere ningún derecho sobre el software por usar la aplicación.",
    },
    { tipo: "subtitulo", texto: "7. Terminación" },
    {
      tipo: "parrafo",
      texto:
        "El Operador puede suspender o terminar la cuenta del Usuario por incumplimiento, impago de su servicio o riesgo de seguridad, con aviso cuando sea posible. El Usuario puede dejar de usar la aplicación en cualquier momento. Al terminar, la licencia finaliza; el Operador conserva los datos conforme a su política y a los plazos legales.",
    },
    { tipo: "subtitulo", texto: "8. Responsabilidad" },
    {
      tipo: "parrafo",
      texto:
        "El Operador responde frente al Usuario por el servicio que presta. Blink no es parte de esa relación y no responde por el contenido, las promesas ni las prácticas del Operador. En la medida permitida por la ley, el Operador no responde por daños indirectos, lucro cesante ni pérdida de datos derivada de causas ajenas a su control. Nada limita los derechos que la ley no permita renunciar.",
    },
    { tipo: "subtitulo", texto: "9. Ley y contacto" },
    {
      tipo: "parrafo",
      texto:
        "Este acuerdo se rige por las leyes de la República Bolivariana de Venezuela. Las controversias entre el Usuario y el Operador se someten a los tribunales competentes de la ciudad de Caracas, sin perjuicio de la jurisdicción del consumidor. Las cuestiones sobre el software se dirigen a {{bws_correo}}; las cuestiones sobre el servicio, a {{cliente_correo}}.",
    },
    {
      tipo: "aviso",
      texto:
        "Al usar la aplicación, el Usuario declara haber leído este acuerdo. Si no está de acuerdo, no debe usar el servicio.",
    },
  ],
};
