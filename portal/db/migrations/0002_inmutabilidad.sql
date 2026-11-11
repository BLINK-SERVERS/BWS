-- ============================================================
-- 0002 — Inmutabilidad y reglas de integridad
-- ------------------------------------------------------------
-- Lo que no se puede editar dentro del sistema se bloquea aquí,
-- no solo en la aplicación. Las tablas de solo agregar rechazan
-- UPDATE y DELETE; la corrección se hace con una fila nueva.
-- ============================================================

create or replace function bws_abortar_cambio() returns trigger
language plpgsql
as $$
begin
  raise exception 'La tabla % es de solo agregar: % no está permitido', TG_TABLE_NAME, TG_OP
    using errcode = '42501';
end;
$$;

-- Firmas, actos, documentos, envíos, eventos, representantes y pagos.
do $$
declare
  tabla text;
begin
  foreach tabla in array array[
    'firmas_cliente', 'actos_firma', 'documentos', 'envios',
    'eventos', 'representantes', 'pagos'
  ]
  loop
    execute format('drop trigger if exists %I on %I', 'bws_solo_agregar', tabla);
    execute format(
      'create trigger %I before update or delete on %I for each row execute function bws_abortar_cambio()',
      'bws_solo_agregar', tabla
    );
  end loop;
end $$;

-- Plantillas: el contenido publicado no se edita ni se borra. Solo se
-- permite apagar la bandera `activa`, en un solo sentido.
create or replace function bws_plantilla_inmutable() returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'DELETE' then
    raise exception 'Una plantilla publicada no se borra' using errcode = '42501';
  end if;

  if new.codigo <> old.codigo
     or new.version <> old.version
     or new.contenido::text <> old.contenido::text
     or new.sha256 <> old.sha256
     or new.publicada <> old.publicada then
    raise exception 'El contenido de una plantilla publicada no se edita: publique otra versión'
      using errcode = '42501';
  end if;

  if old.activa = false and new.activa = true then
    raise exception 'Una plantilla apagada no se reactiva: publique una versión nueva'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists bws_plantilla_inmutable on plantillas;
create trigger bws_plantilla_inmutable
  before update or delete on plantillas
  for each row execute function bws_plantilla_inmutable();

-- La firma apuntada por `clientes.firma_actual` debe pertenecer al mismo
-- cliente. Nunca se reemplaza el trazo: se agrega una firma nueva con
-- motivo y se mueve el puntero.
create or replace function bws_validar_firma_actual() returns trigger
language plpgsql
as $$
begin
  if new.firma_actual is not null and not exists (
    select 1 from firmas_cliente
    where id = new.firma_actual and cliente_id = new.id
  ) then
    raise exception 'La firma % no pertenece al cliente %', new.firma_actual, new.id
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists bws_validar_firma_actual on clientes;
create trigger bws_validar_firma_actual
  before insert or update of firma_actual on clientes
  for each row execute function bws_validar_firma_actual();

-- Un usuario no puede darse permisos ni saltarse un bloqueo desde la
-- aplicación. La ausencia de `app.rol` (procesos del dueño) no se limita.
create or replace function bws_proteger_usuario() returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('app.rol', true), 'admin') <> 'admin' then
    if new.rol <> old.rol
       or new.correo_verificado <> old.correo_verificado
       or new.bloqueado <> old.bloqueado then
      raise exception 'El rol, la verificación y el bloqueo solo los cambia la administración'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists bws_proteger_usuario on usuarios;
create trigger bws_proteger_usuario
  before update on usuarios
  for each row execute function bws_proteger_usuario();

-- El alcance de un proyecto enviado queda congelado. Después solo cambia
-- el estado del flujo, y nunca vuelve a borrador.
create or replace function bws_congelar_proyecto() returns trigger
language plpgsql
as $$
begin
  if old.estado <> 'borrador' then
    if new.estado = 'borrador' then
      raise exception 'Un proyecto enviado no vuelve a borrador' using errcode = '42501';
    end if;
    if new.cliente_id <> old.cliente_id
       or new.nombre <> old.nombre
       or new.categoria <> old.categoria
       or new.dominio <> old.dominio
       or new.buzones::text <> old.buzones::text
       or new.alcance <> old.alcance
       or new.complejidad <> old.complejidad
       or new.plan_clave <> old.plan_clave
       or new.plan_nivel <> old.plan_nivel
       or new.plan_version <> old.plan_version then
      raise exception 'El alcance de un proyecto enviado no se edita'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists bws_congelar_proyecto on proyectos;
create trigger bws_congelar_proyecto
  before update on proyectos
  for each row execute function bws_congelar_proyecto();
