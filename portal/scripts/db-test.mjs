/* ============================================================
   Pruebas de la base del portal contra la rama `pruebas`
   ------------------------------------------------------------
   Nunca se ejecuta contra `main`. Comprueba lo que el plan exige
   antes de publicar:

   · aislamiento entre clientes (RLS) en las diecisiete tablas;
   · UPDATE y DELETE rechazados en las tablas de solo agregar;
   · cadena de documentos recalculable desde la base;
   · doble firma y segunda firma original rechazadas;
   · alcance congelado tras enviar el proyecto;
   · presets de `planes_infra` idénticos a `legal/planes.ts`;
   · rol `bws_app` sin DDL, sin superusuario y sin escribir lo inmutable;
   · migraciones idempotentes y ninguna tabla fuera de plan.

   Las pruebas de RLS abren una transacción y fijan `app.usuario_id`
   y `app.rol` con `SET LOCAL`, igual que lo hará la API. Los datos
   de siembra se borran con TRUNCATE (no dispara los triggers de
   fila) al empezar y al terminar.

   node portal/scripts/db-test.mjs
   ============================================================ */

import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { cargarEnv, exigir } from "./_env.mjs";
import { PRESETS } from "../legal/planes.ts";
import { hashCadena, sha256Hex } from "../render/hash.ts";

const TABLAS = [
  "usuarios",
  "sesiones",
  "tokens_correo",
  "clientes",
  "firmas_cliente",
  "representantes",
  "planes_infra",
  "proyectos",
  "plantillas",
  "documentos",
  "actos_firma",
  "eventos",
  "envios",
  "limites",
  "suscripciones",
  "pagos",
  "licencias",
];
const ESPERADAS = new Set([...TABLAS, "migraciones"]);

const sha = sha256Hex;

let db;
let app;
let corrida;
const ids = {};
const resultados = [];

function afirmar(condicion, mensaje) {
  if (!condicion) throw new Error(mensaje);
}

async function prueba(nombre, fn) {
  try {
    await fn();
    resultados.push({ nombre, ok: true });
    console.log(`  ✓ ${nombre}`);
  } catch (error) {
    resultados.push({ nombre, ok: false, error: error.message });
    console.log(`  ✗ ${nombre}`);
    console.log(`      ${error.message}`);
  }
}

/** Ejecuta una sentencia que debe fallar; abre y revierte su transacción. */
async function esperarError(cliente, codigo, sql, parametros = []) {
  await cliente.query("begin");
  let error = null;
  try {
    await cliente.query(sql, parametros);
  } catch (capturado) {
    error = capturado;
  }
  await cliente.query("rollback");
  afirmar(error, `se esperaba el error ${codigo} y la sentencia pasó: ${sql}`);
  afirmar(
    error.code === codigo,
    `se esperaba ${codigo}, llegó ${error.code ?? "sin código"}: ${error.message}`,
  );
  return error;
}

/** Igual que `esperarError`, pero dentro de una transacción ya abierta. */
async function esperarErrorEn(cliente, codigo, sql, parametros = []) {
  await cliente.query("savepoint punto");
  let error = null;
  try {
    await cliente.query(sql, parametros);
  } catch (capturado) {
    error = capturado;
  }
  await cliente.query("rollback to savepoint punto");
  afirmar(error, `se esperaba el error ${codigo} y la sentencia pasó: ${sql}`);
  afirmar(
    error.code === codigo,
    `se esperaba ${codigo}, llegó ${error.code ?? "sin código"}: ${error.message}`,
  );
  return error;
}

/** Abre una transacción como la API: identidad y rol en `SET LOCAL`. */
async function como(usuarioId, rol, fn) {
  await app.query("begin");
  try {
    await app.query(
      "select set_config('app.usuario_id', $1, true), set_config('app.rol', $2, true)",
      [usuarioId ?? "", rol ?? ""],
    );
    const valor = await fn(app);
    await app.query("rollback");
    return valor;
  } catch (error) {
    await app.query("rollback").catch(() => {});
    throw error;
  }
}

async function limpiar() {
  await db.query("truncate table usuarios, representantes, plantillas, limites cascade");
}

async function sembrar() {
  const documento = (n) => `V-${n.slice(0, 8)}`;
  ids.usuarioA = randomUUID();
  ids.usuarioB = randomUUID();
  ids.usuarioAdmin = randomUUID();
  ids.clienteA = randomUUID();
  ids.clienteB = randomUUID();
  ids.representante = randomUUID();
  ids.firmaA = randomUUID();
  ids.firmaB = randomUUID();
  ids.proyectoA = randomUUID();
  ids.proyectoB = randomUUID();
  ids.documentoB = randomUUID();
  ids.suscripcionA = randomUUID();
  ids.suscripcionB = randomUUID();
  ids.pagoA = randomUUID();
  ids.licenciaA = randomUUID();

  const correoA = `cliente-a-${corrida}@prueba.test`;
  const correoB = `cliente-b-${corrida}@prueba.test`;
  const correoAdmin = `admin-${corrida}@prueba.test`;

  await db.query("begin");
  try {
    const usuarios = [
      [ids.usuarioA, correoA, "A", "cliente"],
      [ids.usuarioB, correoB, "B", "cliente"],
      [ids.usuarioAdmin, correoAdmin, "Administración", "admin"],
    ];
    for (const [id, correo, nombre, rol] of usuarios) {
      await db.query(
        `insert into usuarios (id, correo, clave_hash, nombre, rol, correo_verificado)
         values ($1, $2, $3, $4, $5, true)`,
        [id, correo, sha(`clave-${id}`), nombre, rol],
      );
    }

    await db.query(
      `insert into clientes (id, usuario_id, razon_social, documento_tipo, documento_numero,
                             domicilio_fiscal, telefono, correo_factura)
       values ($1, $2, 'Cliente A', 'RIF', $3, 'Caracas', '+584120000001', $4)`,
      [ids.clienteA, ids.usuarioA, documento(ids.clienteA), correoA],
    );
    await db.query(
      `insert into clientes (id, usuario_id, razon_social, documento_tipo, documento_numero,
                             domicilio_fiscal, telefono, correo_factura)
       values ($1, $2, 'Cliente B', 'RIF', $3, 'Caracas', '+584120000002', $4)`,
      [ids.clienteB, ids.usuarioB, documento(ids.clienteB), correoB],
    );

    await db.query(
      `insert into representantes (id, nombre, documento, correo, png, sha256, utc)
       values ($1, 'Representante Blink', 'V-00000000', 'business@blink.com.ve', $2, $3, now())`,
      [ids.representante, Buffer.from("png-representante"), sha("png-representante")],
    );

    await db.query(
      `insert into firmas_cliente (id, cliente_id, png, sha256, ip, agente, utc,
                                   metodo, version, hash_consentimiento)
       values ($1, $2, $3, $4, '127.0.0.1', 'prueba', now(), 'simple_reforzada', 1, $5)`,
      [ids.firmaA, ids.clienteA, Buffer.from("png-firma-a"), sha("png-firma-a"), sha("consentimiento-a")],
    );
    await db.query(
      `insert into firmas_cliente (id, cliente_id, png, sha256, ip, agente, utc,
                                   metodo, version, hash_consentimiento)
       values ($1, $2, $3, $4, '127.0.0.1', 'prueba', now(), 'simple_reforzada', 1, $5)`,
      [ids.firmaB, ids.clienteB, Buffer.from("png-firma-b"), sha("png-firma-b"), sha("consentimiento-b")],
    );
    await db.query("update clientes set firma_actual = $1 where id = $2", [ids.firmaA, ids.clienteA]);
    await db.query("update clientes set firma_actual = $1 where id = $2", [ids.firmaB, ids.clienteB]);

    for (let i = 1; i <= 3; i += 1) {
      await db.query(
        `insert into plantillas (codigo, version, contenido, sha256)
         values ($1, 1, $2::jsonb, $3)`,
        [`PRUEBA-${i}`, JSON.stringify({ prueba: i }), sha(`plantilla-${i}`)],
      );
    }

    const buzones = JSON.stringify([{ direccion: `no-reply@prueba-${corrida}.test`, funcion: "no-reply" }]);
    for (const [id, cliente, nombre, dominio] of [
      [ids.proyectoA, ids.clienteA, "Proyecto A", `a-${corrida}.test`],
      [ids.proyectoB, ids.clienteB, "Proyecto B", `b-${corrida}.test`],
    ]) {
      await db.query(
        `insert into proyectos (id, cliente_id, nombre, categoria, dominio, buzones,
                                alcance, complejidad, plan_clave, plan_nivel, plan_version)
         values ($1, $2, $3, 'web', $4, $5::jsonb, 'Alcance de prueba', 'simple',
                 'supabase', 'inicial', 1)`,
        [id, cliente, nombre, dominio, buzones],
      );
    }

    // Cadena de tres documentos para el proyecto A.
    let anterior = "GENESIS";
    ids.documentosA = [];
    for (let orden = 1; orden <= 3; orden += 1) {
      const id = randomUUID();
      const sello = sha(`sello-a-${orden}`);
      const cadena = hashCadena(anterior, sello, orden);
      await db.query(
        `insert into documentos (id, proyecto_id, plantilla_codigo, plantilla_version, orden,
                                 pdf, sello, hash_archivo, hash_anterior, hash_cadena)
         values ($1, $2, $3, 1, $4, $5, $6, $7, $8, $9)`,
        [
          id,
          ids.proyectoA,
          `PRUEBA-${orden}`,
          orden,
          Buffer.from(`pdf-a-${orden}`),
          sello,
          sha(`pdf-a-${orden}`),
          anterior,
          cadena,
        ],
      );
      ids.documentosA.push(id);
      anterior = cadena;
    }
    ids.documentoA1 = ids.documentosA[0];

    const selloB = sha("sello-b-1");
    await db.query(
      `insert into documentos (id, proyecto_id, plantilla_codigo, plantilla_version, orden,
                               pdf, sello, hash_archivo, hash_anterior, hash_cadena)
       values ($1, $2, 'PRUEBA-1', 1, 1, $3, $4, $5, 'GENESIS', $6)`,
      [
        ids.documentoB,
        ids.proyectoB,
        Buffer.from("pdf-b-1"),
        selloB,
        sha("pdf-b-1"),
        hashCadena("GENESIS", selloB, 1),
      ],
    );

    await db.query(
      `insert into actos_firma (documento_id, firmante, representante_id, sello, utc)
       values ($1, 'representante', $2, $3, now())`,
      [ids.documentoA1, ids.representante, sha("acto-representante")],
    );
    await db.query(
      `insert into actos_firma (documento_id, firmante, firma_id, sello, utc)
       values ($1, 'cliente', $2, $3, now())`,
      [ids.documentoA1, ids.firmaA, sha("acto-cliente-a")],
    );
    await db.query(
      `insert into actos_firma (documento_id, firmante, firma_id, sello, utc)
       values ($1, 'cliente', $2, $3, now())`,
      [ids.documentoB, ids.firmaB, sha("acto-cliente-b")],
    );

    await db.query(
      `insert into envios (documento_id, proveedor, mensaje_id, clave_idempotencia, estado)
       values ($1, 'archivo', 'msg-a', $2, 'enviado'), ($3, 'archivo', 'msg-b', $4, 'enviado')`,
      [ids.documentoA1, `envio-a-${corrida}`, ids.documentoB, `envio-b-${corrida}`],
    );

    const evento = await db.query(
      `insert into eventos (actor, rol, accion, entidad, entidad_id)
       values ($1, 'cliente', 'prueba.sembrada', 'proyectos', $2)
       returning id`,
      [ids.usuarioB, ids.proyectoB],
    );
    ids.eventoB = evento.rows[0].id;

    for (const [id, proyecto, monto] of [
      [ids.suscripcionA, ids.proyectoA, 31],
      [ids.suscripcionB, ids.proyectoB, 30],
    ]) {
      await db.query(
        `insert into suscripciones (id, proyecto_id, plan_clave, plan_nivel, plan_version,
                                    monto_usd, dia_cobro, proximo_vencimiento)
         values ($1, $2, 'supabase', 'inicial', 1, $3, 1, '2026-12-01')`,
        [id, proyecto, monto],
      );
    }

    await db.query(
      `insert into pagos (id, suscripcion_id, periodo, monto, moneda, tasa_bcv,
                          referencia, fecha, estado)
       values ($1, $2, '2026-11', 31, 'USD', 36.5000, 'ref-inicial', '2026-11-11', 'registrado')`,
      [ids.pagoA, ids.suscripcionA],
    );

    await db.query(
      `insert into licencias (id, proyecto_id, tipo, alcance, inicio, condiciones)
       values ($1, $2, 'uso', 'Uso del software para el negocio del cliente', '2026-11-11',
               'Licencia de uso; el código es de Blink')`,
      [ids.licenciaA, ids.proyectoA],
    );

    await db.query(
      `insert into limites (clave, intentos, expira)
       values ($1, 0, now() + interval '1 hour')`,
      [`prueba:${corrida}`],
    );

    await db.query("commit");
  } catch (error) {
    await db.query("rollback").catch(() => {});
    throw error;
  }
}

async function principal() {
  const variables = cargarEnv();
  const urlDueno = exigir(variables, "DATABASE_URL_PRUEBAS");
  const urlApp = exigir(variables, "DATABASE_URL_PRUEBAS_APP");
  const urlMain = variables.DATABASE_URL;
  if (urlMain && new URL(urlMain).hostname === new URL(urlDueno).hostname) {
    throw new Error("DATABASE_URL_PRUEBAS apunta a la misma base que DATABASE_URL. Aborto.");
  }

  corrida = Date.now().toString(36);
  db = new pg.Client({ connectionString: urlDueno, application_name: "bws-pruebas" });
  app = new pg.Client({ connectionString: urlApp, application_name: "bws-pruebas-app" });
  await db.connect();
  await app.connect();

  try {
    await limpiar();
    await sembrar();

    const correos = (await db.query(
      "select id, correo from usuarios where id = any($1::uuid[])",
      [[ids.usuarioA, ids.usuarioB]],
    )).rows;
    ids.correoA = correos.find((f) => f.id === ids.usuarioA).correo;

    await prueba("planes_infra coincide con legal/planes.ts y respeta costo + margen", async () => {
      const filas = (await db.query(
        `select clave, nivel, version, nombre, limites, precio_usd::text as precio,
                costo_usd::text as costo, margen_usd::text as margen, estado
         from planes_infra order by clave, nivel, version`,
      )).rows;
      afirmar(filas.length === 4, `se esperaban 4 presets y hay ${filas.length}`);
      for (const preset of PRESETS) {
        for (const nivel of preset.niveles) {
          const fila = filas.find(
            (f) => f.clave === preset.clave && f.nivel === nivel.clave && f.version === 1,
          );
          afirmar(fila, `falta el preset ${preset.clave}/${nivel.clave}`);
          afirmar(fila.nombre === nivel.nombre, `${preset.clave}/${nivel.clave}: nombre distinto`);
          afirmar(
            Number(fila.precio) === nivel.precio_usd,
            `${preset.clave}/${nivel.clave}: precio ${fila.precio} ≠ ${nivel.precio_usd}`,
          );
          afirmar(
            Number(fila.costo) === nivel.costo_estimado_usd,
            `${preset.clave}/${nivel.clave}: costo distinto`,
          );
          afirmar(
            Number(fila.margen) === nivel.margen_usd,
            `${preset.clave}/${nivel.clave}: margen distinto`,
          );
          afirmar(
            Number(fila.precio) === Number(fila.costo) + Number(fila.margen),
            `${preset.clave}/${nivel.clave}: precio ≠ costo + margen`,
          );
          afirmar(fila.estado === "vigente", `${preset.clave}/${nivel.clave}: no está vigente`);
          if (nivel.clave === "pro") {
            afirmar(Number(fila.precio) >= 30, `${preset.clave}/pro: no respeta el piso de USD 30`);
          }
          afirmar(
            Array.isArray(fila.limites) && fila.limites.length === nivel.limites.length,
            `${preset.clave}/${nivel.clave}: cantidad de límites distinta`,
          );
          nivel.limites.forEach((limite, i) => {
            afirmar(
              fila.limites[i].concepto === limite.concepto &&
                fila.limites[i].valor === limite.valor,
              `${preset.clave}/${nivel.clave}: límite ${i + 1} distinto`,
            );
          });
        }
      }
      const vigentes = new Map();
      for (const fila of filas.filter((f) => f.estado === "vigente")) {
        const clave = `${fila.clave}/${fila.nivel}`;
        vigentes.set(clave, (vigentes.get(clave) ?? 0) + 1);
      }
      for (const [clave, cantidad] of vigentes) {
        afirmar(cantidad === 1, `${clave} tiene ${cantidad} versiones vigentes`);
      }
    });

    await prueba("no hay tablas fuera de plan", async () => {
      const nombres = new Set(
        (await db.query(
          `select table_name from information_schema.tables
           where table_schema = 'public' and table_type = 'BASE TABLE'`,
        )).rows.map((f) => f.table_name),
      );
      const sobran = [...nombres].filter((n) => !ESPERADAS.has(n));
      const faltan = [...ESPERADAS].filter((n) => !nombres.has(n));
      afirmar(!sobran.length, `tablas fuera de plan: ${sobran.join(", ")}`);
      afirmar(!faltan.length, `faltan tablas: ${faltan.join(", ")}`);
    });

    await prueba("bws_app sin DDL, sin superusuario y sin tocar lo inmutable", async () => {
      const rol = (await app.query(
        `select current_user as usuario, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls
         from pg_roles where rolname = current_user`,
      )).rows[0];
      afirmar(rol.usuario === "bws_app", `la conexión de la API usa ${rol.usuario}`);
      afirmar(
        !rol.rolsuper && !rol.rolcreatedb && !rol.rolcreaterole && !rol.rolbypassrls,
        "bws_app tiene privilegios de administración",
      );
      await esperarError(app, "42501", "create table bws_prueba_ddl (id int)");
      const privilegios = (await app.query(
        `select has_table_privilege(current_user, 'firmas_cliente', 'INSERT') as firma_insert,
                has_table_privilege(current_user, 'firmas_cliente', 'UPDATE') as firma_update,
                has_table_privilege(current_user, 'usuarios', 'DELETE') as usuario_delete,
                has_table_privilege(current_user, 'proyectos', 'UPDATE') as proyecto_update,
                has_table_privilege(current_user, 'proyectos', 'DELETE') as proyecto_delete`,
      )).rows[0];
      afirmar(privilegios.firma_insert && privilegios.proyecto_update, "bws_app no puede escribir lo que debe");
      afirmar(!privilegios.firma_update, "bws_app puede editar firmas");
      afirmar(!privilegios.usuario_delete, "bws_app puede borrar usuarios");
      afirmar(!privilegios.proyecto_delete, "bws_app puede borrar proyectos");
    });

    await prueba("RLS: el cliente A solo ve lo suyo", async () => {
      await como(ids.usuarioA, "cliente", async (c) => {
        const uno = async (sql, esperado, que) => {
          const filas = (await c.query(sql)).rows;
          afirmar(filas.length === esperado, `${que}: se esperaban ${esperado} filas y hay ${filas.length}`);
          return filas;
        };
        const proyectos = await uno("select id from proyectos", 1, "proyectos");
        afirmar(proyectos[0].id === ids.proyectoA, "el proyecto visible no es el de A");
        const documentos = await uno("select id from documentos", 3, "documentos");
        afirmar(
          documentos.every((d) => ids.documentosA.includes(d.id)),
          "A ve documentos ajenos",
        );
        await uno("select id from clientes", 1, "clientes");
        await uno("select id from usuarios", 1, "usuarios");
        await uno("select id from firmas_cliente", 1, "firmas");
        await uno("select id from actos_firma", 2, "actos");
        await uno("select id from envios", 1, "envíos");
        await uno("select id from suscripciones", 1, "suscripciones");
        await uno("select id from pagos", 1, "pagos");
        await uno("select id from licencias", 1, "licencias");
        await uno("select id from eventos", 0, "eventos");
        await uno("select id from representantes", 0, "representantes");
        const ajeno = await c.query("select id from documentos where id = $1", [ids.documentoB]);
        afirmar(ajeno.rowCount === 0, "A puede leer un documento de B por identificador");
        const planes = await c.query("select clave from planes_infra");
        afirmar(planes.rowCount === 4, "los presets deben ser de lectura general");
        await esperarErrorEn(
          c,
          "42501",
          `insert into proyectos (cliente_id, nombre, categoria, dominio, buzones,
                                  alcance, complejidad, plan_clave, plan_nivel, plan_version)
           values ($1, 'Intruso', 'web', $2,
                   '[{"direccion":"no-reply@intruso.test"}]'::jsonb,
                   'Alcance', 'simple', 'supabase', 'inicial', 1)`,
          [ids.clienteB, `intruso-${corrida}.test`],
        );
      });
    });

    await prueba("RLS: el cliente B no ve el expediente de A", async () => {
      await como(ids.usuarioB, "cliente", async (c) => {
        const proyectos = (await c.query("select id from proyectos")).rows;
        afirmar(proyectos.length === 1 && proyectos[0].id === ids.proyectoB, "B ve proyectos ajenos");
        const documentos = (await c.query("select id from documentos")).rows;
        afirmar(documentos.length === 1 && documentos[0].id === ids.documentoB, "B ve documentos ajenos");
        const firmas = (await c.query("select id from firmas_cliente")).rows;
        afirmar(firmas.length === 1 && firmas[0].id === ids.firmaB, "B ve firmas ajenas");
        const pagos = await c.query("select id from pagos");
        afirmar(pagos.rowCount === 0, "B ve pagos ajenos");
      });
    });

    await prueba("RLS: la administración ve todo", async () => {
      await como(ids.usuarioAdmin, "admin", async (c) => {
        afirmar((await c.query("select id from proyectos")).rowCount === 2, "admin no ve los dos proyectos");
        afirmar((await c.query("select id from documentos")).rowCount === 4, "admin no ve los cuatro documentos");
        afirmar((await c.query("select id from clientes")).rowCount === 2, "admin no ve los dos clientes");
        afirmar((await c.query("select id from usuarios")).rowCount === 3, "admin no ve los tres usuarios");
        afirmar((await c.query("select id from eventos")).rowCount >= 1, "admin no ve los eventos");
        afirmar((await c.query("select id from representantes")).rowCount === 1, "admin no ve al representante");
        afirmar((await c.query("select id from pagos")).rowCount === 1, "admin no ve los pagos");
      });
    });

    await prueba("un cliente no puede elevar su rol ni editar a otro", async () => {
      await como(ids.usuarioA, "cliente", async (c) => {
        await esperarErrorEn(c, "42501", "update usuarios set rol = 'admin' where id = $1", [ids.usuarioA]);
        await esperarErrorEn(
          c,
          "42501",
          "update usuarios set correo_verificado = false, bloqueado = true where id = $1",
          [ids.usuarioA],
        );
        const propio = await c.query("update usuarios set nombre = 'Nombre corregido' where id = $1", [ids.usuarioA]);
        afirmar(propio.rowCount === 1, "A no puede corregir su propio nombre");
        const ajeno = await c.query("update usuarios set nombre = 'Intruso' where id = $1", [ids.usuarioB]);
        afirmar(ajeno.rowCount === 0, "A pudo editar al usuario B");
      });
    });

    await prueba("las tablas de solo agregar rechazan UPDATE y DELETE", async () => {
      const casos = [
        ["firmas_cliente", "update firmas_cliente set motivo = 'reintento' where id = $1", [ids.firmaA]],
        ["actos_firma", "update actos_firma set agente = 'otro' where documento_id = $1", [ids.documentoA1]],
        ["documentos", "update documentos set estado = 'enviado' where id = $1", [ids.documentoA1]],
        ["envios", "update envios set estado = 'fallido' where documento_id = $1", [ids.documentoA1]],
        ["eventos", "update eventos set accion = 'alterada' where id = $1", [ids.eventoB]],
        ["representantes", "update representantes set nombre = 'Otro' where id = $1", [ids.representante]],
        ["pagos", "update pagos set monto = 1 where id = $1", [ids.pagoA]],
      ];
      for (const [tabla, sql, parametros] of casos) {
        const error = await esperarError(db, "42501", sql, parametros);
        afirmar(
          String(error.message).includes("solo agregar"),
          `${tabla}: el rechazo no explica que es de solo agregar`,
        );
      }
      for (const [sql, parametros] of [
        ["delete from eventos where id = $1", [ids.eventoB]],
        ["delete from documentos where id = $1", [ids.documentoA1]],
        ["delete from pagos where id = $1", [ids.pagoA]],
        ["delete from representantes where id = $1", [ids.representante]],
      ]) {
        await esperarError(db, "42501", sql, parametros);
      }
    });

    await prueba("una plantilla publicada no se edita ni se borra", async () => {
      await db.query("begin");
      try {
        await esperarErrorEn(
          db,
          "42501",
          "update plantillas set contenido = '{\"otro\": true}'::jsonb where codigo = 'PRUEBA-1'",
        );
        await esperarErrorEn(db, "42501", "delete from plantillas where codigo = 'PRUEBA-1'");
        const apagada = await db.query("update plantillas set activa = false where codigo = 'PRUEBA-3'");
        afirmar(apagada.rowCount === 1, "no se puede apagar una plantilla");
        await esperarErrorEn(
          db,
          "42501",
          "update plantillas set activa = true where codigo = 'PRUEBA-3'",
        );
      } finally {
        await db.query("rollback");
      }
    });

    await prueba("la cadena de documentos es continua y recalculable", async () => {
      const docs = (await db.query(
        `select orden, sello, hash_anterior, hash_cadena
         from documentos where proyecto_id = $1 order by orden`,
        [ids.proyectoA],
      )).rows;
      afirmar(docs.length === 3, `se esperaban 3 documentos y hay ${docs.length}`);
      let anterior = "GENESIS";
      for (const doc of docs) {
        afirmar(doc.hash_anterior === anterior, `el eslabón ${doc.orden} no apunta al anterior`);
        const esperado = hashCadena(anterior, doc.sello, doc.orden);
        afirmar(doc.hash_cadena === esperado, `el eslabón ${doc.orden} no recalcula igual`);
        anterior = doc.hash_cadena;
      }
    });

    await prueba("doble firma y segunda firma original rechazadas", async () => {
      await db.query("begin");
      try {
        await esperarErrorEn(
          db,
          "23505",
          `insert into actos_firma (documento_id, firmante, firma_id, sello, utc)
           values ($1, 'cliente', $2, $3, now())`,
          [ids.documentoA1, ids.firmaA, sha("acto-duplicado")],
        );
        await esperarErrorEn(
          db,
          "23505",
          `insert into firmas_cliente (cliente_id, png, sha256, utc, metodo, version, hash_consentimiento)
           values ($1, $2, $3, now(), 'simple_reforzada', 2, $4)`,
          [ids.clienteA, Buffer.from("otra-firma"), sha("otra-firma"), sha("consentimiento-2")],
        );
        await esperarErrorEn(
          db,
          "23514",
          `insert into actos_firma (documento_id, firmante, sello, utc)
           values ($1, 'cliente', $2, now())`,
          [ids.documentoA1, sha("acto-sin-origen")],
        );

        // El reemplazo sí se permite: fila nueva, motivo y puntero.
        const nueva = randomUUID();
        await db.query(
          `insert into firmas_cliente (id, cliente_id, png, sha256, utc, metodo, version,
                                       hash_consentimiento, motivo, reemplaza_a)
           values ($1, $2, $3, $4, now(), 'simple_reforzada', 2, $5, 'trazo ilegible', $6)`,
          [nueva, ids.clienteA, Buffer.from("firma-nueva"), sha("firma-nueva"), sha("consentimiento-3"), ids.firmaA],
        );
        const movido = await db.query("update clientes set firma_actual = $1 where id = $2", [
          nueva,
          ids.clienteA,
        ]);
        afirmar(movido.rowCount === 1, "no se puede mover el puntero a la firma de reemplazo");
        await esperarErrorEn(db, "23514", "update clientes set firma_actual = $1 where id = $2", [
          ids.firmaB,
          ids.clienteA,
        ]);
      } finally {
        await db.query("rollback");
      }
    });

    await prueba("el alcance enviado queda congelado y no vuelve a borrador", async () => {
      await db.query("begin");
      try {
        const enviado = await db.query(
          "update proyectos set estado = 'enviado', enviado = now() where id = $1",
          [ids.proyectoA],
        );
        afirmar(enviado.rowCount === 1, "no se pudo enviar el proyecto");
        await esperarErrorEn(db, "42501", "update proyectos set alcance = 'Otro alcance' where id = $1", [
          ids.proyectoA,
        ]);
        await esperarErrorEn(db, "42501", "update proyectos set plan_nivel = 'pro' where id = $1", [
          ids.proyectoA,
        ]);
        await esperarErrorEn(db, "42501", "update proyectos set estado = 'borrador' where id = $1", [
          ids.proyectoA,
        ]);
        const aprobado = await db.query("update proyectos set estado = 'aprobado' where id = $1", [
          ids.proyectoA,
        ]);
        afirmar(aprobado.rowCount === 1, "un proyecto enviado debe poder avanzar de estado");
      } finally {
        await db.query("rollback");
      }
    });

    await prueba("un pago no se edita ni se borra: se anula con una fila nueva", async () => {
      await db.query("begin");
      try {
        await esperarErrorEn(
          db,
          "23514",
          `insert into pagos (suscripcion_id, periodo, monto, moneda, referencia, fecha, estado, motivo)
           values ($1, '2026-10', 31, 'USD', 'ref-sin-origen', '2026-10-01', 'anulado', 'sin referencia')`,
          [ids.suscripcionA],
        );
        const anulacion = randomUUID();
        await db.query(
          `insert into pagos (id, suscripcion_id, periodo, monto, moneda, tasa_bcv,
                              referencia, fecha, estado, anulacion_de, motivo)
           values ($1, $2, '2026-11', 31, 'USD', 36.5000, 'ref-anulacion', '2026-11-11',
                   'anulado', $3, 'monto duplicado')`,
          [anulacion, ids.suscripcionA, ids.pagoA],
        );
        await esperarErrorEn(
          db,
          "23505",
          `insert into pagos (suscripcion_id, periodo, monto, moneda, referencia, fecha,
                              estado, anulacion_de, motivo)
           values ($1, '2026-11', 31, 'USD', 'ref-otra', '2026-11-11', 'anulado', $2, 'otra anulación')`,
          [ids.suscripcionA, ids.pagoA],
        );
      } finally {
        await db.query("rollback");
      }
    });

    await prueba("los límites de intentos se escriben antes de autenticar", async () => {
      await como(null, "", async (c) => {
        const clave = `prueba:${corrida}`;
        const alta = await c.query(
          `insert into limites (clave, intentos, expira)
           values ($1, 0, now() + interval '1 hour')
           on conflict (clave) do update set intentos = limites.intentos + 1`,
          [clave],
        );
        afirmar(alta.rowCount === 1, "un anónimo no puede registrar un intento");
        const subida = await c.query("update limites set intentos = intentos + 1 where clave = $1", [clave]);
        afirmar(subida.rowCount === 1, "un anónimo no puede sumar un intento");
      });
    });

    await prueba("las credenciales se leen sin abrir usuarios", async () => {
      await como(null, "", async (c) => {
        const fila = await c.query("select id, rol from bws_credenciales($1)", [ids.correoA.toUpperCase()]);
        afirmar(fila.rowCount === 1 && fila.rows[0].id === ids.usuarioA, "bws_credenciales no encontró a A");
        afirmar(fila.rows[0].rol === "cliente", "bws_credenciales devolvió un rol inesperado");
        const usuarios = await c.query("select count(*)::int as n from usuarios");
        afirmar(usuarios.rows[0].n === 0, "un anónimo puede leer la tabla usuarios");
        const firma = await c.query("select count(*)::int as n from firmas_cliente");
        afirmar(firma.rows[0].n === 0, "un anónimo puede leer firmas");
      });
    });

    await limpiar();

    await prueba("las migraciones son idempotentes", async () => {
      const ruta = new URL("./db-migrar.mjs", import.meta.url);
      const salida = execFileSync(process.execPath, [ruta.pathname], {
        cwd: new URL("..", import.meta.url).pathname,
        env: { ...process.env, DATABASE_URL: urlDueno },
        encoding: "utf8",
      });
      afirmar(/8 migraciones al día/.test(salida), `salida inesperada de db-migrar: ${salida.trim().slice(-200)}`);
      afirmar(!/✗/.test(salida), "db-migrar reportó un fallo al reejecutarse");
      const aplicadas = await db.query("select count(*)::int as n from migraciones");
      afirmar(aplicadas.rows[0].n === 8, `hay ${aplicadas.rows[0].n} migraciones registradas`);
    });
  } finally {
    await limpiar().catch(() => {});
    await db.end().catch(() => {});
    await app.end().catch(() => {});
  }

  const fallidas = resultados.filter((r) => !r.ok);
  console.log(
    `\n${fallidas.length ? "✗" : "✓"} ${resultados.length - fallidas.length}/${resultados.length} pruebas en verde.`,
  );
  if (fallidas.length) process.exitCode = 1;
}

principal().catch((error) => {
  console.error(`✗ ${error.message}`);
  process.exitCode = 1;
});
