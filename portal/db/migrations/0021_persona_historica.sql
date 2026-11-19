-- Una sola captura explícita para un enviado histórico sin documentos.
-- No rellena filas ni cambia las políticas RLS existentes.
create or replace function bws_congelar_persona_proyecto() returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'UPDATE' and old.estado <> 'borrador' then
    if new.persona_tipo is distinct from old.persona_tipo
       or new.cliente_rep_nombre is distinct from old.cliente_rep_nombre
       or new.cliente_rep_documento is distinct from old.cliente_rep_documento then
      if old.estado = 'enviado' and new.estado = 'enviado'
         and new.enviado is not distinct from old.enviado
         and old.persona_tipo is null and old.cliente_rep_nombre is null
         and old.cliente_rep_documento is null
         and new.persona_tipo in ('natural', 'juridica')
         and current_setting('app.rol', true) = 'cliente'
         and old.cliente_id = bws_cliente_id() then
        if current_setting('transaction_isolation') <> 'read committed' then
          raise exception 'Se requiere READ COMMITTED para registrar la persona' using errcode = 'P2102';
        end if;
        -- UPDATE normalmente toma NO KEY UPDATE, compatible con el bloqueo
        -- de la FK al insertar documentos. FOR UPDATE también espera a esos
        -- insertos; la consulta siguiente ve lo confirmado después de esperar.
        perform 1 from proyectos where id = old.id for update;
        if not exists (select 1 from documentos where proyecto_id = old.id) then
          return new;
        end if;
      end if;
      raise exception 'La persona y el representante de un proyecto enviado no se editan'
        using errcode = '42501';
    end if;
  elsif new.estado <> 'borrador' and new.persona_tipo is null then
    raise exception 'Elige la persona del cliente antes de enviar el proyecto'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

-- Se llama al comienzo de la transacción de inserción, no durante el
-- cálculo de los PDF. Es SECURITY INVOKER: mantiene los permisos y RLS.
create or replace function bws_exigir_generacion_proyecto(
  p_id uuid, p_persona text, p_nombre text, p_documento text
) returns void
language plpgsql volatile
as $$
declare
  actual proyectos%rowtype;
begin
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'Se requiere READ COMMITTED para generar' using errcode = 'P2102';
  end if;
  select * into actual from proyectos where id = p_id for update;
  if not found or not bws_es_admin()
     or actual.estado <> 'enviado'
     or p_persona is null
     or actual.persona_tipo is distinct from p_persona
     or actual.cliente_rep_nombre is distinct from p_nombre
     or actual.cliente_rep_documento is distinct from p_documento then
    raise exception 'El proyecto cambió durante la generación' using errcode = 'P2101';
  end if;
  -- Consulta separada posterior al bloqueo: no reutiliza el snapshot previo
  -- a la espera. Rechaza incluso un expediente parcial o anulado.
  if exists (select 1 from documentos where proyecto_id = p_id) then
    raise exception 'El proyecto ya tiene documentos' using errcode = 'P2101';
  end if;
end;
$$;
