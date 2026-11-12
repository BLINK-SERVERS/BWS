# Economía del portal

**Estado:** documento interno. No se entrega al cliente, no se firma y no se
imprime en el anexo B. Los precios y límites que ve el cliente viven en
`planes_infra` y se imprimen desde la fila elegida.

**Fecha de revisión:** 11 de noviembre de 2026. Se revisa cuando cambie un
precio de proveedor, un límite o el tipo de cambio de referencia, y al menos
una vez por trimestre.

## 1. Dos capas que no se mezclan

1. **El portal de Blink** (`bws.blink.com.ve/registro` y demás rutas del
   portal): un Worker de Cloudflare con Static Assets y un proyecto Neon
   multi-tenant. Este costo lo absorbe Blink y no se factura por cliente.
2. **La aplicación de cada cliente**: los planes de `planes_infra`
   (`supabase` y `neon-cloudflare`, dos niveles cada uno). Esto es lo que el
   cliente paga como infraestructura y lo que se imprime en el anexo B.

Tampoco se mezclan el desarrollo y la infraestructura: **USD 31/mes es
desarrollo** y **USD 30/mes es el plan Pro de infraestructura**. Son
conceptos distintos y el expediente los muestra por separado. Si el cliente
no necesita Pro, no paga los USD 30.

## 2. Precio, costo y margen por preset

Piso de Pro: **USD 30/mes**. Regla: `precio = costo del proveedor + margen`.
El costo y el margen son internos; la API y el anexo B solo exponen nombre,
precio, límites, fuente y fecha.

| Preset | Nivel | Precio | Costo estimado | Margen | Margen % |
|---|---|---:|---:|---:|---:|
| Supabase | Inicial | USD 0 | USD 0 | USD 0 | — |
| Supabase | Pro | USD 30 | USD 25 | USD 5 | 17 % |
| Neon + Cloudflare | Inicial | USD 0 | USD 0 | USD 0 | — |
| Neon + Cloudflare | Pro | USD 30 | USD 24 | USD 6 | 20 % |

Notas:

- **Supabase Pro** deja USD 5 antes de impuestos y comisiones: está por
  debajo del objetivo de 40–60 %. Se mantiene el precio de USD 30 por
  comparabilidad con el otro preset. Si el cliente exige su propia cuenta Pro
  y no se puede compartir, se sube el plan o se factura la infraestructura
  aparte.
- **Neon + Cloudflare** usa el mínimo del plan Launch de Neon (USD 19) más
  el plan Workers Paid de Cloudflare (USD 5) como costo por cliente: USD 24.
  El plan gratuito de Cloudflare no se imputa, pero limita la CPU a 10 ms por
  solicitud; por eso el preset Pro paga Workers Paid y puede sostener 30 s de
  CPU por invocación. El plan Inicial usa el plan Free: los cómputos pesados
  caben en un Durable Object con 30 s de CPU y hasta 100.000 solicitudes al
  día, suficiente para una app pequeña.
- Los dos niveles Inicial son gratuitos para el cliente y sin margen: existen
  para que una app pequeña pueda empezar. Los límites impresos son los del
  proveedor del preset, nunca los de otro.
- El margen objetivo es 40–60 %. Los dos presets están por debajo; es una
  decisión comercial aceptada para sostener el piso de USD 30. Se revisa si
  sube el costo del proveedor.

## 3. Costo de operar el portal

| Concepto | Estimado | Cómo se reparte |
|---|---:|---|
| Cloudflare Workers | USD 0 en el plan Free; USD 5/mes en Workers Paid | Cuenta compartida de Blink; el plan gratuito cubre el portal |
| Neon | USD 0 a ~USD 19/mes | Según plan; el proyecto `bws-contratos` vive en la cuenta de Blink |
| Correo transaccional | USD 0 en el plan gratuito del proveedor; luego por envío | Absorbido |
| Dominio del portal | Subdominio de `blink.com.ve` | Absorbido |
| Dominio del cliente | Cotizado en euros, a costo | Se factura aparte; no reembolsable una vez registrado |

Punto de equilibrio aproximado: con el plan mínimo de Neon y el plan Free de
Cloudflare, unos **USD 19/mes** de costo fijo. Un solo cliente Pro a USD 30
cubre ese piso antes de impuestos; con el plan gratuito de Neon el piso baja
casi a cero. No se presupuesta crecimiento de tráfico: si un cliente consume
más cómputo o almacenamiento, se sube de plan o se factura el exceso.

## 4. Costo marginal por cliente

Un expediente son ocho PDF con fuentes embebidas. La muestra de ocho
documentos pesa **624 KB**; con las dos firmas PNG, filas y eventos, cada
cliente ocupa del orden de **0,7 a 1 MB**. Sobre 1 GB de almacenamiento caben
alrededor de mil expedientes antes de otros datos, así que el costo marginal
de almacenamiento es bajo. El costo real aparece en cómputo: cada generación,
verificación y descarga despierta la base.

Medición: `select pg_total_relation_size('documentos')` en la rama que se
quiera revisar. Si el peso por cliente sube de 5 MB, se revisa el plan de
Neon antes de seguir vendiendo.

## 5. Mora, suspensión y terminación

- La suspensión **no reduce el costo fijo**: la base y el despliegue siguen
  ahí para conservar datos y dominio. Suspender no es un ahorro, es una
  medida contractual.
- La terminación libera cómputo cuando se apaga la app, pero los datos se
  conservan 90 días para la exportación. La licencia termina; el cliente
  conserva sus datos y su dominio.
- El impago no transfiere bienes: Blink conserva código, arquitectura y
  despliegue; no se entrega el código como remedio. La venta del código es un
  acuerdo aparte, con precio propio.
- Los pagos se registran como filas inmutables. Un cobro equivocado se anula
  con una fila nueva y su motivo, nunca editando la anterior. La anulación
  reabre el periodo.

## 6. Moneda, tasa y tributos

- Los precios son en USD de referencia. El pago se hace en bolívares a la
  tasa BCV del día y esa tasa queda guardada con el pago; sin ella no se
  puede reconstruir el monto.
- IVA, IGTF y retenciones se aplican según la ley vigente. Este documento no
  fija alícuotas ni inventa una tasa: se toman del comprobante y de la
  normativa del momento.
- El dominio se cotiza en euros y se cobra al costo. Se informa la fecha de
  la cotización y no se reembolsa una vez registrado.

## 7. Riesgos económicos

- **Cloudflare Free tiene 10 ms de CPU por solicitud.** El portal no cabe en
  ese límite para scrypt ni para los ocho PDF: esas rutas corren en un
  Durable Object, que en el plan Free tiene 30 s de CPU por invocación,
  100.000 solicitudes al día y 128 MB de memoria. La generación medida ronda
  los 12 s de CPU; si el expediente crece y no cabe en 30 s o en 128 MB, el
  plan Pro de Cloudflare pasa a Workers Paid.
- **Neon gratuito** tiene límites de almacenamiento y cómputo y suspende por
  inactividad. El preset `neon-cloudflare` imprime esos límites reales.
  Mezclar límites de Supabase con Neon sería una promesa falsa.
- **Cliente que exige su propio Supabase Pro**: el margen cae a USD 5. Se
  sube el plan o se factura la infraestructura como concepto aparte.
- **Tipo de cambio**: una devaluación fuerte encarece el costo en bolívares;
  se ajusta la tasa del próximo pago, no el precio en USD ya firmado.
- **Mora larga**: los 90 días de retención y la ventana de restauración
  cuestan almacenamiento sin ingreso. Se presupuesta como costo de cobranza,
  no como ahorro.

## 8. Decisiones registradas

- Mantener USD 30 como piso de Pro aunque el margen de Supabase quede en
  17 %; se prefiere un precio simple y comparable.
- No facturar el portal por cliente: su costo es de Blink y se absorbe.
- No imprimir costo ni margen en el anexo B; el cliente ve precio, límites,
  fuente y fecha.
- Revisar esta hoja cuando cambie un proveedor, un límite o el tipo de
  cambio, y dejar la fecha de la revisión.
