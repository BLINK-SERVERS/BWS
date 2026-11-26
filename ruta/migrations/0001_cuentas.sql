create schema if not exists ruta;
revoke all on schema ruta from public;

create table if not exists ruta.usuarios (
  id uuid primary key default gen_random_uuid(),
  correo text not null unique check (correo = lower(correo) and length(correo) between 5 and 254),
  clave_hash text not null,
  nombre text not null check (char_length(nombre) between 2 and 80),
  ciudad text not null check (ciudad in ('Maracaibo', 'San Francisco')),
  rol text not null default 'particular' check (rol in ('particular', 'concesionario', 'admin')),
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table if not exists ruta.sesiones (
  token_hash text primary key,
  usuario_id uuid not null references ruta.usuarios(id) on delete cascade,
  expira timestamptz not null,
  revocada boolean not null default false,
  ip inet,
  agente text,
  creada_en timestamptz not null default now()
);

create index if not exists sesiones_usuario_idx on ruta.sesiones(usuario_id);
create index if not exists sesiones_expira_idx on ruta.sesiones(expira);

create table if not exists ruta.limites (
  clave text primary key,
  intentos integer not null check (intentos >= 0),
  ventana_inicio timestamptz not null,
  expira timestamptz not null
);

create table if not exists ruta.eventos (
  id uuid primary key default gen_random_uuid(),
  actor uuid references ruta.usuarios(id) on delete set null,
  accion text not null check (char_length(accion) between 3 and 80),
  entidad text not null check (char_length(entidad) between 3 and 80),
  entidad_id uuid,
  detalle jsonb not null default '{}'::jsonb,
  ip inet,
  agente text,
  creado_en timestamptz not null default now()
);

alter table ruta.usuarios enable row level security;
alter table ruta.usuarios force row level security;
alter table ruta.sesiones enable row level security;
alter table ruta.sesiones force row level security;
alter table ruta.eventos enable row level security;
alter table ruta.eventos force row level security;
alter table ruta.limites enable row level security;
alter table ruta.limites force row level security;

drop policy if exists usuarios_propios on ruta.usuarios;
create policy usuarios_propios on ruta.usuarios
  for select to ruta_app
  using (id = nullif(current_setting('app.usuario_id', true), '')::uuid);

drop policy if exists usuarios_actualizar_propios on ruta.usuarios;
create policy usuarios_actualizar_propios on ruta.usuarios
  for update to ruta_app
  using (id = nullif(current_setting('app.usuario_id', true), '')::uuid)
  with check (id = nullif(current_setting('app.usuario_id', true), '')::uuid);

drop policy if exists sesiones_propias on ruta.sesiones;
create policy sesiones_propias on ruta.sesiones
  for select to ruta_app
  using (usuario_id = nullif(current_setting('app.usuario_id', true), '')::uuid);

drop policy if exists sesiones_crear_propias on ruta.sesiones;
create policy sesiones_crear_propias on ruta.sesiones
  for insert to ruta_app
  with check (usuario_id = nullif(current_setting('app.usuario_id', true), '')::uuid);

drop policy if exists sesiones_revocar_propias on ruta.sesiones;
create policy sesiones_revocar_propias on ruta.sesiones
  for update to ruta_app
  using (usuario_id = nullif(current_setting('app.usuario_id', true), '')::uuid)
  with check (usuario_id = nullif(current_setting('app.usuario_id', true), '')::uuid);

drop policy if exists eventos_insertar_propios on ruta.eventos;
create policy eventos_insertar_propios on ruta.eventos
  for insert to ruta_app
  with check (actor = nullif(current_setting('app.usuario_id', true), '')::uuid);

create or replace function ruta.registrar(
  p_correo text,
  p_clave_hash text,
  p_nombre text,
  p_ciudad text
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, ruta
as $$
declare
  v_id uuid;
begin
  insert into ruta.usuarios (correo, clave_hash, nombre, ciudad)
  values (lower(p_correo), p_clave_hash, p_nombre, p_ciudad)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function ruta.credenciales(p_correo text)
returns table (
  id uuid,
  clave_hash text,
  nombre text,
  correo text,
  ciudad text,
  rol text,
  activo boolean
)
language sql
stable
security definer
set search_path = pg_catalog, ruta
as $$
  select u.id, u.clave_hash, u.nombre, u.correo, u.ciudad, u.rol, u.activo
  from ruta.usuarios u
  where u.correo = lower(p_correo);
$$;

create or replace function ruta.sesion_valida(p_token_hash text)
returns table (
  id uuid,
  nombre text,
  correo text,
  ciudad text,
  rol text
)
language sql
stable
security definer
set search_path = pg_catalog, ruta
as $$
  select u.id, u.nombre, u.correo, u.ciudad, u.rol
  from ruta.sesiones s
  join ruta.usuarios u on u.id = s.usuario_id
  where s.token_hash = p_token_hash
    and not s.revocada
    and s.expira > now()
    and u.activo;
$$;

create or replace function ruta.consumir_limite(
  p_clave text,
  p_maximo integer,
  p_ventana_segundos integer
) returns table (permitido boolean, restantes integer, expira timestamptz)
language plpgsql
security definer
set search_path = pg_catalog, ruta
as $$
declare
  v_intentos integer;
  v_expira timestamptz;
begin
  insert into ruta.limites (clave, intentos, ventana_inicio, expira)
  values (
    p_clave,
    1,
    now(),
    now() + make_interval(secs => p_ventana_segundos)
  )
  on conflict (clave) do update set
    intentos = case when ruta.limites.expira <= now() then 1 else ruta.limites.intentos + 1 end,
    ventana_inicio = case when ruta.limites.expira <= now() then now() else ruta.limites.ventana_inicio end,
    expira = case when ruta.limites.expira <= now()
      then now() + make_interval(secs => p_ventana_segundos)
      else ruta.limites.expira
    end
  returning limites.intentos, limites.expira into v_intentos, v_expira;

  return query select v_intentos <= p_maximo, greatest(0, p_maximo - v_intentos), v_expira;
end;
$$;

create or replace function ruta.eventos_inmutables()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Los eventos de Ruta son append-only';
end;
$$;

drop trigger if exists eventos_sin_cambios on ruta.eventos;
create trigger eventos_sin_cambios
before update or delete on ruta.eventos
for each row execute function ruta.eventos_inmutables();

revoke all on function ruta.registrar(text, text, text, text) from public;
revoke all on function ruta.credenciales(text) from public;
revoke all on function ruta.sesion_valida(text) from public;
revoke all on function ruta.consumir_limite(text, integer, integer) from public;
revoke all on function ruta.eventos_inmutables() from public;

grant usage on schema ruta to ruta_app;
grant execute on function ruta.registrar(text, text, text, text) to ruta_app;
grant execute on function ruta.credenciales(text) to ruta_app;
grant execute on function ruta.sesion_valida(text) to ruta_app;
grant execute on function ruta.consumir_limite(text, integer, integer) to ruta_app;
grant select, update on ruta.usuarios to ruta_app;
grant select, insert, update on ruta.sesiones to ruta_app;
grant insert on ruta.eventos to ruta_app;
