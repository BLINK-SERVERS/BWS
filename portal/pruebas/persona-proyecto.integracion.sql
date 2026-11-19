-- Prueba aislada de 0016: solo usa una tabla temporal y revierte todo.
-- Ejecutar con psql en una base de pruebas, nunca en una base remota.
\set ON_ERROR_STOP on
begin;
create temporary table proyectos (
  id integer primary key,
  estado text not null default 'borrador'
);
insert into proyectos (id, estado) values (1, 'enviado'), (2, 'borrador'), (3, 'borrador');

\ir ../db/migrations/0016_persona_proyecto.sql
\ir ../db/migrations/0016_persona_proyecto.sql

create function pg_temp.esperar_error(sentencia text, esperado text) returns void
language plpgsql as $$
declare codigo text;
begin
  begin
    execute sentencia;
  exception when others then
    get stacked diagnostics codigo = returned_sqlstate;
  end;
  if codigo is distinct from esperado then
    raise exception 'Se esperaba %, se recibió %: %', esperado, codigo, sentencia;
  end if;
end $$;

-- Un enviado histórico permanece nulo, puede avanzar, pero no se rellena.
do $$
begin
  if exists (select 1 from proyectos where id = 1 and
    (persona_tipo is not null or cliente_rep_nombre is not null or cliente_rep_documento is not null)) then
    raise exception 'La migración alteró los datos históricos';
  end if;
end $$;
update proyectos set estado = 'aprobado' where id = 1;
select pg_temp.esperar_error($q$update proyectos set persona_tipo = 'natural' where id = 1$q$, '42501');
select pg_temp.esperar_error($q$update proyectos set estado = 'enviado' where id = 2$q$, '23514');
select pg_temp.esperar_error($q$insert into proyectos (id, estado) values (4, 'enviado')$q$, '23514');
select pg_temp.esperar_error($q$update proyectos set cliente_rep_nombre = 'Ana Pérez' where id = 2$q$, '23514');
select pg_temp.esperar_error($q$update proyectos set persona_tipo = 'juridica' where id = 2$q$, '23514');
select pg_temp.esperar_error($q$update proyectos set persona_tipo = 'natural', cliente_rep_nombre = 'Ana Pérez' where id = 2$q$, '23514');
select pg_temp.esperar_error($q$update proyectos set persona_tipo = 'juridica', cliente_rep_nombre = 'Ana Pérez', cliente_rep_documento = 'J-12345678-9' where id = 2$q$, '23514');

update proyectos set persona_tipo = 'natural' where id = 2;
update proyectos set persona_tipo = 'juridica', cliente_rep_nombre = 'Ana Pérez', cliente_rep_documento = 'V-12345678' where id = 2;
update proyectos set estado = 'enviado' where id = 2;
select pg_temp.esperar_error($q$update proyectos set persona_tipo = 'natural', cliente_rep_nombre = null, cliente_rep_documento = null where id = 2$q$, '42501');
select pg_temp.esperar_error($q$update proyectos set cliente_rep_nombre = 'Otra Persona' where id = 2$q$, '42501');
select pg_temp.esperar_error($q$update proyectos set cliente_rep_documento = 'E-87654321' where id = 2$q$, '42501');
update proyectos set estado = 'en_revision' where id = 2;

update proyectos set persona_tipo = 'natural', estado = 'enviado' where id = 3;
select pg_temp.esperar_error($q$update proyectos set persona_tipo = null where id = 3$q$, '42501');
rollback;
