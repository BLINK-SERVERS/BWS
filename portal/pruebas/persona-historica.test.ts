import assert from "node:assert/strict";
import { mock, test } from "node:test";

if (typeof mock.module !== "function") {
  test("persona histórica", { skip: "Requiere --experimental-test-module-mocks" }, () => {});
} else {
  type Consulta = { sql: string; valores: unknown[] };
  const llamadas: Consulta[][] = [];
  let respuestas: Record<string, unknown>[][][] = [];
  let falloDb: { code: string } | null = null;
  let rol = "cliente";
  let autenticado = true;
  const usuarioId = "11111111-1111-4111-8111-111111111111";
  const clienteId = "22222222-2222-4222-8222-222222222222";
  const proyectoId = "33333333-3333-4333-8333-333333333333";
  mock.module(new URL("../server/_lib/db.ts", import.meta.url), { namedExports: {
    enTransaccion: async (_id: unknown, _rol: unknown,
      construir: (txn: (cadenas: TemplateStringsArray, ...valores: unknown[]) => Consulta) => Consulta[]) => {
      llamadas.push(construir((cadenas, ...valores) => ({ sql: cadenas.join("?"), valores })));
      if (falloDb) throw falloDb;
      const resultado = respuestas.shift();
      if (!resultado) throw new Error("Consulta no simulada");
      return resultado;
    },
  } });
  mock.module(new URL("../server/_lib/sesion.ts", import.meta.url), { namedExports: {
    leerSesion: async () => autenticado ? { usuarioId, rol } : null,
  } });
  mock.module(new URL("../server/_lib/cuenta.ts", import.meta.url), { namedExports: {
    estadoDe: async () => ({ cliente: { id: clienteId }, firma: null }),
  } });
  mock.module(new URL("../server/_lib/csrf.ts", import.meta.url), { namedExports: { exigirOrigen: () => undefined } });
  const plan = { clave: "supabase", nivel: "inicial", version: 1, nombre: "Inicial", precio_usd: 0,
    limites: [], fuente: "prueba", fecha: "2026-01-01", fecha_larga: "1 de enero de 2026" };
  mock.module(new URL("../server/_lib/planes.ts", import.meta.url), { namedExports: {
    planExacto: async () => plan, planesVigentes: async () => [], buscarVigente: () => null,
    nombreDePreset: (s: string) => s,
  } });
  const { default: endpoint, leerPersonaHistorica } = await import("../server/cliente/proyecto.ts");
  const base = { accion: "registrar_persona_historica", proyecto_id: proyectoId,
    persona_tipo: "natural", cliente_rep_nombre: null, cliente_rep_documento: null };
  const fila = { id: proyectoId, nombre: "Proyecto", categoria: "Otro", dominio: "ejemplo.com",
    buzones: [], alcance: "alcance", complejidad: "media", plan_clave: "supabase", plan_nivel: "inicial",
    plan_version: 1, estado: "enviado", creado: "2026-01-01", enviado: "2026-01-02",
    persona_tipo: "natural", cliente_rep_nombre: null, cliente_rep_documento: null };
  const enviar = (cuerpo: unknown) => endpoint(new Request("https://portal.test/api/cliente/proyecto", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(cuerpo),
  }));
  function preparar(...filas: Record<string, unknown>[][][]) {
    llamadas.length = 0;
    respuestas = filas;
    falloDb = null;
  }

  test("exige elección explícita y normaliza solo el representante jurídico", () => {
    assert.deepEqual(leerPersonaHistorica(base), { proyectoId, persona: "natural", nombre: null, documento: null });
    assert.deepEqual(leerPersonaHistorica({ ...base, persona_tipo: "juridica", cliente_rep_nombre: "  Ana Pérez  ",
      cliente_rep_documento: "v 12.345.678" }),
    { proyectoId, persona: "juridica", nombre: "Ana Pérez", documento: "V-12345678" });
    for (const entrada of [null, { ...base, proyecto_id: "x" }, { ...base, persona_tipo: null },
      { ...base, persona_tipo: "empresa" }, { ...base, cliente_rep_nombre: "Otra persona" },
      { ...base, alcance: "alterado" }, { ...base, razon_social: "alterada" },
      { ...base, persona_tipo: "juridica" },
      { ...base, persona_tipo: "juridica", cliente_rep_nombre: "1", cliente_rep_documento: "V-12345678" },
      { ...base, persona_tipo: "juridica", cliente_rep_nombre: "Ana Pérez", cliente_rep_documento: "J-12345678-9" }]) {
      assert.throws(() => leerPersonaHistorica(entrada));
    }
  });

  test("guarda con bloqueo, filtros de propietario y evento en la misma transacción", async () => {
    preparar([[], [fila]]);
    const respuesta = await enviar(base);
    assert.equal(respuesta.status, 200);
    assert.equal((await respuesta.json()).proyecto.persona_tipo, "natural");
    assert.equal(llamadas.length, 1);
    assert.match(llamadas[0][0].sql, /cliente_id\s*=\s*\?::uuid\s+for update/i);
    assert.match(llamadas[0][1].sql, /estado = 'enviado' and persona_tipo is null/i);
    assert.match(llamadas[0][1].sql, /not exists \(select 1 from documentos/i);
    assert.match(llamadas[0][1].sql, /insert into eventos/i);
    assert.doesNotMatch(llamadas[0][1].sql, /update clientes|set alcance/i);
    assert.ok(llamadas[0][1].valores.includes(usuarioId));
    assert.ok(llamadas[0][1].valores.includes(clienteId));
  });

  test("GET solo ofrece la captura cuando la consulta indica que es elegible", async () => {
    preparar([[{ ...fila, persona_tipo: null, puede_registrar_persona: true }]]);
    const respuesta = await endpoint(new Request("https://portal.test/api/cliente/proyecto"));
    assert.equal(respuesta.status, 200);
    assert.equal((await respuesta.json()).puede_registrar_persona, true);
    assert.match(llamadas[0][0].sql, /not exists \(select 1 from documentos/i);
    preparar([[{ ...fila, persona_tipo: null, puede_registrar_persona: false }]]);
    const conDocumentos = await endpoint(new Request("https://portal.test/api/cliente/proyecto"));
    assert.equal((await conDocumentos.json()).puede_registrar_persona, false);
  });

  test("rechaza otro rol, sesión ausente, conflictos y aislamiento inseguro", async () => {
    preparar(); rol = "admin";
    assert.equal((await enviar(base)).status, 403);
    assert.equal(llamadas.length, 0);
    rol = "cliente"; autenticado = false;
    assert.equal((await enviar(base)).status, 401);
    autenticado = true;
    preparar([[], []]);
    let respuesta = await enviar(base);
    assert.equal(respuesta.status, 409);
    assert.equal((await respuesta.json()).codigo, "persona_no_disponible");
    preparar(); falloDb = { code: "P2102" };
    respuesta = await enviar(base);
    assert.equal(respuesta.status, 503);
    assert.equal((await respuesta.json()).codigo, "aislamiento");
    falloDb = null;
  });
}
