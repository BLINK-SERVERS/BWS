-- ============================================================
-- 0004 — Aislamiento por fila (RLS)
-- ------------------------------------------------------------
-- El rol de aplicación no ve filas de otro cliente. La API fija
-- `app.usuario_id` y `app.rol` con SET LOCAL dentro de cada
-- transacción; el dueño de las tablas (migraciones, respaldos)
-- queda fuera de RLS.
--
-- RLS es defensa en profundidad, no la única puerta: cada función
-- vuelve a comprobar la autorización.
-- ============================================================

create or replace function bws_usuario_id() returns uuid
language sql stable
as $$ select nullif(current_setting('app.usuario_id', true), '')::uuid $$;

create or replace function bws_es_admin() returns boolean
language sql stable
as $$ select coalesce(current_setting('app.rol', true), '') = 'admin' $$;

-- Devuelve el cliente del usuario en sesión sin volver a pasar por las
-- políticas de `clientes` (evita recursión).
create or replace function bws_cliente_id() returns uuid
language sql stable security definer
set search_path = public, pg_temp
as $$
  select id from clientes where usuario_id = bws_usuario_id()
$$;

create or replace function bws_proyecto_propio(p_proyecto uuid) returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from proyectos p
    join clientes c on c.id = p.cliente_id
    where p.id = p_proyecto and c.usuario_id = bws_usuario_id()
  )
$$;

create or replace function bws_documento_propio(p_documento uuid) returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from documentos d
    join proyectos p on p.id = d.proyecto_id
    join clientes c on c.id = p.cliente_id
    where d.id = p_documento and c.usuario_id = bws_usuario_id()
  )
$$;

create or replace function bws_suscripcion_propia(p_suscripcion uuid) returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from suscripciones s
    join proyectos p on p.id = s.proyecto_id
    join clientes c on c.id = p.cliente_id
    where s.id = p_suscripcion and c.usuario_id = bws_usuario_id()
  )
$$;

-- Única lectura posible de credenciales antes de tener sesión. Evita
-- abrir `usuarios` a una consulta anónima.
create or replace function bws_credenciales(p_correo text)
returns table (
  id uuid,
  clave_hash text,
  rol text,
  correo_verificado boolean,
  bloqueado boolean
)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select u.id, u.clave_hash, u.rol, u.correo_verificado, u.bloqueado
  from usuarios u
  where lower(u.correo) = lower(p_correo)
$$;

revoke all on function bws_credenciales(text) from public;
grant execute on function bws_credenciales(text) to bws_app;

alter table usuarios enable row level security;
alter table sesiones enable row level security;
alter table tokens_correo enable row level security;
alter table clientes enable row level security;
alter table firmas_cliente enable row level security;
alter table representantes enable row level security;
alter table planes_infra enable row level security;
alter table proyectos enable row level security;
alter table plantillas enable row level security;
alter table documentos enable row level security;
alter table actos_firma enable row level security;
alter table eventos enable row level security;
alter table envios enable row level security;
alter table limites enable row level security;
alter table suscripciones enable row level security;
alter table pagos enable row level security;
alter table licencias enable row level security;

-- usuarios
drop policy if exists usuarios_lectura on usuarios;
create policy usuarios_lectura on usuarios
  for select using (id = bws_usuario_id() or bws_es_admin());

drop policy if exists usuarios_alta on usuarios;
create policy usuarios_alta on usuarios
  for insert with check (
    id = bws_usuario_id()
    and rol = 'cliente'
    and correo_verificado = false
    and bloqueado = false
  );

drop policy if exists usuarios_edicion on usuarios;
create policy usuarios_edicion on usuarios
  for update using (id = bws_usuario_id() or bws_es_admin())
  with check (id = bws_usuario_id() or bws_es_admin());

-- sesiones
drop policy if exists sesiones_lectura on sesiones;
create policy sesiones_lectura on sesiones
  for select using (usuario_id = bws_usuario_id() or bws_es_admin());

drop policy if exists sesiones_alta on sesiones;
create policy sesiones_alta on sesiones
  for insert with check (usuario_id = bws_usuario_id() or bws_es_admin());

drop policy if exists sesiones_edicion on sesiones;
create policy sesiones_edicion on sesiones
  for update using (usuario_id = bws_usuario_id() or bws_es_admin())
  with check (usuario_id = bws_usuario_id() or bws_es_admin());

-- tokens de verificación y recuperación
drop policy if exists tokens_lectura on tokens_correo;
create policy tokens_lectura on tokens_correo
  for select using (usuario_id = bws_usuario_id() or bws_es_admin());

drop policy if exists tokens_alta on tokens_correo;
create policy tokens_alta on tokens_correo
  for insert with check (
    usuario_id = bws_usuario_id() or bws_usuario_id() is null or bws_es_admin()
  );

drop policy if exists tokens_edicion on tokens_correo;
create policy tokens_edicion on tokens_correo
  for update using (usuario_id = bws_usuario_id() or bws_es_admin())
  with check (usuario_id = bws_usuario_id() or bws_es_admin());

-- clientes
drop policy if exists clientes_lectura on clientes;
create policy clientes_lectura on clientes
  for select using (usuario_id = bws_usuario_id() or bws_es_admin());

drop policy if exists clientes_alta on clientes;
create policy clientes_alta on clientes
  for insert with check (usuario_id = bws_usuario_id() or bws_es_admin());

drop policy if exists clientes_edicion on clientes;
create policy clientes_edicion on clientes
  for update using (usuario_id = bws_usuario_id() or bws_es_admin())
  with check (usuario_id = bws_usuario_id() or bws_es_admin());

-- firmas del cliente
drop policy if exists firmas_lectura on firmas_cliente;
create policy firmas_lectura on firmas_cliente
  for select using (cliente_id = bws_cliente_id() or bws_es_admin());

drop policy if exists firmas_alta on firmas_cliente;
create policy firmas_alta on firmas_cliente
  for insert with check (cliente_id = bws_cliente_id() or bws_es_admin());

-- representantes de Blink
drop policy if exists representantes_admin on representantes;
create policy representantes_admin on representantes
  for all using (bws_es_admin()) with check (bws_es_admin());

-- planes de infraestructura: lectura general, escritura de administración
drop policy if exists planes_lectura on planes_infra;
create policy planes_lectura on planes_infra
  for select using (true);

drop policy if exists planes_escritura on planes_infra;
create policy planes_escritura on planes_infra
  for all using (bws_es_admin()) with check (bws_es_admin());

-- proyectos
drop policy if exists proyectos_lectura on proyectos;
create policy proyectos_lectura on proyectos
  for select using (bws_proyecto_propio(id) or bws_es_admin());

drop policy if exists proyectos_alta on proyectos;
create policy proyectos_alta on proyectos
  for insert with check (cliente_id = bws_cliente_id() or bws_es_admin());

drop policy if exists proyectos_edicion on proyectos;
create policy proyectos_edicion on proyectos
  for update using (bws_proyecto_propio(id) or bws_es_admin())
  with check (bws_proyecto_propio(id) or bws_es_admin());

-- plantillas: lectura para armar el expediente; escritura de administración
drop policy if exists plantillas_lectura on plantillas;
create policy plantillas_lectura on plantillas
  for select using (true);

drop policy if exists plantillas_escritura on plantillas;
create policy plantillas_escritura on plantillas
  for all using (bws_es_admin()) with check (bws_es_admin());

-- documentos
drop policy if exists documentos_lectura on documentos;
create policy documentos_lectura on documentos
  for select using (bws_proyecto_propio(proyecto_id) or bws_es_admin());

drop policy if exists documentos_alta on documentos;
create policy documentos_alta on documentos
  for insert with check (bws_proyecto_propio(proyecto_id) or bws_es_admin());

-- actos de firma
drop policy if exists actos_lectura on actos_firma;
create policy actos_lectura on actos_firma
  for select using (bws_documento_propio(documento_id) or bws_es_admin());

drop policy if exists actos_alta on actos_firma;
create policy actos_alta on actos_firma
  for insert with check (bws_documento_propio(documento_id) or bws_es_admin());

-- eventos: la administración los lee; el actor registra los suyos
drop policy if exists eventos_lectura on eventos;
create policy eventos_lectura on eventos
  for select using (bws_es_admin());

drop policy if exists eventos_alta on eventos;
create policy eventos_alta on eventos
  for insert with check (bws_es_admin() or actor = bws_usuario_id());

-- envíos
drop policy if exists envios_lectura on envios;
create policy envios_lectura on envios
  for select using (bws_documento_propio(documento_id) or bws_es_admin());

drop policy if exists envios_alta on envios;
create policy envios_alta on envios
  for insert with check (bws_documento_propio(documento_id) or bws_es_admin());

-- límites de intentos: se escriben antes de autenticar
drop policy if exists limites_uso on limites;
create policy limites_uso on limites
  for all using (true) with check (true);

-- suscripciones
drop policy if exists suscripciones_lectura on suscripciones;
create policy suscripciones_lectura on suscripciones
  for select using (bws_proyecto_propio(proyecto_id) or bws_es_admin());

drop policy if exists suscripciones_escritura on suscripciones;
create policy suscripciones_escritura on suscripciones
  for all using (bws_es_admin()) with check (bws_es_admin());

-- pagos
drop policy if exists pagos_lectura on pagos;
create policy pagos_lectura on pagos
  for select using (bws_suscripcion_propia(suscripcion_id) or bws_es_admin());

drop policy if exists pagos_alta on pagos;
create policy pagos_alta on pagos
  for insert with check (bws_es_admin());

-- licencias
drop policy if exists licencias_lectura on licencias;
create policy licencias_lectura on licencias
  for select using (bws_proyecto_propio(proyecto_id) or bws_es_admin());

drop policy if exists licencias_escritura on licencias;
create policy licencias_escritura on licencias
  for all using (bws_es_admin()) with check (bws_es_admin());
