# Operación del portal

**Estado:** documento interno. No se entrega al cliente ni se firma.

Este texto describe cómo se opera `portal.blink.com.ve` con lo que el
software hace hoy. Cuando una tarea es manual, se dice; cuando algo todavía
no existe, se anota como pendiente en la última sección. No promete
disponibilidad ni recuperación garantizada: describe medidas y sus límites.

## 1. Alcance y roles

- El portal es una aplicación multi-tenant: todos los clientes comparten la
  base `bws-contratos` en Neon (PostgreSQL 18, región `aws-us-east-2`) y se
  aíslan por fila con RLS (`app.usuario_id` y `app.rol`).
- La interfaz y las funciones corren en Vercel; la región configurada para
  las funciones es `cle1`, cercana a la base.
- Dos roles: `cliente` (ve solo sus filas) y `admin` (expedientes, pagos,
  licencias y plantillas). El rol se comprueba en cada función, no solo en
  RLS.
- No hay registro público de administradores. La cuenta se crea a mano con
  `npm run admin:alta`, que lee `ADMIN_CORREO` y `ADMIN_CLAVE` del entorno o
  de `portal/.env.local`, exige la misma política de clave que el registro y
  rechaza promover una cuenta de cliente.

## 2. Qué se guarda y dónde

| Dato | Tabla | Nota |
|---|---|---|
| Cuenta | `usuarios` | Correo, nombre y hash `scrypt`; nunca la clave. |
| Sesión | `sesiones` | Token de 32 bytes al azar, guardado como SHA-256; dura 12 horas y se revoca al salir. |
| Tokens de correo | `tokens_correo` | Solo el hash; de un solo uso. |
| Ficha fiscal | `clientes` | Razón social, documento, domicilio, teléfono y correo de factura. |
| Proyecto | `proyectos` | Alcance congelado al enviar; no se edita después. |
| Firma del cliente | `firmas_cliente` | PNG, SHA-256, fecha UTC, IP, agente y hash del texto consentido. Una sola firma. |
| Firma del representante | `representantes` | PNG, SHA-256 y domicilio; se captura en la administración. |
| Actos y documentos | `actos_firma`, `documentos` | Dos firmas por documento, PDF, sello de contenido y cadena. |
| Envíos | `envios` | Clave de idempotencia, proveedor, mensaje e instante. |
| Dinero | `suscripciones`, `pagos`, `licencias` | Monto, moneda, tasa BCV, referencia y estado. No hay datos de tarjeta. |
| Auditoría | `eventos` | Actor, rol, acción, entidad, detalle, IP y agente. |

Los PDF viven en la base, no en un almacén aparte: un respaldo de la base
incluye el expediente completo. El correo en modo `archivo` solo se usa en
desarrollo y escribe en `portal/tmp/`, que no se versiona.

## 3. Encargados y países

| Tercero | Para qué | Dónde |
|---|---|---|
| Neon | Base de datos y respaldos | AWS `us-east-2`, Estados Unidos |
| Vercel | Interfaz, funciones y TLS | Estados Unidos (región `cle1`) |
| Proveedor de correo (Resend o SMTP) | Envío del expediente | Según el proveedor contratado |
| NIC.ve | Registro del dominio del cliente | Venezuela |

Los tres primeros tratan datos por cuenta de Blink y deben quedar cubiertos
por el encargo de tratamiento del anexo E. Cambiar de proveedor o de país se
avisa antes y se documenta en el anexo E. El dominio no es un encargado de
datos, pero se opera como tercero y queda a nombre del cliente.

No hay analítica, publicidad ni scripts de terceros en el portal. La CSP
permite conectarse solo al propio origen, así que una etiqueta externa
tampoco funcionaría sin cambiar la configuración a propósito.

## 4. Correo saliente

- `CORREO_MODO` acepta `resend`, `smtp` o `archivo`. El modo `archivo` está
  prohibido cuando `ENTORNO=produccion`; el código lo rechaza.
- El remitente sale de `CORREO_DESDE` y la copia interna de `CORREO_COPIA`
  (`business@blink.com.ve` por defecto).
- El expediente se envía una sola vez. La clave de idempotencia se deriva del
  proyecto, el código, la versión y el hash del archivo; un reintento responde
  que ya salió y no genera un segundo correo.

Antes de considerar el correo operativo en producción:

1. Publicar en el DNS de `blink.com.ve` el `SPF` con el `include` del
   proveedor, la clave `DKIM` con el selector que entregue el proveedor y un
   `DMARC` con `rua` para recibir reportes. Empezar con `p=quarantine` y pasar
   a `p=reject` cuando los reportes estén limpios.
2. Comprobar con `dig TXT` que no haya dos registros `SPF` y que el `DKIM`
   resuelva por el selector correcto.
3. Enviar un expediente de prueba a una cuenta de Gmail y revisar
   «Original»: `spf=pass`, `dkim=pass`, `dmarc=pass`. Revisar también que no
   caiga en spam.
4. Repetir la prueba después de cambiar de proveedor o de rotar la clave.

Los valores de las claves no se guardan en el repositorio ni se imprimen; se
cargan en el panel del proveedor y en Vercel.

## 5. Retención

| Dato | Plazo | Qué pasa después |
|---|---|---|
| Cuenta y proyecto | Mientras el servicio esté activo y 90 días tras la terminación | Se elimina o anonimiza con aviso, salvo obligación legal |
| Firma, actos, documentos y eventos | Mientras subsista la relación y hasta 10 años después de la última firma | Se conservan como evidencia; un plazo legal mayor manda |
| Datos de facturación | Plazos fiscales aplicables | Se conservan para la contabilidad |
| Sesiones | 12 horas | Se revocan al salir; las vencidas se pueden purgar |
| Tokens de correo | Un solo uso | Quedan como registro de hash; se pueden purgar |

El impago no borra datos: suspende el servicio y la licencia. Si el cliente
pide eliminar un expediente firmado, se conserva la evidencia y se anota la
rectificación; no se borra el acto de firma. La purga por vencimiento de
plazos es manual: no hay un trabajo automático que la ejecute.

## 6. Respaldos y restauración

- Neon guarda historial y permite restaurar a un instante dentro de la
  ventana del plan. A la fecha de este documento el proyecto tiene una
  ventana corta; antes de abrir al público debe ampliarse o programarse
  instantáneas periódicas. La ventana actual no cubre un fin de semana.
- La aplicación de Vercel no guarda estado propio: se reconstruye desde
  `main`. Las variables de entorno se cargan en el panel, no en el repo.
- Restaurar nunca se hace sobre `main` a ciegas. Se toma una instantánea,
  se restaura en una rama aparte, se corren `npm run db:pruebas` y
  `npm run api:pruebas` contra esa rama y se verifica un expediente firmado
  (hash de archivo, sello y cadena). Solo entonces se decide el corte.
- Un PDF alterado no coincide con el hash guardado. Si la base se restaura,
  la verificación vuelve a coincidir; si el archivo se reemplaza a mano, no.
  La restauración no «repara» una alteración: la deja en evidencia.

## 7. Operación diaria

1. **Expediente.** La administración captura la firma y el domicilio del
   representante, genera, verifica, descarga y envía. Generar dos veces
   reutiliza lo guardado; el cliente confirma una sola vez.
2. **Pagos.** Se registra periodo, monto, moneda, tasa BCV y referencia. Un
   periodo admite un solo pago efectivo; un cobro equivocado se anula con una
   fila nueva y su motivo, nunca editando. La anulación reabre el periodo.
3. **Mora.** Se recalcula desde el panel. Los plazos son los del contrato:
   gracia de cinco días, `mora` después, `suspendida` a los diez días de mora
   y `terminada` a los treinta. La suspensión bloquea la generación y el
   envío y deja la licencia suspendida; los datos y el dominio siguen siendo
   del cliente. La terminación no se reactiva; el pago y la reactivación la
   rechazan. El recálculo es manual: conviene revisarlo al menos una vez al
   día y después de cada vencimiento.
4. **Descargas.** Cada descarga exige sesión, deja un evento con actor, IP y
   agente, y sirve el archivo como adjunto con su SHA-256 en la cabecera.
5. **Correo.** Si un envío falla, el error queda en la respuesta y en el
   evento; el expediente no se marca como enviado hasta que el proveedor
   acepta el mensaje.

## 8. Respuesta a incidentes

**Quién:** el dueño de Blink dirige; la administración ejecuta. Se usa una
sola cuenta de administración por persona, nunca compartida.

**Detectar.** Logs de Neon y Vercel, correos rebotados, reporte del cliente o
una verificación que deja de coincidir. Anotar hora UTC, qué se vio y cómo.

**Contener.**

- Revocar sesiones: `update sesiones set revocada = true` para la cuenta o
  para todas si hay duda.
- Bloquear la cuenta (`usuarios.bloqueado`) o cambiar su clave.
- Rotar credenciales en el proveedor: contraseña de la base, clave del API de
  correo o SMTP, y la clave del administrador. Actualizar Vercel y
  `portal/.env.local` sin imprimir valores.
- No borrar filas para «limpiar»: las tablas de evidencia son de solo
  agregar y un borrado destruye la prueba.

**Preservar.** Tomar una instantánea o rama de la base antes de tocar nada y
exportar los `eventos` del periodo. Guardar el mensaje de correo afectado con
sus cabeceras si el incidente es de entrega.

**Evaluar.** Determinar qué datos pudieron quedar expuestos (fila, cliente,
expediente), si hubo acceso a otra cuenta, si un PDF se alteró y si el correo
salió a un destinatario equivocado.

**Avisar.** Informar a los clientes afectados sin demora indebida, con los
hechos conocidos, los datos comprometidos y las medidas tomadas. No se afirma
que no hubo acceso si no se puede demostrar.

**Recuperar.** Corregir la causa, volver a probar y, si hizo falta restaurar,
verificar la cadena de los expedientes afectados. Documentar la causa y la
medida en una nota interna sin datos personales.

**Cerrar.** Revisar si el incidente revela una falla de diseño, añadir la
prueba que la detecte y registrar la lección.

## 9. Accesos y secretos

- El rol `bws_app` escribe filas, no crea objetos, no es superusuario y no
  toca las tablas de solo agregar. Las migraciones se aplican como dueño.
- Ninguna variable se commitea. En local viven en `portal/.env.local`
  (ignorado); en producción, en el panel de Vercel.
- `SESION_SECRETO` no se usa: el token de sesión es aleatorio y la base
  guarda su hash. Si aparece en una lista de variables, es un residuo y se
  puede omitir.
- Rotar credenciales al menos una vez al año y siempre que haya sospecha,
  cambio de proveedor o salida de una persona con acceso.

## 10. Publicación

La publicación no se hace desde este repositorio sin autorización expresa.
El orden es:

1. `npm run typecheck`, `npm run build`, `npm run pruebas`,
   `npm run afirmaciones`, `npm run pdf:verificar`.
2. `npm run db:pruebas` y `npm run api:pruebas` contra la rama `pruebas`.
3. `npm run portal:pruebas` (Chromium, axe, desborde, CSP).
4. Migraciones como dueño sobre `main`, una sola vez y revisadas.
5. Desplegar en Vercel y comprobar en el dominio: HTTPS, HSTS, CSP,
   `frame-ancestors 'none'`, correo real y un expediente de prueba de punta a
   punta.

## 11. Pendientes operativos

- Ampliar la ventana de restauración de Neon o programar instantáneas con
  retención suficiente.
- Publicar `SPF`, `DKIM` y `DMARC` en `blink.com.ve` y probar la entrega.
- Automatizar el recálculo de mora (hoy es manual).
- Automatizar la purga por vencimiento de plazos de retención.
- Revisión jurídica de los ocho textos (`docs/legal/revision.md`).
