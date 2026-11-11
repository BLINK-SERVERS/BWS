-- ============================================================
-- 0008 — Rol vacío en las conexiones sin identidad
-- ------------------------------------------------------------
-- Neon entrega `current_setting('app.rol', true)` como cadena
-- vacía, no como NULL, cuando la variable nunca se fijó. El
-- trigger de protección de `usuarios` interpretaba ese caso como
-- «no es administración» y bloqueaba a las funciones SECURITY
-- DEFINER (verificar correo, restablecer clave), que corren sin
-- identidad de aplicación.
--
-- La regla correcta es la misma que se quiso escribir desde el
-- principio: sin `app.rol` —NULL o vacío— el proceso es del dueño
-- y no se limita; con `app.rol = 'cliente'` se bloquea cualquier
-- cambio de rol, verificación o bloqueo.
-- ============================================================

create or replace function bws_proteger_usuario() returns trigger
language plpgsql
as $$
begin
  if coalesce(nullif(current_setting('app.rol', true), ''), 'admin') <> 'admin' then
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
