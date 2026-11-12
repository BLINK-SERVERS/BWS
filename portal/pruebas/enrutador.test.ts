import { test } from "node:test";
import assert from "node:assert/strict";
import { RUTAS, rutaDe } from "../src/datos/rutas";

test("cada ruta declarada se reconoce tal cual y con barra final", () => {
  for (const ruta of RUTAS) {
    assert.equal(rutaDe(ruta), ruta);
    assert.equal(rutaDe(`${ruta}/`), ruta);
    assert.equal(rutaDe(`${ruta}//`), ruta);
  }
});

test("la raíz y lo desconocido caen en la portada", () => {
  assert.equal(rutaDe("/"), "/");
  assert.equal(rutaDe(""), "/");
  assert.equal(rutaDe("//"), "/");
  assert.equal(rutaDe("/no-existe"), "/");
  assert.equal(rutaDe("/registro/extra"), "/");
  assert.equal(rutaDe("/Panel"), "/");
});

test("no hay rutas repetidas ni fuera del dominio del portal", () => {
  assert.equal(new Set(RUTAS).size, RUTAS.length);
  for (const ruta of RUTAS) assert.match(ruta, /^\/[a-z]+$/);
});
