import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

// Optativa: imagen local, sin red, puertos, volúmenes Docker ni datos existentes.
test("mora y RLS en PostgreSQL desechable", {
  skip: process.env.BWS_TEST_POSTGRES_DOCKER !== "1",
  timeout: 120_000,
}, () => {
  const migraciones = [
    "0001_esquema.sql", "0002_inmutabilidad.sql", "0003_indices.sql", "0004_rls.sql",
    "0006_rol.sql", "0011_pagos_periodo.sql",
  ];
  const preparar = `
    set client_min_messages = warning;
    create role bws_owner login nosuperuser nocreatedb nocreaterole noinherit;
    create role bws_app login nosuperuser nocreatedb nocreaterole noinherit;
    alter schema public owner to bws_owner;
    set role bws_owner;
  `;
  const prueba = readFileSync(new URL("./mora.integracion.sql", import.meta.url), "utf8");
  const partes = prueba.split("-- APLICAR_MIGRACION_0018");
  assert.equal(partes.length, 2, "Se requiere un único marcador para migrar los datos históricos");
  const sql = [
    preparar,
    ...migraciones.map((nombre) => readFileSync(new URL(`../db/migrations/${nombre}`, import.meta.url), "utf8")),
    partes[0],
    readFileSync(new URL("../db/migrations/0018_mora_contratos_nuevos.sql", import.meta.url), "utf8"),
    partes[1],
  ].join("\n");
  // No permitir que una variable o contexto de Docker dirija la prueba a otro servidor.
  if (process.env.DOCKER_HOST) assert.match(process.env.DOCKER_HOST, /^unix:\/\/\//);
  const contexto = spawnSync("docker", ["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"], {
    encoding: "utf8", timeout: 10_000,
  });
  assert.equal(contexto.status, 0, `${contexto.error ?? ""}\n${contexto.stderr}`);
  const hostContexto = contexto.stdout.trim();
  assert.match(hostContexto, /^unix:\/\/\//, "Docker debe usar un socket local");
  const host = process.env.DOCKER_HOST || hostContexto;
  const entorno = { ...process.env };
  delete entorno.DOCKER_HOST;
  delete entorno.DOCKER_CONTEXT;
  const resultado = spawnSync("docker", [
    "--host", host, "run", "--rm", "--pull=never", "--network=none",
    // La imagen declara VOLUME: tmpfs impide que Docker cree un volumen anónimo.
    "--tmpfs", "/var/lib/postgresql/data", "--user", "postgres", "--entrypoint", "sh", "-i",
    "postgres:16-alpine", "-c",
    "initdb -D /tmp/bws-test-pg --auth=trust --no-instructions >/dev/null && " +
      "pg_ctl -D /tmp/bws-test-pg -l /tmp/bws-test.log -o '-c listen_addresses= -c unix_socket_directories=/tmp' -w start >/dev/null && " +
      "PGHOST=/tmp psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres",
  ], { input: sql, encoding: "utf8", timeout: 110_000, env: entorno });
  assert.equal(resultado.status, 0, `${resultado.error ?? ""}\n${resultado.stderr}\n${resultado.stdout}`);
});
