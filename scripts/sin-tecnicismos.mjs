/* ============================================================
   sin-tecnicismos.mjs — el grep de la regla de oro de BWS
   ------------------------------------------------------------
   El cliente no ve tecnología: ve una idea y un precio. Los nombres de
   las herramientas (Supabase, GitHub, Cloudflare, Zoho, nic.ve) y las
   palabras técnicas (hosting, servidor, base de datos, API, DNS…) solo
   pueden aparecer en dos lugares: como `aria-label` de la banda de
   aliados y en los comentarios del código que explican por qué.

   Por eso este script quita los comentarios antes de buscar: el plan
   pedía «el grep de tecnicismos vacío», y sin este paso el propio
   comentario que enuncia la regla aparecía como infracción.

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
  texto.split("\n").forEach((linea, n) => {
    for (const patron of PROHIBIDAS) {
      if (patron.test(linea)) {
        hallazgos.push(`${ruta}:${n + 1}  ${patron}  ·  ${linea.trim().slice(0, 96)}`);
        break;
      }
    }
  });
}

if (hallazgos.length) {
  console.error(`✗ ${hallazgos.length} apariciones de tecnicismos visibles:\n`);
  hallazgos.forEach((h) => console.error("  " + h));
  process.exit(1);
}
console.log(`✓ sin tecnicismos en ${archivos().length} archivos de cara al cliente`);
