-- ============================================================
-- 0006 — Rol de aplicación y permisos
-- ------------------------------------------------------------
-- `bws_app` puede leer y escribir filas, pero no crear objetos,
-- no saltarse RLS y no modificar ni borrar lo que es de solo
-- agregar. La contraseña se asigna fuera de la migración.
-- ============================================================

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'bws_app') then
    create role bws_app login nosuperuser nocreatedb nocreaterole noinherit;
  end if;
end $$;

-- Los límites de tiempo y el search_path se fijan por conexión en la API
-- (`SET statement_timeout`, `SET lock_timeout`): el dueño del proyecto no
-- es superusuario y no puede alterar un rol creado por Neon.

revoke create on schema public from public;
revoke create on schema public from bws_app;
grant usage on schema public to bws_app;

grant select, insert, update, delete on all tables in schema public to bws_app;
grant usage, select on all sequences in schema public to bws_app;

-- Solo agregar: sin UPDATE ni DELETE.
revoke update, delete on
  firmas_cliente,
  actos_firma,
  documentos,
  envios,
  eventos,
  representantes,
  pagos
from bws_app;

-- Sin borrado en el resto; la corrección se hace con una fila nueva.
revoke delete on
  usuarios,
  sesiones,
  tokens_correo,
  clientes,
  proyectos,
  plantillas,
  planes_infra,
  suscripciones,
  licencias
from bws_app;

-- Los ayudantes de RLS son SECURITY DEFINER: solo el rol de la
-- aplicación los ejecuta.
revoke all on function bws_usuario_id() from public;
revoke all on function bws_es_admin() from public;
revoke all on function bws_cliente_id() from public;
revoke all on function bws_proyecto_propio(uuid) from public;
revoke all on function bws_documento_propio(uuid) from public;
revoke all on function bws_suscripcion_propia(uuid) from public;

grant execute on function
  bws_usuario_id(),
  bws_es_admin(),
  bws_cliente_id(),
  bws_proyecto_propio(uuid),
  bws_documento_propio(uuid),
  bws_suscripcion_propia(uuid),
  bws_credenciales(text)
to bws_app;
