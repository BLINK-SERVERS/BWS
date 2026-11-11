-- ============================================================
-- 0007 — Lecturas y cambios que ocurren antes de tener sesión
-- ------------------------------------------------------------
-- El rol de aplicación no puede leer `sesiones`, `tokens_correo` ni
-- `usuarios` sin identidad: las políticas RLS lo impiden. Estas tres
-- funciones son la única puerta y hacen una sola cosa cada una:
--
--   · validar un token de sesión y devolver quién es;
--   · consumir un token de verificación y marcar el correo;
--   · consumir un token de recuperación, cambiar la clave y cerrar
--     todas las sesiones del usuario.
--
-- Son SECURITY DEFINER y solo `bws_app` las ejecuta. No aceptan un
-- identificador de usuario: solo el hash de un token de un solo uso.
-- ============================================================

create or replace function bws_sesion_valida(p_token_hash text)
returns table (
  usuario_id uuid,
  rol text,
  nombre text,
  correo text,
  verificado boolean,
  expira timestamptz
)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select u.id, u.rol, u.nombre, u.correo, u.correo_verificado, s.expira
  from sesiones s
  join usuarios u on u.id = s.usuario_id
  where s.token_hash = p_token_hash
    and s.revocada = false
    and s.expira > now()
    and u.bloqueado = false
$$;

create or replace function bws_verificar_correo(p_token_hash text)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid;
begin
  update tokens_correo
     set usado = true
   where token_hash = p_token_hash
     and tipo = 'verificacion'
     and usado = false
     and expira > now()
  returning usuario_id into v_usuario;

  if v_usuario is null then
    return null;
  end if;

  update usuarios set correo_verificado = true where id = v_usuario;

  insert into eventos (actor, rol, accion, entidad, entidad_id)
  select u.id, u.rol, 'correo.verificado', 'usuarios', u.id::text
  from usuarios u where u.id = v_usuario;

  return v_usuario;
end;
$$;

create or replace function bws_restablecer_clave(p_token_hash text, p_clave_hash text)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid;
begin
  update tokens_correo
     set usado = true
   where token_hash = p_token_hash
     and tipo = 'recuperacion'
     and usado = false
     and expira > now()
  returning usuario_id into v_usuario;

  if v_usuario is null then
    return null;
  end if;

  update usuarios set clave_hash = p_clave_hash where id = v_usuario;
  update sesiones set revocada = true where usuario_id = v_usuario and revocada = false;

  insert into eventos (actor, rol, accion, entidad, entidad_id)
  select u.id, u.rol, 'clave.restablecida', 'usuarios', u.id::text
  from usuarios u where u.id = v_usuario;

  return v_usuario;
end;
$$;

revoke all on function bws_sesion_valida(text) from public;
revoke all on function bws_verificar_correo(text) from public;
revoke all on function bws_restablecer_clave(text, text) from public;

grant execute on function
  bws_sesion_valida(text),
  bws_verificar_correo(text),
  bws_restablecer_clave(text, text)
to bws_app;
