import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import despachar, { RUTAS } from "../api/[...ruta].ts";

const SERVIDOR = fileURLToPath(new URL("../server/", import.meta.url));

function rutasEnDisco(directorio: string): string[] {
  return readdirSync(directorio, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = join(directorio, entrada.name);
    if (entrada.isDirectory()) {
      return entrada.name === "_lib" ? [] : rutasEnDisco(ruta);
    }
    if (!entrada.name.endsWith(".ts")) return [];
    return [relative(SERVIDOR, ruta).replace(/\.ts$/, "").split("\\").join("/")];
  });
}

test("cada ruta de server/ está despachada y no sobra ninguna", () => {
  const enDisco = rutasEnDisco(SERVIDOR).sort();
  const despachadas = Object.keys(RUTAS).sort();
  assert.deepEqual(despachadas, enDisco);
});

test("una ruta desconocida responde 404 sin tocar la base", async () => {
  const respuesta = await despachar(new Request("https://portal.blink.com.ve/api/no/existe"));
  assert.equal(respuesta.status, 404);
  assert.deepEqual(await respuesta.json(), { error: "No existe esa ruta de la API." });
});
