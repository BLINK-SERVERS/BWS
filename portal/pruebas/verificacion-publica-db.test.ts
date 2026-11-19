import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

// Optativa: usa solo una imagen ya local, sin red, puertos, volúmenes ni datos existentes.
test("función pública y RLS en PostgreSQL desechable", {
  skip: process.env.BWS_TEST_POSTGRES_DOCKER !== "1",
  timeout: 120_000,
}, () => {
  const migraciones = [
    "0001_esquema.sql", "0002_inmutabilidad.sql", "0003_indices.sql", "0004_rls.sql",
    "0006_rol.sql", "0013_ficha_diferida.sql", "0014_ajuste_documento.sql",
    "0015_verificacion_publica.sql", "0017_contexto_sello.sql", "0019_nombre_archivo_documento.sql",
  ];
  const preparar = `
    create role bws_owner login nosuperuser nocreatedb nocreaterole noinherit;
    create role bws_app login nosuperuser nocreatedb nocreaterole noinherit;
    create role sin_permiso login nosuperuser nocreatedb nocreaterole noinherit;
    alter schema public owner to bws_owner;
    set role bws_owner;
  `;
  const sql = [
    preparar,
    ...migraciones.map((nombre) => readFileSync(new URL(`../db/migrations/${nombre}`, import.meta.url), "utf8")),
    readFileSync(new URL("./verificacion-publica.integracion.sql", import.meta.url), "utf8"),
  ].join("\n");
  const resultado = spawnSync("docker", [
    "run", "--rm", "--pull=never", "--network=none", "--user", "postgres", "--entrypoint", "sh", "-i",
    "postgres:16-alpine", "-c",
    "initdb -D /tmp/bws-test-pg --auth=trust --no-instructions >/dev/null && " +
      "pg_ctl -D /tmp/bws-test-pg -l /tmp/bws-test.log -o '-c listen_addresses= -c unix_socket_directories=/tmp' -w start >/dev/null && " +
      "PGHOST=/tmp psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres",
  ], { input: sql, encoding: "utf8", timeout: 110_000 });
  assert.equal(resultado.status, 0, `${resultado.error ?? ""}\n${resultado.stderr}\n${resultado.stdout}`);
});
