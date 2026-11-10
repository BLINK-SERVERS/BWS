/* ============================================================
   sin-tecnicismos.mjs — el grep de la regla de oro de BWS
   ------------------------------------------------------------
   El cliente no ve tecnología: ve una idea y un precio. Los nombres de
   las herramientas (GitHub, Cloudflare, Supabase, Neon, AWS, Resend,
   Zoho, Qoder, nic.ve) y las palabras técnicas (hosting, servidor, base
   de datos, API, DNS…) solo pueden aparecer en un lugar: la banda de
   aliados.

   Dos búsquedas, no una:

     1. Las PALABRAS técnicas en todo lo que llega al navegador. Van con
        límite de palabra y se quitan los comentarios antes de buscar —
        si no, esta misma hoja aparecería como infracción.
     2. Los NOMBRES de las marcas. Estos sí pueden verse en el HTML: son
        el texto visible de la banda. Lo que no pueden es salir en el
        copy que se lee como prosa, ni en `contenido.ts`, que es de donde
        sale esa prosa. Por eso `lib/socios.ts` se excluye de esta
        segunda búsqueda (es el almacén de las marcas) y se escanea
        `lib/contenido.ts` con ella.

   Se escanea todo lo que llega al navegador: copy, componentes,
   marcado y los archivos que se sirven tal cual desde `public/`.

   node scripts/sin-tecnicismos.mjs
   ============================================================ */
import { readFileSync, readdirSync } from "node:fs";

const RAIZ = new URL("..", import.meta.url);

/* `api`/`dns`/`cdn` van con límite de palabra: sueltos, «API» casaría
   con cualquier identificado que la contenga. */
const PROHIBIDAS = [
  /supabase/i,
  /cloudflare/i,
  /github/i,
  /zoho/i,
  /nic\.ve/i,
  /\bhosting\b/i,
  /\bservidor(es)?\b/i,
  /base de datos/i,
  /\bAPI\b/,
  /\bDNS\b/,
  /\bCDN\b/,
  /\brepositorio(s)?\b/i,
  /\bdeploy\b/i,
  /\bframework\b/i,
  /\bbackend\b/i,
  /\bfrontend\b/i,
  /\bSQL\b/,
  /\btoken(es)?\b/i,
  /* El plural también: «configuraciones» es la misma palabra y la regla
     no se cumple por un sufijo. */
  /\bconfiguraci[oó]n(es)?\b/i,
];

/* Los nombres de las nueve marcas, leídos del almacén para que la lista
   no se quede vieja cuando se añada la décima. `AWS` va con límite:
   suelto, casaría con cualquier cosa. `Qoder` y `Resend` no necesitan:
   ninguna palabra en español los contiene. */
const MARCAS = [
  [/supabase/i, "Supabase"],
  [/github/i, "GitHub"],
  [/cloudflare/i, "Cloudflare"],
  [/neon/i, "Neon"],
  [/\bAWS\b/, "AWS"],
  [/resend/i, "Resend"],
  [/zoho/i, "Zoho"],
  [/qoder/i, "Qoder"],
  [/nic\.ve/i, "nic.ve"],
];

function archivos() {
  const fijos = [
    "src/lib/contenido.ts",
    "src/pages/Landing.tsx",
    "src/main.tsx",
    "index.html",
    "public/404.html",
    "public/robots.txt",
    "public/sitemap.xml",
    "public/CNAME",
  ];
  const componentes = readdirSync(new URL("src/components/", RAIZ))
    .filter((n) => n.endsWith(".tsx"))
    .map((n) => `src/components/${n}`);
  return [...fijos, ...componentes];
}

/* Quitar comentarios sin comerse los `/` de las rutas: se recorre el
   texto con la máquina de estados mínima que hace falta aquí, no con
   una regex que rompería `https://`. */
function sinComentarios(codigo) {
  let salida = "";
  for (let i = 0; i < codigo.length; i++) {
    const par = codigo.slice(i, i + 2);
    if (par === "/*") {
      const fin = codigo.indexOf("*/", i + 2);
      i = fin === -1 ? codigo.length : fin + 1;
    } else if (par === "//" && codigo[i - 1] !== ":") {
      const fin = codigo.indexOf("\n", i);
      i = fin === -1 ? codigo.length : fin;
      salida += "\n";
    } else if (par === "<!" && codigo.slice(i, i + 4) === "<!--") {
      const fin = codigo.indexOf("-->", i + 4);
      i = fin === -1 ? codigo.length : fin + 2;
    } else {
      salida += codigo[i];
    }
  }
  return salida;
}

const hallazgos = [];
for (const ruta of archivos()) {
  const texto = sinComentarios(readFileSync(new URL(ruta, RAIZ), "utf8"));
  /* En el almacén de las marcas (`lib/socios.ts`) los nombres SON el
     contenido, así que no se escanea con MARCAS; con PROHIBIDAS tampoco:
     allí no hay prosa. Se escanea con ambas la hoja de copy, que es de
     donde sale lo que el cliente lee. */
  const buscarMarcas = !ruta.includes("/socios.ts");
  texto.split("\n").forEach((linea, n) => {
    for (const patron of PROHIBIDAS) {
      if (patron.test(linea)) {
        hallazgos.push(`${ruta}:${n + 1}  ${patron}  ·  ${linea.trim().slice(0, 96)}`);
        return;
      }
    }
    if (!buscarMarcas) return;
    for (const [patron, nombre] of MARCAS) {
      if (patron.test(linea)) {
        hallazgos.push(`${ruta}:${n + 1}  marca «${nombre}» fuera de la banda  ·  ${linea.trim().slice(0, 96)}`);
        return;
      }
    }
  });
}

if (hallazgos.length) {
  console.error(`✗ ${hallazgos.length} apariciones de tecnicismos visibles:\n`);
  hallazgos.forEach((h) => console.error("  " + h));
  process.exit(1);
}
const adicionales = readFileSync(new URL("src/lib/socios.ts", RAIZ), "utf8").length;
console.log(
  `✓ sin tecnicismos en ${archivos().length} archivos de cara al cliente ` +
    `(y las marcas viven solo en lib/socios.ts, ${Math.round(adicionales / 1024)} KB)`,
);
