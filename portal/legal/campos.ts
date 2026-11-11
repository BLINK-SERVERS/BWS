/* ============================================================
   Contrato de variables del expediente
   ------------------------------------------------------------
   Cada clave tiene una etiqueta para la pantalla de administración
   y un ejemplo para los PDF de muestra. Ninguna se escribe en el
   repo con datos reales: el representante legal de Blink se captura
   en el panel y los datos del cliente llegan del registro.

   `vacío` no es válido. Si un dato no aplica, se usa un texto
   explícito («No aplica»), nunca una cadena vacía: un PDF con un
   hueco no se emite.
   ============================================================ */

export interface Campo {
  clave: string;
  etiqueta: string;
  ejemplo: string;
  grupo: "blink" | "cliente" | "proyecto" | "comercial" | "sistema";
}

export const CAMPOS: Campo[] = [
  { clave: "fecha_documento", etiqueta: "Fecha del documento", ejemplo: "11 de noviembre de 2026", grupo: "sistema" },

  { clave: "bws_razon_social", etiqueta: "Razón social de Blink", ejemplo: "Blink Web Services, C.A.", grupo: "blink" },
  { clave: "bws_rif", etiqueta: "RIF de Blink", ejemplo: "J-00000000-0", grupo: "blink" },
  { clave: "bws_domicilio", etiqueta: "Domicilio fiscal de Blink", ejemplo: "Caracas, Distrito Capital, Venezuela", grupo: "blink" },
  { clave: "bws_correo", etiqueta: "Correo de Blink", ejemplo: "business@blink.com.ve", grupo: "blink" },
  { clave: "bws_telefono", etiqueta: "Teléfono de Blink", ejemplo: "+1 (631) 821 1938", grupo: "blink" },
  { clave: "representante_nombre", etiqueta: "Nombre del representante legal de Blink", ejemplo: "Nombre Apellido", grupo: "blink" },
  { clave: "representante_documento", etiqueta: "Documento del representante legal", ejemplo: "V-00000000", grupo: "blink" },
  { clave: "representante_domicilio", etiqueta: "Domicilio del representante legal", ejemplo: "Caracas, Distrito Capital, Venezuela", grupo: "blink" },

  { clave: "cliente_razon_social", etiqueta: "Razón social o nombre del cliente", ejemplo: "Cliente de Prueba, C.A.", grupo: "cliente" },
  { clave: "cliente_documento_tipo", etiqueta: "Tipo de documento del cliente", ejemplo: "RIF", grupo: "cliente" },
  { clave: "cliente_documento_numero", etiqueta: "Número de documento del cliente", ejemplo: "J-12345678-9", grupo: "cliente" },
  { clave: "cliente_domicilio", etiqueta: "Domicilio fiscal del cliente", ejemplo: "Valencia, Carabobo, Venezuela", grupo: "cliente" },
  { clave: "cliente_telefono", etiqueta: "Teléfono del cliente", ejemplo: "+58 412 000 0000", grupo: "cliente" },
  { clave: "cliente_correo", etiqueta: "Correo del cliente", ejemplo: "cliente@ejemplo.com", grupo: "cliente" },
  { clave: "cliente_correo_factura", etiqueta: "Correo de facturación", ejemplo: "facturas@ejemplo.com", grupo: "cliente" },

  { clave: "proyecto_nombre", etiqueta: "Nombre del proyecto", ejemplo: "Tienda Ejemplo", grupo: "proyecto" },
  { clave: "proyecto_categoria", etiqueta: "Categoría del proyecto", ejemplo: "Comercio electrónico", grupo: "proyecto" },
  { clave: "proyecto_dominio", etiqueta: "Dominio .com.ve del proyecto", ejemplo: "tiendaejemplo.com.ve", grupo: "proyecto" },
  { clave: "proyecto_alcance", etiqueta: "Alcance cerrado del proyecto", ejemplo: "Catálogo, carrito, pagos y panel de pedidos.", grupo: "proyecto" },
  { clave: "proyecto_complejidad", etiqueta: "Complejidad declarada", ejemplo: "Media", grupo: "proyecto" },
  { clave: "plan_nombre", etiqueta: "Plan de infraestructura elegido", ejemplo: "Inicial", grupo: "proyecto" },
  { clave: "plan_precio", etiqueta: "Precio mensual del plan", ejemplo: "USD 0", grupo: "comercial" },
  { clave: "plan_fuente", etiqueta: "Fuente de los límites del plan", ejemplo: "Condiciones públicas del proveedor de alojamiento", grupo: "proyecto" },
  { clave: "plan_fecha", etiqueta: "Fecha de consulta de los límites", ejemplo: "11 de noviembre de 2026", grupo: "proyecto" },

  { clave: "dominio_costo_eur", etiqueta: "Costo anual del dominio en euros", ejemplo: "16,04 EUR", grupo: "comercial" },
  { clave: "tasa_bcv_fecha", etiqueta: "Fecha de la tasa BCV aplicada", ejemplo: "11 de noviembre de 2026", grupo: "comercial" },
  { clave: "tasa_bcv_valor", etiqueta: "Valor de la tasa BCV aplicada", ejemplo: "Bs. 00,0000 por USD", grupo: "comercial" },
  { clave: "dominio_costo_bs", etiqueta: "Costo del dominio en bolívares", ejemplo: "Bs. 000,00", grupo: "comercial" },
  { clave: "demo_plazo", etiqueta: "Plazo de la primera demo", ejemplo: "siete (7) a catorce (14) días hábiles", grupo: "comercial" },
  { clave: "tarifa_desarrollo", etiqueta: "Tarifa mensual de desarrollo", ejemplo: "USD 31", grupo: "comercial" },
  { clave: "tarifa_infra_pro", etiqueta: "Tarifa mensual del plan Pro de infraestructura", ejemplo: "USD 30", grupo: "comercial" },
  { clave: "licencia_duracion", etiqueta: "Duración de la licencia de uso", ejemplo: "la vida del servicio contratado", grupo: "comercial" },
  { clave: "credito_meses", etiqueta: "Meses de crédito «Powered by Blink»", ejemplo: "veinticuatro (24) meses", grupo: "comercial" },
  { clave: "correo_proveedor", etiqueta: "Proveedor de correo transaccional", ejemplo: "el proveedor de correo transaccional contratado por Blink", grupo: "sistema" },
];

export const CAMPO_POR_CLAVE = new Map(CAMPOS.map((c) => [c.clave, c]));

/** Variables que no son texto libre sino listas resueltas por el motor. */
export const ESTRUCTURADOS = ["buzones", "limites"] as const;
