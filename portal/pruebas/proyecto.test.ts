/* ============================================================
   Alta del proyecto: dominio, buzones, alcance y variables
   ------------------------------------------------------------
   Sin base de datos. Lo que se comprueba aquí es lo que decide
   si un borrador puede existir: el dominio normalizado, los
   buzones con `no-reply@` obligatorio y las variables que el
   anexo A y el anexo B heredan del plan vigente.
   ============================================================ */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CATEGORIAS,
  leerProyecto,
  normalizarBuzones,
  variablesDeProyecto,
  type ProyectoVista,
} from "../server/_lib/proyecto.ts";
import { normalizarDominio } from "../legal/identidad.ts";
import type { PlanVista } from "../server/_lib/planes.ts";
import { ErrorHttp } from "../server/_lib/respuestas.ts";

const PLAN: PlanVista = {
  clave: "supabase",
  nivel: "inicial",
  version: 1,
  nombre: "Inicial",
  precio_usd: 0,
  limites: [{ concepto: "Almacenamiento de archivos", valor: "1 GB" }],
  fuente: "Condiciones públicas del plan gratuito de Supabase",
  fecha: "2026-11-11",
  fecha_larga: "11 de noviembre de 2026",
};

function datos(extra: Record<string, unknown> = {}) {
  return {
    nombre: "Estudio Ana",
    categoria: "Aplicación web",
    dominio: "estudio-ana.com.ve",
    buzones: ["no-reply@estudio-ana.com.ve", "contacto@estudio-ana.com.ve"],
    alcance:
      "Aplicación para agendar citas, cobrar anticipos y enviar recordatorios por correo a cada clienta.",
    complejidad: "media",
    plan_clave: "supabase",
    plan_nivel: "inicial",
    ...extra,
  };
}

function rechaza(fn: () => unknown, codigo: string) {
  assert.throws(fn, (error) => error instanceof ErrorHttp && error.codigo === codigo);
}

describe("dominio", () => {
  it("quita esquema, ruta, consulta y mayúsculas", () => {
    assert.equal(
      normalizarDominio("https://WWW.Estudio-Ana.com.ve/portada?x=1#arriba"),
      "www.estudio-ana.com.ve",
    );
    assert.equal(normalizarDominio("  estudio.com.ve.  "), "estudio.com.ve");
  });

  it("rechaza lo que no es un dominio", () => {
    for (const valor of ["", "localhost", "a.b", "dominio", "http://", "con espacio.com"]) {
      assert.equal(normalizarDominio(valor), null, `aceptó «${valor}»`);
    }
  });
});

describe("buzones", () => {
  it("normaliza, deduplica implícitamente y pone no-reply primero", () => {
    const lista = normalizarBuzones(
      ["Contacto@Estudio-Ana.com.ve", "", "  ", "No-Reply@estudio-ana.com.ve"],
      "estudio-ana.com.ve",
    );
    assert.deepEqual(lista, [
      "no-reply@estudio-ana.com.ve",
      "contacto@estudio-ana.com.ve",
    ]);
  });

  it("rechaza seis buzones", () => {
    rechaza(
      () =>
        normalizarBuzones(
          [
            "no-reply@estudio-ana.com.ve",
            "a@estudio-ana.com.ve",
            "b@estudio-ana.com.ve",
            "c@estudio-ana.com.ve",
            "d@estudio-ana.com.ve",
            "e@estudio-ana.com.ve",
          ],
          "estudio-ana.com.ve",
        ),
      "buzon",
    );
  });

  it("exige no-reply@ del dominio elegido", () => {
    rechaza(
      () => normalizarBuzones(["contacto@estudio-ana.com.ve"], "estudio-ana.com.ve"),
      "buzon",
    );
  });

  it("rechaza un dominio ajeno y un repetido", () => {
    rechaza(
      () =>
        normalizarBuzones(
          ["no-reply@estudio-ana.com.ve", "hola@otro-dominio.com"],
          "estudio-ana.com.ve",
        ),
      "buzon",
    );
    rechaza(
      () =>
        normalizarBuzones(
          ["no-reply@estudio-ana.com.ve", "no-reply@estudio-ana.com.ve"],
          "estudio-ana.com.ve",
        ),
      "buzon",
    );
  });
});

describe("leerProyecto", () => {
  it("acepta un proyecto completo y normaliza el dominio", () => {
    const proyecto = leerProyecto(
      datos({ dominio: "https://Estudio-Ana.com.ve/", buzones: ["no-reply@estudio-ana.com.ve"] }),
    );
    assert.equal(proyecto.dominio, "estudio-ana.com.ve");
    assert.equal(proyecto.buzones[0], "no-reply@estudio-ana.com.ve");
    assert.equal(proyecto.complejidad, "media");
    assert.equal(proyecto.nombre, "Estudio Ana");
  });

  it("rechaza nombre, categoría, alcance, complejidad y plan inválidos", () => {
    rechaza(() => leerProyecto(datos({ nombre: "ab" })), "nombre");
    rechaza(() => leerProyecto(datos({ categoria: "Videojuego" })), "categoria");
    rechaza(() => leerProyecto(datos({ alcance: "corto" })), "alcance");
    rechaza(() => leerProyecto(datos({ alcance: "x".repeat(6001) })), "alcance");
    rechaza(() => leerProyecto(datos({ complejidad: "extrema" })), "complejidad");
    rechaza(() => leerProyecto(datos({ plan_clave: "" })), "plan");
    rechaza(() => leerProyecto(datos({ plan_nivel: "" })), "plan");
    rechaza(() => leerProyecto(null), "proyecto");
    rechaza(() => leerProyecto([]), "proyecto");
  });

  it("no acepta una categoría fuera de la lista", () => {
    assert.deepEqual(CATEGORIAS.includes("Aplicación web"), true);
    assert.equal(CATEGORIAS.length, 5);
  });
});

describe("variables del anexo A y B", () => {
  it("salen del proyecto y del plan, no de constantes de la vista", () => {
    const proyecto: ProyectoVista = {
      id: "11111111-1111-4111-8111-111111111111",
      nombre: "Estudio Ana",
      categoria: "Aplicación web",
      dominio: "estudio-ana.com.ve",
      buzones: ["no-reply@estudio-ana.com.ve"],
      alcance: "Agenda de citas con recordatorios y cobros anticipados.",
      complejidad: "alta",
      plan_clave: "supabase",
      plan_nivel: "inicial",
      estado: "borrador",
      creado: "2026-11-11T12:00:00.000Z",
      enviado: null,
      plan: PLAN,
    };
    const variables = variablesDeProyecto(proyecto);
    assert.equal(variables.proyecto_nombre, "Estudio Ana");
    assert.equal(variables.proyecto_complejidad, "Alta");
    assert.equal(variables.plan_nombre, "Inicial de Supabase");
    assert.equal(variables.plan_precio, "USD 0");
    assert.equal(variables.plan_fecha, "11 de noviembre de 2026");
    assert.equal(variables.plan_fuente, PLAN.fuente);
    assert.equal(variables.proyecto_alcance, proyecto.alcance);
  });
});
