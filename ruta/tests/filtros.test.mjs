import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { aplicarFiltros, contarFiltros, filtrosIniciales, ordenarVehiculos } from "../src/datos/filtros.ts";
import { vehiculosDemo } from "../src/datos/vehiculos.ts";

test("filtra por marca, ciudad y precio", () => {
  const resultado = aplicarFiltros(vehiculosDemo, {
    ...filtrosIniciales,
    marca: "Kia",
    ciudad: "Maracaibo",
    precioMax: "25000",
  });
  assert.deepEqual(resultado.map((vehiculo) => vehiculo.id), ["sportage-2021"]);
});

test("la búsqueda ignora tildes y mayúsculas", () => {
  const resultado = aplicarFiltros(vehiculosDemo, { ...filtrosIniciales, consulta: "mazda" });
  assert.deepEqual(resultado.map((vehiculo) => vehiculo.id), ["cx5-2019"]);
  const acento = aplicarFiltros(vehiculosDemo, { ...filtrosIniciales, consulta: "sedan" });
  assert.ok(acento.some((vehiculo) => vehiculo.id === "corolla-2018"));
});

test("combina kilometraje, transmisión y vendedor verificado", () => {
  const resultado = aplicarFiltros(vehiculosDemo, {
    ...filtrosIniciales,
    kmMax: "60000",
    transmision: "Automática",
    verificado: true,
  });
  assert.deepEqual(resultado.map((vehiculo) => vehiculo.id), ["sportage-2021", "tucson-2023"]);
});

test("ordena por precio sin mutar el catálogo", () => {
  const original = vehiculosDemo.map((vehiculo) => vehiculo.id);
  const ordenado = ordenarVehiculos(vehiculosDemo, "precio-asc");
  assert.equal(ordenado[0].id, "spark-2014");
  assert.equal(ordenado.at(-1).id, "grand-cherokee-2020");
  assert.deepEqual(vehiculosDemo.map((vehiculo) => vehiculo.id), original);
});

test("cuenta los filtros activos sin contar la búsqueda", () => {
  assert.equal(contarFiltros(filtrosIniciales), 0);
  assert.equal(contarFiltros({ ...filtrosIniciales, consulta: "Toyota", marca: "Toyota", verificado: true }), 2);
});

test("los datos de demostración tienen identificadores únicos y fotos locales", () => {
  const ids = new Set(vehiculosDemo.map((vehiculo) => vehiculo.id));
  assert.equal(ids.size, vehiculosDemo.length);
  for (const vehiculo of vehiculosDemo) {
    assert.ok(vehiculo.precio > 0);
    assert.ok(vehiculo.fotos.length > 0);
    assert.ok(vehiculo.descripcion.length >= 30);
    for (const foto of vehiculo.fotos) {
      assert.ok(foto.alt.length > 0);
      const ruta = fileURLToPath(new URL(`../public${foto.src.replace(/^\/cars/, "")}`, import.meta.url));
      assert.ok(existsSync(ruta), `Falta ${foto.src}`);
    }
  }
});
