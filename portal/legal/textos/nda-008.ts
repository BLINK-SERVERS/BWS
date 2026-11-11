import type { DocumentoLegal } from "../tipos";

export const NDA_008: DocumentoLegal = {
  codigo: "BWS-NDA-008",
  titulo: "Acuerdo de confidencialidad mutuo",
  version: "1.0",
  fecha: "2026-11-11",
  firma: "nda",
  resumen:
    "Protege la información reservada que las partes comparten antes y durante el proyecto. Se firma antes de intercambiar información sensible.",
  campos: [
    "fecha_documento",
    "bws_razon_social",
    "bws_rif",
    "bws_domicilio",
    "bws_correo",
    "representante_nombre",
    "representante_documento",
    "cliente_razon_social",
    "cliente_documento_tipo",
    "cliente_documento_numero",
    "cliente_domicilio",
    "cliente_correo",
  ],
  bloques: [
    {
      tipo: "parrafo",
      texto:
        "Entre {{bws_razon_social}}, RIF {{bws_rif}}, domicilio {{bws_domicilio}}, representada por {{representante_nombre}}, documento {{representante_documento}} (en adelante, «Blink»), y {{cliente_razon_social}}, documento {{cliente_documento_tipo}} {{cliente_documento_numero}}, domicilio {{cliente_domicilio}} (en adelante, «el Cliente»), se celebra este acuerdo de confidencialidad mutuo, aplicable antes y durante la ejecución del proyecto.",
    },
    { tipo: "subtitulo", texto: "1. Información confidencial" },
    {
      tipo: "parrafo",
      texto:
        "Es confidencial toda información que una parte entregue a la otra y que, por su naturaleza o por las circunstancias, no sea pública: ideas, alcance, código, arquitectura, diseños, precios, clientes, datos personales, credenciales, planes comerciales y cualquier material marcado como reservado. La información puede ser oral, escrita, electrónica o visual.",
    },
    { tipo: "subtitulo", texto: "2. Excepciones" },
    {
      tipo: "parrafo",
      texto:
        "No es confidencial la información que: (a) sea o llegue a ser pública sin incumplimiento de este acuerdo; (b) la parte receptora ya conocía lícitamente antes de recibirla; (c) la reciba de un tercero sin deber de confidencialidad; o (d) haya sido desarrollada de forma independiente sin usar la información recibida. La carga de demostrar una excepción corresponde a quien la invoca.",
    },
    { tipo: "subtitulo", texto: "3. Obligaciones" },
    {
      tipo: "lista",
      items: [
        "Usar la información confidencial solo para evaluar o ejecutar el proyecto.",
        "No divulgarla a terceros sin autorización escrita.",
        "Restringir el acceso a empleados y proveedores que la necesiten, y exigirles obligaciones equivalentes.",
        "Protegerla con medidas razonables, al menos iguales a las que usa para su propia información reservada.",
        "Avisar de inmediato a la otra parte si conoce un acceso o uso no autorizado.",
      ],
    },
    { tipo: "subtitulo", texto: "4. Divulgaciones permitidas" },
    {
      tipo: "parrafo",
      texto:
        "La parte que esté obligada por ley, orden judicial o autoridad competente a divulgar información lo comunicará a la otra antes de hacerlo, cuando sea posible, y limitará la divulgación a lo estrictamente exigido. La divulgación obligatoria no convierte la información en pública para los demás efectos.",
    },
    { tipo: "subtitulo", texto: "5. Plazo" },
    {
      tipo: "parrafo",
      texto:
        "Las obligaciones duran durante la relación y cinco (5) años después de su terminación. Para datos personales y secretos comerciales, el deber se mantiene mientras la información conserve ese carácter. La terminación del proyecto no extingue la confidencialidad.",
    },
    { tipo: "subtitulo", texto: "6. Devolución o destrucción" },
    {
      tipo: "parrafo",
      texto:
        "Al terminar la relación o cuando se solicite por escrito, la parte receptora devuelve o destruye la información confidencial, salvo la que deba conservar por obligación legal o para acreditar el cumplimiento. La conservación autorizada sigue sujeta a este acuerdo. La información personal se trata conforme a BWS-PRI-005.",
    },
    { tipo: "subtitulo", texto: "7. Sin licencia ni garantía" },
    {
      tipo: "parrafo",
      texto:
        "Este acuerdo no transfiere ni licencia derechos de propiedad intelectual. La información se entrega «tal cual», sin garantía de exactitud ni de aptitud para un fin, y su recepción no obliga a celebrar ningún contrato. Las ideas y el know-how previos de cada parte siguen siendo suyos.",
    },
    { tipo: "subtitulo", texto: "8. Remedios" },
    {
      tipo: "parrafo",
      texto:
        "El incumplimiento puede causar un daño difícil de reparar solo con dinero. La parte afectada puede pedir medidas cautelares, además de la indemnización de los daños demostrables, sin renunciar a otros remedios. La buena fe no convierte en lícita una divulgación prohibida.",
    },
    { tipo: "subtitulo", texto: "9. Ley y firma" },
    {
      tipo: "parrafo",
      texto:
        "Este acuerdo se rige por las leyes de la República Bolivariana de Venezuela y las controversias se someten a los tribunales competentes de la ciudad de Caracas. Se firma con firma electrónica simple con evidencia reforzada, no certificada, según BWS-LEG-002; cualquiera de las partes puede pedir firma en papel o certificada antes de compartir información especialmente sensible. Las notificaciones se envían a {{cliente_correo}} y a {{bws_correo}}.",
    },
  ],
};
