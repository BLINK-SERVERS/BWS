-- ============================================================
-- 0010 — Expediente: domicilio del representante y sello UTC
-- ------------------------------------------------------------
-- BWS-CON-004 exige el domicilio del representante legal, que no
-- estaba en la tabla. El sello de contenido incluye el instante
-- UTC, así que cada documento guarda ese instante aparte: sin él
-- la verificación tendría que adivinarlo a partir de `creado`, que
-- es un milisegundo posterior al sello.
--
-- La función `bws_representante` lee la firma del representante
-- sin abrir la tabla entera a los clientes: la usan únicamente las
-- funciones que arman o verifican un PDF, y la imagen acaba en el
-- documento que el cliente recibe de todos modos.
-- ============================================================

alter table representantes add column if not exists domicilio text;
alter table documentos add column if not exists utc_sello timestamptz;

create or replace function bws_representante(p_id uuid default null)
returns table (
  id uuid,
  nombre text,
  documento text,
  domicilio text,
  correo text,
  png bytea,
  sha256 text,
  utc timestamptz
)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select r.id, r.nombre, r.documento, r.domicilio, r.correo, r.png, r.sha256, r.utc
  from representantes r
  where p_id is null or r.id = p_id
  order by r.utc desc, r.creado desc
  limit 1
$$;

revoke all on function bws_representante(uuid) from public;
grant execute on function bws_representante(uuid) to bws_app;
