/* Opcional: PostgreSQL desechable sin red, usando únicamente una imagen Docker local.
   BWS_PRUEBA_PG_LOCAL=1 npx tsx --test pruebas/firma-ajustes-postgres.test.ts */
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { chmodSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { neonConfig } from "@neondatabase/serverless";
import pg from "pg";
import firmar from "../server/documentos/firmar.ts";
import ajustar from "../server/admin/documentos/ajustar.ts";

type Consulta = { query: string; params: string[] };
const tokenAdmin = "A".repeat(43);
const pdfOriginal = Buffer.from(`%PDF-1.7\n${"O".repeat(1100)}\n%%EOF`);
const pdfAjustado = Buffer.from(`%PDF-1.7\n${"A".repeat(1100)}\n%%EOF`);
const hash = (dato: string | Buffer) => createHash("sha256").update(dato).digest("hex");
function diferido() {
  let resolver!: () => void;
  const promesa = new Promise<void>((resolve) => { resolver = resolve; });
  return { promesa, resolver };
}
function post(token: string, cuerpo: unknown = {}) {
  return new Request("https://portal.test/api", { method: "POST", headers: {
    origin: "https://portal.test", cookie: `bws_sesion=${token}`, "content-type": "application/json",
  }, body: JSON.stringify(cuerpo) });
}

// Opt-in para que la batería normal no requiera Docker ni una imagen instalada.
test("PostgreSQL aislado: permisos RLS, SQL y carreras reales", {
  skip: process.env.BWS_PRUEBA_PG_LOCAL !== "1", timeout: 180_000,
}, async (t) => {
  execFileSync("docker", ["image", "inspect", "postgres:16-alpine"], { stdio: "ignore" });
  const directorio = mkdtempSync(join(tmpdir(), "bws-firma-pg-"));
  chmodSync(directorio, 0o777);
  let contenedor = "";
  let propietario: pg.Client | undefined;
  const fetchOriginal = neonConfig.fetchFunction;
  const variables = ["ENTORNO", "DATABASE_URL_APP", "APP_ORIGEN"] as const;
  const anteriores = Object.fromEntries(variables.map((variable) => [variable, process.env[variable]]));
  try {
    contenedor = execFileSync("docker", ["run", "--detach", "--rm", "--pull=never", "--network=none",
      "--mount", `type=bind,source=${directorio},target=/var/run/postgresql`,
      "--env", "POSTGRES_HOST_AUTH_METHOD=trust", "postgres:16-alpine"], { encoding: "utf8" }).trim();
    // La imagen arranca un servidor temporal durante initdb y después el definitivo.
    await new Promise<void>((resolve, reject) => {
      const logs = spawn("docker", ["logs", "--follow", contenedor]);
      let texto = "";
      const recibir = (datos: Buffer) => {
        texto += datos.toString();
        if ((texto.match(/database system is ready to accept connections/g) ?? []).length >= 2) {
          logs.kill(); resolve();
        }
      };
      logs.stdout.on("data", recibir); logs.stderr.on("data", recibir);
      logs.on("error", reject);
      logs.on("exit", (codigo) => { if (codigo && codigo !== 0) reject(new Error(`docker logs: ${codigo}`)); });
    });
    const conexion = { host: directorio, user: "postgres", database: "postgres", port: 5432 };
    propietario = new pg.Client(conexion);
    await propietario.connect();
    await propietario.query("create role bws_app login nosuperuser nocreatedb nocreaterole noinherit");
    for (const archivo of ["0001_esquema.sql", "0002_inmutabilidad.sql", "0004_rls.sql", "0006_rol.sql",
      "0007_sesion.sql", "0010_expediente.sql", "0014_ajuste_documento.sql", "0016_persona_proyecto.sql",
      "0017_contexto_sello.sql", "0019_nombre_archivo_documento.sql"]) {
      await propietario.query(readFileSync(new URL(`../db/migrations/${archivo}`, import.meta.url), "utf8"));
    }
    const admin = randomUUID(); const representante = randomUUID();
    await propietario.query(`insert into usuarios (id, correo, clave_hash, nombre, rol, correo_verificado)
      values ($1, 'admin@example.test', 'x', 'Admin', 'admin', true)`, [admin]);
    await propietario.query(`insert into sesiones (usuario_id, token_hash, expira)
      values ($1, $2, now() + interval '1 day')`, [admin, hash(tokenAdmin)]);
    await propietario.query(`insert into representantes (id, nombre, documento, png, sha256, utc)
      values ($1, 'Representante', 'V-12345678', $2, 'hash', now())`, [representante, Buffer.from("png")]);
    await propietario.query(`insert into planes_infra (clave, nivel, version, nombre, limites, precio_usd, costo_usd, fuente, fecha)
      values ('prueba', 'inicial', 1, 'Prueba', '[]', 0, 0, 'Prueba', current_date)`);
    await propietario.query(`insert into plantillas (codigo, version, contenido, sha256)
      values ('BWS-CON-001', 1, '{}', 'hash'), ('BWS-CON-002', 1, '{}', 'hash')`);

    async function expediente() {
      const usuario = randomUUID(); const cliente = randomUUID(); const firma = randomUUID();
      const proyecto = randomUUID(); const documentos = [randomUUID(), randomUUID()];
      const token = randomUUID().replaceAll("-", "") + "Z".repeat(11);
      await propietario!.query(`insert into usuarios (id, correo, clave_hash, nombre, correo_verificado)
        values ($1, $2, 'x', 'Cliente', true)`, [usuario, `${usuario}@example.test`]);
      await propietario!.query(`insert into sesiones (usuario_id, token_hash, expira)
        values ($1, $2, now() + interval '1 day')`, [usuario, hash(token)]);
      await propietario!.query(`insert into clientes (id, usuario_id, razon_social, documento_tipo, documento_numero,
        domicilio_fiscal, telefono, correo_factura) values ($1, $2, 'Cliente', 'RIF', $3, 'Domicilio', '123', 'a@example.test')`,
      [cliente, usuario, usuario]);
      await propietario!.query(`insert into firmas_cliente (id, cliente_id, png, sha256, utc, metodo, version, hash_consentimiento)
        values ($1, $2, $3, 'hash', now(), 'simple_reforzada', 1, 'hash')`, [firma, cliente, Buffer.from("png")]);
      await propietario!.query("update clientes set firma_actual = $1 where id = $2", [firma, cliente]);
      await propietario!.query(`insert into proyectos (id, cliente_id, nombre, categoria, dominio, buzones, alcance,
        complejidad, plan_clave, plan_nivel, plan_version, estado, persona_tipo)
        values ($1, $2, 'Proyecto', 'Sitio web', $3, '["a@example.test"]', 'Alcance', 'simple', 'prueba',
                'inicial', 1, 'en_revision', 'natural')`, [proyecto, cliente, `${proyecto}.test`]);
      for (const [indice, documento] of documentos.entries()) {
        await propietario!.query(`insert into documentos (id, proyecto_id, plantilla_codigo, plantilla_version, orden,
          pdf, sello, hash_archivo, hash_anterior, hash_cadena) values ($1, $2, $3, 1, $4, $5, $6, $7, 'previo', 'cadena')`,
        [documento, proyecto, `BWS-CON-00${indice + 1}`, indice + 1, pdfOriginal, `sello-${indice}`, hash(pdfOriginal)]);
        await propietario!.query(`insert into actos_firma (documento_id, firmante, representante_id, sello, utc)
          values ($1, 'representante', $2, $3, now())`, [documento, representante, `sello-${indice}`]);
      }
      return { usuario, proyecto, documentos, token };
    }

    process.env.ENTORNO = "local";
    process.env.DATABASE_URL_APP = "postgresql://bws_app:prueba@localhost/prueba";
    process.env.APP_ORIGEN = "https://portal.test";
    let retener: { tipo: "firma" | "ajuste"; adquirida: () => void; liberar: Promise<void> } | undefined;
    let alIntentar: ((pid: number) => void) | undefined;
    let aislamientoNoSeguro = false;
    neonConfig.fetchFunction = async (_url: string, opciones: RequestInit) => {
      const cuerpo = JSON.parse(String(opciones.body)) as Consulta | { queries: Consulta[] };
      const lote = "queries" in cuerpo ? cuerpo.queries : [cuerpo];
      const tipo = lote.some((q) => q.query.includes("with docs as materialized")) ? "firma"
        : lote.some((q) => q.query.includes("with estado as materialized")) ? "ajuste" : undefined;
      // No se envía correo, ni siquiera cuando se confirme un expediente.
      if (lote.some((q) => q.query.includes("c.razon_social"))) throw new Error("Correo deshabilitado en prueba");
      const cliente = new pg.Client(conexion);
      await cliente.connect();
      try {
        await cliente.query("set role bws_app");
        if ("queries" in cuerpo) {
          await cliente.query("begin");
          if (tipo && aislamientoNoSeguro) await cliente.query("set transaction isolation level repeatable read");
        }
        const results = [];
        for (const q of lote) {
          const esBloqueo = q.query.includes("with bloqueado as materialized");
          if (esBloqueo && alIntentar) {
            const avisar = alIntentar; alIntentar = undefined;
            const pid = await cliente.query("select pg_backend_pid() as pid");
            avisar(Number(pid.rows[0].pid));
          }
          const r = await cliente.query(q.query, q.params);
          const actual = retener;
          if (esBloqueo && actual && actual.tipo === tipo) {
            retener = undefined; actual.adquirida(); await actual.liberar;
          }
          results.push({ fields: r.fields.map((campo) => ({ name: campo.name, dataTypeID: campo.dataTypeID })),
            rows: r.rows.map((fila) => r.fields.map((campo) => {
              const valor: unknown = fila[campo.name];
              if (valor == null) return null;
              if (Buffer.isBuffer(valor)) return `\\x${valor.toString("hex")}`;
              if (valor instanceof Date) return valor.toISOString().replace("T", " ").replace("Z", "+00");
              if (typeof valor === "boolean") return valor ? "t" : "f";
              return typeof valor === "object" ? JSON.stringify(valor) : String(valor);
            })) });
        }
        if ("queries" in cuerpo) await cliente.query("commit");
        return Response.json("queries" in cuerpo ? { results } : results[0]);
      } catch (error) {
        if ("queries" in cuerpo) await cliente.query("rollback");
        throw error;
      } finally { await cliente.end(); }
    };

    await t.test("la firma y el rechazo posterior del ajuste funcionan con bws_app y RLS", async () => {
      const e = await expediente();
      const r = await firmar(post(e.token));
      assert.equal(r.status, 200, await r.clone().text());
      assert.equal((await r.json()).actos, 2);
      const a = await ajustar(post(tokenAdmin, { documento_id: e.documentos[1], pdf: pdfAjustado.toString("base64") }));
      assert.equal(a.status, 409, await a.clone().text());
      assert.equal((await a.json()).codigo, "ya_confirmado");
      const actos = await propietario!.query("select sello from actos_firma where firmante = 'cliente' and documento_id = any($1::uuid[]) order by sello", [e.documentos]);
      assert.deepEqual(actos.rows.map((fila) => fila.sello), ["sello-0", "sello-1"]);
    });

    await t.test("la RLS aísla expedientes y un ajuste histórico distinto impide la firma", async () => {
      const afectado = await expediente(); const otro = await expediente();
      for (const [bytes, fecha] of [[pdfAjustado, "2026-01-01"], [pdfOriginal, "2026-01-02"]] as const) {
        await propietario!.query(`insert into documentos_ajustados
          (documento_id, proyecto_id, pdf, sha256_original, sha256_ajustado, actor, utc)
          values ($1, $2, $3, $4, $5, $6, $7)`,
        [afectado.documentos[0], afectado.proyecto, bytes, hash(pdfOriginal), hash(bytes), admin, fecha]);
      }
      const verificacion = new pg.Client(conexion);
      await verificacion.connect();
      try {
        await verificacion.query("set role bws_app");
        await verificacion.query("begin");
        await verificacion.query("select set_config('app.usuario_id', $1, true), set_config('app.rol', 'cliente', true)", [otro.usuario]);
        const visibles = await verificacion.query("select count(*) from documentos_ajustados where proyecto_id = $1", [afectado.proyecto]);
        assert.equal(visibles.rows[0].count, "0");
        await verificacion.query("commit");
      } finally { await verificacion.end(); }
      const denegada = await firmar(post(afectado.token));
      assert.equal(denegada.status, 409, await denegada.clone().text());
      assert.equal((await denegada.json()).codigo, "expediente_ajustado");
      const sinAjuste = await firmar(post(otro.token));
      assert.equal(sinAjuste.status, 200, await sinAjuste.clone().text());
      const historial = await propietario!.query(`select sha256_ajustado from documentos_ajustados
        where documento_id = $1 order by utc`, [afectado.documentos[0]]);
      assert.deepEqual(historial.rows.map((fila) => fila.sha256_ajustado), [hash(pdfAjustado), hash(pdfOriginal)]);
      const actos = await propietario!.query("select count(*) from actos_firma where firmante = 'cliente' and documento_id = any($1::uuid[])", [afectado.documentos]);
      assert.equal(actos.rows[0].count, "0");
    });

    await t.test("un aislamiento distinto de READ COMMITTED no escribe evidencia", async () => {
      const e = await expediente();
      aislamientoNoSeguro = true;
      try {
        const f = await firmar(post(e.token));
        assert.equal(f.status, 503, await f.clone().text());
        assert.equal((await f.json()).codigo, "aislamiento");
        const a = await ajustar(post(tokenAdmin, { documento_id: e.documentos[0], pdf: pdfAjustado.toString("base64") }));
        assert.equal(a.status, 503, await a.clone().text());
        assert.equal((await a.json()).codigo, "aislamiento");
      } finally { aislamientoNoSeguro = false; }
      const datos = await propietario!.query(`select (select count(*) from actos_firma where firmante = 'cliente' and documento_id = any($1::uuid[])) as actos,
        (select count(*) from documentos_ajustados where documento_id = any($1::uuid[])) as ajustes`, [e.documentos]);
      assert.deepEqual(datos.rows[0], { actos: "0", ajustes: "0" });
    });

    async function carrera(primero: "firma" | "ajuste") {
      const e = await expediente();
      const adquirida = diferido(); const liberar = diferido();
      let recibirPid!: (pid: number) => void;
      const pidEsperando = new Promise<number>((resolve) => { recibirPid = resolve; });
      retener = { tipo: primero, adquirida: adquirida.resolver, liberar: liberar.promesa };
      const firmarPeticion = () => firmar(post(e.token));
      const ajustarPeticion = () => ajustar(post(tokenAdmin, { documento_id: e.documentos[1], pdf: pdfAjustado.toString("base64") }));
      const primera = primero === "firma" ? firmarPeticion() : ajustarPeticion();
      await Promise.race([adquirida.promesa, primera.then(async (r) => {
        throw new Error(`La primera petición terminó antes de bloquear: ${r.status} ${await r.clone().text()}`);
      })]);
      alIntentar = recibirPid;
      const segunda = primero === "firma" ? ajustarPeticion() : firmarPeticion();
      try {
        const pid = await Promise.race([pidEsperando, segunda.then(async (r) => {
          throw new Error(`La segunda petición terminó antes de bloquear: ${r.status} ${await r.clone().text()}`);
        })]);
        let bloqueada = false;
        for (let intento = 0; intento < 100 && !bloqueada; intento++) {
          const estado = await propietario!.query("select cardinality(pg_blocking_pids($1)) > 0 as bloqueada", [pid]);
          bloqueada = estado.rows[0].bloqueada as boolean;
        }
        assert.equal(bloqueada, true, "la segunda transacción espera por el proyecto");
      } finally { liberar.resolver(); }
      const respuestas = await Promise.all([primera, segunda]);
      return { e, respuestas };
    }

    await t.test("un ajuste concurrente confirmado primero bloquea todos los actos", async () => {
      const { e, respuestas: [a, f] } = await carrera("ajuste");
      assert.equal(a.status, 201, await a.clone().text());
      assert.equal(f.status, 409, await f.clone().text());
      assert.equal((await f.json()).codigo, "expediente_ajustado");
      const datos = await propietario!.query(`select (select count(*) from actos_firma where firmante = 'cliente' and documento_id = any($1::uuid[])) as actos,
        (select count(*) from documentos_ajustados where documento_id = any($1::uuid[])) as ajustes`, [e.documentos]);
      assert.deepEqual(datos.rows[0], { actos: "0", ajustes: "1" });
    });

    await t.test("la firma concurrente confirmada primero bloquea el ajuste", async () => {
      const { e, respuestas: [f, a] } = await carrera("firma");
      assert.equal(f.status, 200, await f.clone().text());
      assert.equal(a.status, 409, await a.clone().text());
      assert.equal((await a.json()).codigo, "ya_confirmado");
      const datos = await propietario!.query(`select (select count(*) from actos_firma where firmante = 'cliente' and documento_id = any($1::uuid[])) as actos,
        (select count(*) from documentos_ajustados where documento_id = any($1::uuid[])) as ajustes`, [e.documentos]);
      assert.deepEqual(datos.rows[0], { actos: "2", ajustes: "0" });
    });
  } finally {
    neonConfig.fetchFunction = fetchOriginal;
    for (const variable of variables) {
      if (anteriores[variable] === undefined) delete process.env[variable];
      else process.env[variable] = anteriores[variable];
    }
    await propietario?.end();
    if (contenedor) {
      execFileSync("docker", ["exec", "--user", "root", contenedor, "chown", "-R",
        `${process.getuid!()}:${process.getgid!()}`, "/var/run/postgresql"], { stdio: "ignore" });
      execFileSync("docker", ["stop", "--time", "0", contenedor], { stdio: "ignore" });
    }
    rmSync(directorio, { recursive: true, force: true });
  }
});
