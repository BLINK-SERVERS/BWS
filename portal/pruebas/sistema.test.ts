import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const fuente = (ruta: string) => fileURLToPath(new URL(`../../${ruta}`, import.meta.url));
const copia = (ruta: string) => fileURLToPath(new URL(`../sistema/${ruta}`, import.meta.url));

test("la copia del sistema visual no se desvió de la landing", () => {
  assert.equal(
    readFileSync(copia("tokens.css"), "utf8"),
    readFileSync(fuente("src/styles/tokens.css"), "utf8"),
  );

  const fonts = readFileSync(fuente("src/styles/fonts.css"), "utf8")
    .split("../assets/fonts/")
    .join("./fuentes/");
  assert.equal(readFileSync(copia("fonts.css"), "utf8"), fonts);

  for (const nombre of ["sf-pro-latin.woff2", "inter-latin.woff2"]) {
    assert.ok(
      readFileSync(copia(`fuentes/${nombre}`)).equals(
        readFileSync(fuente(`src/assets/fonts/${nombre}`)),
      ),
      `${nombre} cambió en la landing: ejecuta npm run sistema`,
    );
  }
});
