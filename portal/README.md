# Portal de clientes de Blink Web Services

Aplicación independiente de la landing. Aquí el cliente se registra, firma
sus documentos, describe su proyecto, elige plan, revisa y firma el
expediente; la administración lo genera, lo verifica, lo descarga y lo
envía. Se publica en Vercel (`portal.blink.com.ve`) contra una base Neon
propia (`bws-contratos`), nunca la de Pay ni la de POS.

La landing de `bws.blink.com.ve` no cambia una línea: este directorio tiene
su propio `package.json`, `vite.config.ts`, `vercel.json`, `src/` y `api/`.

## Reglas que mandan el diseño

- **Nada de lo que se imprime promete lo que no se puede probar.** La firma
  es «electrónica simple, no certificada, con evidencia reforzada». El
  registro es «no modificable dentro del sistema, con alteración
  detectable». Los PDF son PDF 1.7 con sello SHA-256, no PDF/A.
  `npm run afirmaciones` falla si un texto usa esas frases sin negar o sin
  calificar.
- **El código y la arquitectura son de Blink.** El cliente recibe una
  licencia de uso no exclusiva; comprar el código se negocia aparte. La mora
  suspende servicio y licencia, no le quita al cliente sus datos ni su
  dominio.
- **El navegador habla solo con su propio origen.** Las claves de la base y
  del correo viven en el servidor; no hay peticiones a terceros desde la
  página.
- **Los textos legales se usan tal cual**, sin revisión de abogado previa.
  El riesgo aceptado y la lista de puntos a confirmar están en
  [`../docs/legal/revision.md`](../docs/legal/revision.md).

## Rutas

Hash, para no depender de reescrituras en el host:

| ruta | quién | qué |
|---|---|---|
| `#/` | todos | entrada |
| `#/registro` | cliente | cuenta, ficha fiscal, cinco documentos y firma |
| `#/verificar` | cliente | código de correo |
| `#/ingreso` | todos | sesión |
| `#/recuperar` | cliente | enlace de un solo uso |
| `#/panel` | cliente | estado, suscripción, documentos, proyecto |
| `#/proyecto` | cliente | borrador, plan y envío |
| `#/admin` | administración | resumen, firma del representante, expediente |

## Comandos

```
npm install
npm run dev            # 5177, solo interfaz; la API necesita `npm run portal`
npm run typecheck
npm run sistema        # copia tokens y fuentes de la landing a sistema/
npm run sistema:verificar
npm run build          # dist/
npm run portal         # dist + api en 127.0.0.1:4178 contra la rama de pruebas
npm run portal:pruebas # build + flujo completo en Chromium, axe y desborde
npm run pruebas        # unitarias: validadores, canónica, scrypt, tokens, PNG y suscripción
npm run api:pruebas    # API de punta a punta contra la rama de pruebas
npm run db:pruebas     # RLS, solo agregar, cadena, doble firma y pagos
npm run db:migrar      # aplica db/migrations como dueño
npm run db:plantillas  # publica las plantillas legales
npm run admin:alta     # crea/actualiza la cuenta de administración
npm run pdf            # los ocho PDF de muestra en tmp/pdf/
npm run pdf:verificar  # dos pasadas idénticas y fuentes incrustadas
npm run afirmaciones   # revisa los textos legales
```

`npm run portal` ejecuta las funciones de `api/` con el mismo contrato que
Vercel (`Request` → `Response`) y aplica las cabeceras de `vercel.json`. Se
niega a arrancar si `DATABASE_URL_PRUEBAS_APP` comparte host con
`DATABASE_URL`. Con `PORTAL_DB=main` usa la base principal, y eso solo se
hace a mano.

`npm run admin:alta` no escribe sin `--confirmar`
(`npm run admin:alta -- --confirmar`). Toma `ADMIN_CORREO`, `ADMIN_CLAVE` y
opcionalmente `ADMIN_NOMBRE` del entorno o de `.env.local`; rechaza promover
un correo que ya exista como cliente y nunca imprime la clave ni su hash.
No hay registro público de administradores.

## Variables de entorno

Solo nombres; los valores viven en `.env.local` (ignorado) o en Vercel.

| nombre | para qué |
|---|---|
| `DATABASE_URL` | conexión de dueño a la base principal |
| `DATABASE_URL_APP` | rol `bws_app` (sujeto a RLS) en la principal |
| `DATABASE_URL_PRUEBAS` | dueño en la rama `pruebas` |
| `DATABASE_URL_PRUEBAS_APP` | `bws_app` en la rama `pruebas` |
| `APP_ORIGEN` | origen exacto para el enlace de correo |
| `ENTORNO` | `local` o `produccion` |
| `CORREO_MODO` | `archivo`, `resend` o `smtp` |
| `CORREO_API_KEY` | clave de Resend |
| `CORREO_DESDE` | remitente verificado |
| `CORREO_COPIA` | copia a Blink de cada envío |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` | SMTP si no se usa Resend |
| `ADMIN_CORREO`, `ADMIN_CLAVE` | alta inicial de administración |

`CORREO_MODO=archivo` escribe los mensajes en `tmp/correo-portal/` y la API
se niega a usarlo con `ENTORNO=produccion`.

## Arquitectura

- **Interfaz:** React 19 + Vite 8 + TypeScript estricto. El sistema visual
  vive en `sistema/`, una copia de `../src/styles` que mantiene
  `npm run sistema`; Vercel solo sube esta carpeta y no puede leer fuera de
  ella. Una prueba unitaria falla si la copia se desvía, así que la landing
  sigue siendo la fuente única. Los PDF usan Liberation Serif/Sans/Mono
  vendorizadas en `render/fuentes/` (SIL OFL 1.1): SF Pro es de Apple y no
  se incrusta en documentos entregados.
- **API:** funciones en `api/`, una por ruta, con el envoltorio
  `_lib/manejador.ts`. Conexión con `@neondatabase/serverless` sobre HTTP;
  cada operación abre una transacción que fija `app.usuario_id` y
  `app.rol` para que RLS decida. No hay transacciones interactivas.
- **Base:** esquema en `db/migrations` (0001–0011). Triggers abortan
  `UPDATE`/`DELETE` en firmas, actos, documentos, envíos, eventos,
  representantes y pagos; el alcance se congela al enviar; una suscripción
  admite un solo pago efectivo por periodo y un cobro equivocado se anula
  con una fila nueva que conserva el original.
- **Textos:** `legal/textos/*.ts` declaran los ocho documentos y sus
  variables; `legal/validar.ts` comprueba que ninguna quede sin resolver.
  El sello se calcula sobre un JSON canónico (`legal/canonica.ts`), nunca
  sobre los bytes del PDF, y los documentos se encadenan con
  `sha256(hash_anterior || sello || orden)` desde `GENESIS`
  (`render/hash.ts`).
- **Sesión:** token aleatorio de 32 bytes, guardado como hash SHA-256, doce
  horas, cookie `__Host-` fuera de local. El correo de verificación y el de
  recuperación son de un solo uso y se guardan como hash. El alta exige
  confirmar el correo antes de enviar un proyecto.
- **Pagos:** el periodo se cobra en USD como referencia y se paga en
  bolívares a tasa BCV. La mora sigue el contrato: gracia, luego diez días
  de mora (suspensión de servicio y licencia) y treinta para la terminación.
  Reactivar devuelve la licencia a `activa`, avisa si el vencimiento sigue
  vencido y deja el estado anterior en `eventos`.

## Seguridad

`vercel.json` aplica CSP sin contenido en línea (`script-src 'self'`,
`style-src 'self'`), `frame-ancestors 'none'`, HSTS de dos años, `nosniff`,
`X-Frame-Options: DENY`, `Referrer-Policy: same-origin`, `Permissions-Policy`
sin cámara ni micrófono, y `Cache-Control: no-store` en la API. El servidor
local lee el mismo archivo, de modo que `npm run portal:pruebas` comprueba
las cabeceras reales. Por eso el lienzo de firma no usa `style` en línea:
su alto está en `estilos/portal.css`.

Riesgos y deberes operativos —procesadores, países, retención, respaldo,
SPF/DKIM/DMARC, respuesta a incidentes— están en
[`../docs/legal/operacion.md`](../docs/legal/operacion.md). El costo, el
margen y el suelo de cada plan viven en
[`../docs/legal/economia.md`](../docs/legal/economia.md), que es interno y
no se entrega al cliente.

## Pruebas

- `npm run pruebas`: unitarias de validadores, canónica, hashing de claves,
  tokens, PNG de firma y cálculo de mora.
- `npm run db:pruebas`: contra la rama `pruebas`; reejecuta las migraciones
  sin efecto y comprueba aislamiento entre clientes.
- `npm run api:pruebas`: registro, sesión, firma única, proyecto, anexo B,
  expediente, doble firma, cadena, descargas, envío idempotente, pagos,
  mora, suspensión, terminación y reactivación.
- `npm run portal:pruebas`: flujo completo en Chromium, axe sin violaciones,
  cero desborde en 390 y 1440, cero peticiones a terceros y cero errores de
  consola, bajo la CSP real.

Las pruebas usan la rama `pruebas`, nunca la principal, y abortan si las dos
cadenas comparten host.

## Publicar

El proyecto de Vercel apunta a esta carpeta, construye `dist/` y publica
`api/` como funciones en la región `cle1`. Antes del primer arranque hay que
aplicar las migraciones como dueño, publicar las plantillas, crear la cuenta
de administración y cargar las variables de entorno en Vercel. `vercel.json`
ya trae las cabeceras y la región; no se configura a mano en el panel.
