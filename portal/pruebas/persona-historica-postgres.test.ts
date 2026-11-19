/* Solo con BWS_PERSONA_POSTGRES=1: crea su propio contenedor sin red y lo destruye. */
import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const habilitado = process.env.BWS_PERSONA_POSTGRES === "1";
const migraciones = fileURLToPath(new URL("../db/migrations/", import.meta.url));
const usuario = "11111111-1111-4111-8111-111111111111";
const otro = "22222222-2222-4222-8222-222222222222";
const cliente = "33333333-3333-4333-8333-333333333333";
const clienteOtro = "44444444-4444-4444-8444-444444444444";
const proyecto = (n: number) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, "0")}`;
const contexto = (id = usuario, rol = "cliente") =>
  `set local role bws_app; select set_config('app.usuario_id','${id}',true), set_config('app.rol','${rol}',true);`;
const documento = (id: string) => `insert into documentos
  (proyecto_id, plantilla_codigo, plantilla_version, orden, pdf, sello, hash_archivo, hash_anterior, hash_cadena)
  values ('${id}', 'PRUEBA', 1, 1, decode('00','hex'), 'sello', 'archivo', 'GENESIS', 'cadena');`;

test("0021: RLS, inmutabilidad y carreras en PostgreSQL desechable", { skip: !habilitado, timeout: 120_000 }, async () => {
  const nombre = `bws-persona-test-${randomUUID().slice(0, 8)}`;
  const ejecutar = (args: string[], input?: string) => spawnSync("docker", args, { input, encoding: "utf8" });
  const inicio = ejecutar(["run", "--detach", "--rm", "--name", nombre, "--network", "none", "--pull", "never",
    "--tmpfs", "/var/lib/postgresql/data:rw", "--env", "POSTGRES_PASSWORD=prueba-aislada", "postgres:16-alpine"]);
  assert.equal(inicio.status, 0, inicio.stderr);
  const sesiones: ChildProcessWithoutNullStreams[] = [];
  try {
    // La imagen arranca un servidor temporal durante initdb y después el definitivo.
    await new Promise<void>((resolve, reject) => {
      const logs = spawn("docker", ["logs", "--follow", nombre]);
      let texto = "";
      const timer = setTimeout(() => { logs.kill(); reject(new Error("PostgreSQL no arrancó")); }, 30_000);
      const leer = (chunk: Buffer) => {
        texto += chunk.toString();
        if ((texto.match(/database system is ready to accept connections/g) ?? []).length >= 2) {
          clearTimeout(timer); logs.kill(); resolve();
        }
      };
      logs.stdout.on("data", leer); logs.stderr.on("data", leer);
      logs.on("error", reject);
    });
    const psql = (sql: string) => ejecutar(["exec", "-i", nombre, "psql", "-X", "-q", "-A", "-t",
      "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], `\\set VERBOSITY verbose\n${sql}\n`);
    const ok = (sql: string) => {
      const r = psql(sql);
      assert.equal(r.status, 0, r.stderr);
      return r.stdout.trim();
    };
    const error = (sql: string, codigo: string) => {
      const r = psql(sql);
      assert.notEqual(r.status, 0, `Se esperaba ${codigo}: ${sql}`);
      assert.match(r.stderr, new RegExp(codigo));
    };
    const esperarBloqueado = async (sql: string, nombreConsulta: string) => {
      const proceso = spawn("docker", ["exec", "-i", nombre, "psql", "-X", "-q", "-A", "-t",
        "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"]);
      sesiones.push(proceso);
      let salida = "";
      let errores = "";
      proceso.stdout.on("data", (chunk: Buffer) => { salida += chunk.toString(); });
      proceso.stderr.on("data", (chunk: Buffer) => { errores += chunk.toString(); });
      const terminado = new Promise<{ code: number | null; salida: string; errores: string }>((resolve) => {
        proceso.on("exit", (code) => resolve({ code, salida, errores }));
      });
      proceso.stdin.end(`\\set VERBOSITY verbose\nset application_name='${nombreConsulta}';\n${sql}\n`);
      let bloqueado = false;
      for (let i = 0; i < 100 && proceso.exitCode === null; i += 1) {
        if (ok(`select count(*) from pg_stat_activity where application_name='${nombreConsulta}' and wait_event_type='Lock'`) === "1") {
          bloqueado = true;
          break;
        }
      }
      assert.ok(bloqueado, `La sesión no quedó esperando un bloqueo: ${errores}`);
      return { terminado };
    };
    const sesion = async (sql: string) => {
      const proceso = spawn("docker", ["exec", "-i", nombre, "psql", "-X", "-q", "-A", "-t",
        "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"]);
      sesiones.push(proceso);
      let salida = "";
      let errores = "";
      proceso.stderr.on("data", (chunk: Buffer) => { errores += chunk.toString(); });
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Sesión sin señal: ${errores}`)), 10_000);
        proceso.stdout.on("data", (chunk: Buffer) => {
          salida += chunk.toString();
          if (salida.includes("LISTO_BLOQUEO")) { clearTimeout(timer); resolve(); }
        });
        proceso.on("exit", (code) => { if (!salida.includes("LISTO_BLOQUEO")) { clearTimeout(timer); reject(new Error(`Sesión terminó ${code}: ${errores}`)); } });
        proceso.stdin.write(`${sql}\n\\echo LISTO_BLOQUEO\n`);
      });
      return async () => {
        proceso.stdin.end("commit;\n\\q\n");
        const code = await new Promise<number | null>((resolve) => proceso.on("exit", resolve));
        assert.equal(code, 0, errores);
      };
    };

    // 0004 concede funciones a bws_app antes de que 0006 complete sus permisos.
    ok("create role bws_app login nosuperuser nocreatedb nocreaterole noinherit;");
    const archivos = readdirSync(migraciones).filter((f) => /^00(0[1-9]|1[0-5])_.*\.sql$/.test(f)).sort();
    for (const archivo of archivos) ok(readFileSync(`${migraciones}/${archivo}`, "utf8"));
    ok(`insert into usuarios(id, correo, clave_hash, nombre) values
      ('${usuario}', 'uno@test.invalid', 'x', 'Uno'), ('${otro}', 'dos@test.invalid', 'x', 'Dos');
      insert into clientes(id, usuario_id, razon_social, documento_tipo, documento_numero, domicilio_fiscal, telefono, correo_factura) values
      ('${cliente}', '${usuario}', 'Uno', 'RIF', 'J-12345678-9', 'Caracas', '1234567', 'uno@test.invalid'),
      ('${clienteOtro}', '${otro}', 'Dos', 'RIF', 'J-87654321-0', 'Caracas', '1234567', 'dos@test.invalid');
      insert into plantillas(codigo, version, contenido, sha256) values ('PRUEBA', 1, '{}', 'plantilla');
      insert into proyectos(id, cliente_id, nombre, categoria, dominio, buzones, alcance, complejidad, plan_clave, plan_nivel, plan_version, estado, enviado)
      select ('aaaaaaaa-aaaa-4aaa-8aaa-' || lpad(n::text, 12, '0'))::uuid,
        case when n = 4 then '${clienteOtro}'::uuid else '${cliente}'::uuid end,
        'Histórico', 'Otro', 'ejemplo' || n || '.com', jsonb_build_array('no-reply@ejemplo' || n || '.com'), 'Alcance intacto', 'media',
        'supabase', 'inicial', 1, case when n = 10 then 'aprobado' else 'enviado' end, '2020-01-01'
      from generate_series(1, 10) n;
      ${documento(proyecto(3))}`);
    for (const archivo of readdirSync(migraciones).filter((f) => /^001[6-9]_.*\.sql$/.test(f)).sort()) {
      ok(readFileSync(`${migraciones}/${archivo}`, "utf8"));
    }
    const migracion = readFileSync(`${migraciones}/0021_persona_historica.sql`, "utf8");
    ok(migracion);
    ok(migracion);
    assert.equal(ok("select count(*) from proyectos where persona_tipo is null and cliente_rep_nombre is null and cliente_rep_documento is null"), "10");
    assert.equal(ok(`select encode(pdf, 'hex') || ':' || sello from documentos where proyecto_id = '${proyecto(3)}'`), "00:sello");

    const capturar = (id: string, persona: string, nombreRep: string, docRep: string) => `begin; ${contexto()}
      select id from proyectos where id = '${id}' and cliente_id = '${cliente}' for update;
      with actualizado as (update proyectos set persona_tipo = '${persona}', cliente_rep_nombre = ${nombreRep},
        cliente_rep_documento = ${docRep} where id = '${id}' and cliente_id = '${cliente}'
        and estado = 'enviado' and persona_tipo is null
        and not exists (select 1 from documentos where proyecto_id = '${id}') returning id), evento as (
        insert into eventos(actor, rol, accion, entidad, entidad_id)
        select '${usuario}', 'cliente', 'proyecto.persona_historica', 'proyectos', id::text from actualizado)
      select count(*) from actualizado; commit;`;
    assert.match(ok(capturar(proyecto(1), "natural", "null", "null")), /1\s*$/);
    assert.match(ok(capturar(proyecto(2), "juridica", "'Ana Pérez'", "'V-12345678'")), /1\s*$/);
    assert.match(ok(capturar(proyecto(3), "natural", "null", "null")), /0\s*$/);
    assert.match(ok(capturar(proyecto(4), "natural", "null", "null")), /0\s*$/);
    assert.match(ok(capturar(proyecto(10), "natural", "null", "null")), /0\s*$/);
    assert.equal(ok("select count(*) from eventos where accion = 'proyecto.persona_historica'"), "2");
    assert.equal(ok(`select alcance || ':' || estado from proyectos where id = '${proyecto(1)}'`), "Alcance intacto:enviado");
    assert.match(ok(`begin; ${contexto()} select count(*) from proyectos where id='${proyecto(4)}'; commit;`), /0\s*$/);
    error(`begin; ${contexto()} update proyectos set persona_tipo='natural' where id='${proyecto(3)}'; commit;`, "42501");
    error(`begin; ${contexto()} update proyectos set persona_tipo='juridica', cliente_rep_nombre='Otra Persona', cliente_rep_documento='V-12345678' where id='${proyecto(1)}'; commit;`, "42501");
    error(`begin; ${contexto(usuario, "admin")} update proyectos set persona_tipo='natural' where id='${proyecto(9)}'; commit;`, "42501");
    error(`begin; ${contexto()} update proyectos set persona_tipo='juridica' where id='${proyecto(9)}'; commit;`, "23514");
    error(`begin; ${contexto()} update proyectos set persona_tipo='natural', alcance='alterado' where id='${proyecto(9)}'; commit;`, "42501");
    // Un fallo al registrar el evento revierte también la captura anterior.
    error(`begin; ${contexto()} update proyectos set persona_tipo='natural' where id='${proyecto(9)}';
      insert into eventos(actor, rol, accion, entidad) values ('${otro}', 'cliente', 'prueba', 'proyectos'); commit;`, "42501");
    assert.equal(ok(`select coalesce(persona_tipo, 'NULL') || ':' || alcance from proyectos where id='${proyecto(9)}'`), "NULL:Alcance intacto");
    ok(`begin; ${contexto()} update proyectos set estado='en_revision' where id='${proyecto(10)}'; commit;`);
    error(`begin isolation level repeatable read; ${contexto()} update proyectos set persona_tipo='natural' where id='${proyecto(9)}'; commit;`, "P2102");
    error(`begin isolation level repeatable read; ${contexto(usuario, "admin")} select bws_exigir_generacion_proyecto('${proyecto(1)}','natural',null,null); commit;`, "P2102");
    ok(`begin; ${contexto(usuario, "admin")} select bws_exigir_generacion_proyecto('${proyecto(2)}','juridica','Ana Pérez','V-12345678'); commit;`);
    error(`begin; ${contexto(usuario, "admin")} select bws_exigir_generacion_proyecto('${proyecto(2)}','juridica','Otra Persona','V-12345678'); commit;`, "P2101");
    error(`begin; ${contexto(usuario, "admin")} select bws_exigir_generacion_proyecto('${proyecto(2)}','juridica','Ana Pérez','V-87654321'); commit;`, "P2101");

    // Un INSERT anterior mantiene KEY SHARE por la FK: el trigger debe esperar
    // al convertirlo en FOR UPDATE y luego observar ese documento confirmado.
    let terminar = await sesion(`begin; ${contexto(usuario, "admin")} ${documento(proyecto(5))}`);
    error(`begin; set local lock_timeout='200ms'; ${contexto()} update proyectos set persona_tipo='natural' where id='${proyecto(5)}'; commit;`, "55P03");
    const esperaTrigger = await esperarBloqueado(
      `begin; ${contexto()} update proyectos set persona_tipo='natural' where id='${proyecto(5)}'; commit;`, "bws_prueba_trigger");
    await terminar();
    const resultadoTrigger = await esperaTrigger.terminado;
    assert.notEqual(resultadoTrigger.code, 0);
    assert.match(resultadoTrigger.errores, /42501/);
    error(`begin; ${contexto()} update proyectos set persona_tipo='natural' where id='${proyecto(5)}'; commit;`, "42501");

    // El SELECT FOR UPDATE de la API espera al INSERT y la siguiente sentencia
    // debe ver el documento confirmado, aunque la transacción empezó antes.
    terminar = await sesion(`begin; ${contexto(usuario, "admin")} ${documento(proyecto(8))}`);
    const esperaApi = await esperarBloqueado(capturar(proyecto(8), "natural", "null", "null"), "bws_prueba_api");
    await terminar();
    const resultadoApi = await esperaApi.terminado;
    assert.equal(resultadoApi.code, 0, resultadoApi.errores);
    assert.match(resultadoApi.salida, /0\s*$/);
    assert.equal(ok(`select count(*) from eventos where entidad_id='${proyecto(8)}'`), "0");

    // La captura bloquea a un generador hasta confirmar sus valores.
    terminar = await sesion(`begin; ${contexto()} select id from proyectos where id='${proyecto(6)}' for update;
      update proyectos set persona_tipo='natural' where id='${proyecto(6)}';`);
    error(`begin; set local lock_timeout='200ms'; ${contexto(usuario, "admin")} select bws_exigir_generacion_proyecto('${proyecto(6)}','natural',null,null); commit;`, "55P03");
    await terminar();
    error(`begin; ${contexto(usuario, "admin")} select bws_exigir_generacion_proyecto('${proyecto(6)}','juridica','Ana Pérez','V-12345678'); commit;`, "P2101");

    // Dos generadores no pueden añadir expedientes paralelos o parciales.
    terminar = await sesion(`begin; ${contexto(usuario, "admin")}
      select bws_exigir_generacion_proyecto('${proyecto(6)}','natural',null,null); ${documento(proyecto(6))}`);
    error(`begin; set local lock_timeout='200ms'; ${contexto(usuario, "admin")} select bws_exigir_generacion_proyecto('${proyecto(6)}','natural',null,null); commit;`, "55P03");
    const esperaGenerador = await esperarBloqueado(
      `begin; ${contexto(usuario, "admin")} select bws_exigir_generacion_proyecto('${proyecto(6)}','natural',null,null); commit;`, "bws_prueba_generador");
    await terminar();
    const resultadoGenerador = await esperaGenerador.terminado;
    assert.notEqual(resultadoGenerador.code, 0);
    assert.match(resultadoGenerador.errores, /P2101/);
    error(`begin; ${contexto(usuario, "admin")} select bws_exigir_generacion_proyecto('${proyecto(6)}','natural',null,null); commit;`, "P2101");
    assert.equal(ok(`select count(*) || ':' || min(sello) from documentos where proyecto_id='${proyecto(6)}'`), "1:sello");

    // Un insert posterior también espera al FOR UPDATE del cliente.
    terminar = await sesion(`begin; ${contexto()} select id from proyectos where id='${proyecto(7)}' for update;`);
    error(`begin; set local lock_timeout='200ms'; ${contexto(usuario, "admin")} ${documento(proyecto(7))} commit;`, "55P03");
    await terminar();
  } finally {
    for (const proceso of sesiones) if (proceso.exitCode === null) proceso.kill();
    ejecutar(["rm", "-f", nombre]);
  }
});
