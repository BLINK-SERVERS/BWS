-- La persona y el representante pertenecen al proyecto, no a una ficha
-- compartida que pueda cambiar para otro contrato. No se rellenan los
-- proyectos históricos: un NULL significa que no se capturó el dato.
alter table proyectos add column if not exists persona_tipo text;
alter table proyectos add column if not exists cliente_rep_nombre text;
alter table proyectos add column if not exists cliente_rep_documento text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'proyectos'::regclass and conname = 'proyectos_persona_consistente'
  ) then
    alter table proyectos add constraint proyectos_persona_consistente check (coalesce(
      (persona_tipo is null and cliente_rep_nombre is null and cliente_rep_documento is null)
      or (persona_tipo = 'natural' and cliente_rep_nombre is null and cliente_rep_documento is null)
      or (persona_tipo = 'juridica'
          and cliente_rep_nombre is not null
          and char_length(btrim(cliente_rep_nombre)) between 2 and 120
          and cliente_rep_documento is not null
          and cliente_rep_documento ~ '^[VE]-[0-9]{6,9}$')
    , false));
  end if;
end $$;

create or replace function bws_congelar_persona_proyecto() returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'UPDATE' and old.estado <> 'borrador' then
    if new.persona_tipo is distinct from old.persona_tipo
       or new.cliente_rep_nombre is distinct from old.cliente_rep_nombre
       or new.cliente_rep_documento is distinct from old.cliente_rep_documento then
      raise exception 'La persona y el representante de un proyecto enviado no se editan'
        using errcode = '42501';
    end if;
  elsif new.estado <> 'borrador' and new.persona_tipo is null then
    -- Solo se exige al enviar/insertar, nunca al avanzar un proyecto antiguo.
    raise exception 'Elige la persona del cliente antes de enviar el proyecto'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists bws_congelar_persona_proyecto on proyectos;
create trigger bws_congelar_persona_proyecto
  before insert or update on proyectos
  for each row execute function bws_congelar_persona_proyecto();
