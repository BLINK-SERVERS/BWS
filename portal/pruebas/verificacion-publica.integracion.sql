-- Solo se ejecuta en el PostgreSQL desechable de verificacion-publica-db.test.ts.
insert into usuarios (id, correo, clave_hash, nombre)
values ('10000000-0000-0000-0000-000000000001', 'privado@example.test', 'clave', 'Nombre privado');
insert into clientes (id, usuario_id, razon_social, telefono)
values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
        'Titular de prueba', 'telefono privado');
insert into planes_infra (clave, nivel, version, nombre, limites, precio_usd, costo_usd, fuente, fecha)
values ('prueba', 'uno', 1, 'Plan', '{}', 1, 0, 'prueba', '2026-01-01');
insert into proyectos (id, cliente_id, nombre, categoria, dominio, buzones, alcance, complejidad,
                       plan_clave, plan_nivel, plan_version)
values ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
        'Proyecto privado', 'categoria', 'ejemplo.test', '["a@ejemplo.test"]', 'privado', 'simple',
        'prueba', 'uno', 1);
insert into plantillas (codigo, version, contenido, sha256, activa)
select 'T' || n, 1, jsonb_build_object('titulo', 'Histórico ' || n), 'hash', n <> 3
from generate_series(1, 10) as n;
insert into plantillas (codigo, version, contenido, sha256, activa)
values ('T3', 2, '{"titulo":"Versión actual"}', 'otro hash', true);
insert into documentos (id, proyecto_id, plantilla_codigo, plantilla_version, orden, pdf, sello,
                        hash_archivo, hash_anterior, hash_cadena, estado, contexto_sello, nombre_archivo)
select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
       '30000000-0000-0000-0000-000000000001', 'T' || n, 1, n, '\x00', 'sello',
       repeat('a', 64), 'anterior', 'cadena',
       case when n in (1, 7) then 'generado' when n = 5 then 'anulado'
            when n = 6 then 'enviado' else 'firmado' end,
       case when n = 10 then '{"datos":{"variables":{"cliente_razon_social":"Titular al firmar"}}}'::jsonb end,
       case when n = 10 then 'DOCUMENTO_BWS_PERSONA_NATURAL_SITIO_WEB_CLIENTE.pdf' end
from generate_series(1, 10) as n;
insert into firmas_cliente (id, cliente_id, png, sha256, utc, metodo, version, hash_consentimiento)
values ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
        '\x00', 'hash', now(), 'simple_reforzada', 1, 'consentimiento');
insert into representantes (id, nombre, documento, png, sha256, utc)
values ('50000000-0000-0000-0000-000000000001', 'Representante privado', 'privado', '\x00', 'hash', now());
insert into actos_firma (documento_id, firmante, firma_id, representante_id, sello, utc)
select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid, firmante,
       case when firmante = 'cliente' then '40000000-0000-0000-0000-000000000001'::uuid end,
       case when firmante = 'representante' then '50000000-0000-0000-0000-000000000001'::uuid end,
       sello, now()
from (values (2, 'representante', 'sello'),
             (3, 'representante', 'sello'), (3, 'cliente', 'sello'),
             (4, 'representante', 'sello'), (4, 'cliente', 'otro'),
             (5, 'representante', 'sello'), (5, 'cliente', 'sello'),
             (6, 'representante', 'sello'), (6, 'cliente', 'sello'),
             (7, 'representante', 'sello'), (7, 'cliente', 'sello'),
             (8, 'representante', 'otro'), (8, 'cliente', 'otro'),
             (9, 'cliente', 'sello')) as actos(n, firmante, sello);
insert into documentos_ajustados (id, documento_id, proyecto_id, pdf, sha256_original,
                                  sha256_ajustado, nota, actor, utc)
values
  ('60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003',
   '30000000-0000-0000-0000-000000000001', '\x01', repeat('a', 64), repeat('b', 64),
   'nota privada', '10000000-0000-0000-0000-000000000001', '2026-01-01'),
  ('60000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003',
   '30000000-0000-0000-0000-000000000001', '\x02', repeat('a', 64), repeat('c', 64),
   'nota privada', '10000000-0000-0000-0000-000000000001', '2026-01-02'),
  ('60000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002',
   '30000000-0000-0000-0000-000000000001', '\x03', repeat('a', 64), repeat('d', 64),
   null, '10000000-0000-0000-0000-000000000001', '2026-01-03'),
  ('60000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000006',
   '30000000-0000-0000-0000-000000000001', '\x04', repeat('a', 64), repeat('e', 64),
   null, '10000000-0000-0000-0000-000000000001', '2026-01-03'),
  ('60000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000006',
   '30000000-0000-0000-0000-000000000001', '\x05', repeat('a', 64), repeat('f', 64),
   null, '10000000-0000-0000-0000-000000000001', '2026-01-03');

-- Comprobar seguridad real, no solo el texto de la migración.
do $$
begin
  if not exists (
    select 1 from pg_proc p
    where p.oid = 'public.bws_verificacion_publica(uuid)'::regprocedure
      and p.prosecdef and p.proowner = 'bws_owner'::regrole
      and 'search_path=pg_catalog, pg_temp' = any(p.proconfig)
  ) then raise exception 'Función sin propietario, SECURITY DEFINER o search_path esperado'; end if;
  if exists (
    select 1 from pg_proc p, lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
    where p.oid = 'public.bws_verificacion_publica(uuid)'::regprocedure
      and acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
  ) then raise exception 'PUBLIC puede ejecutar la función'; end if;
  if not has_function_privilege('bws_app', 'public.bws_verificacion_publica(uuid)', 'execute')
     or has_function_privilege('sin_permiso', 'public.bws_verificacion_publica(uuid)', 'execute')
  then raise exception 'Permisos de ejecución incorrectos'; end if;
end $$;

reset role;
set role sin_permiso;
do $$
begin
  begin
    perform * from public.bws_verificacion_publica('00000000-0000-0000-0000-000000000003');
    raise exception 'Un rol ajeno pudo ejecutar la función';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
set role bws_app;

do $$
declare
  caso record;
  resultado record;
  columnas text[];
begin
  -- Sin identidad, las tablas originales siguen protegidas por RLS.
  if exists (select 1 from documentos) or exists (select 1 from clientes)
     or exists (select 1 from proyectos) or exists (select 1 from actos_firma)
     or exists (select 1 from documentos_ajustados)
  then raise exception 'RLS permitió leer filas sin identidad'; end if;

  for caso in select * from (values
    (1, 'pendiente'), (2, 'pendiente'), (3, 'confirmado'), (4, 'pendiente'),
    (5, 'anulado'), (6, 'confirmado'), (7, 'pendiente'), (8, 'pendiente'),
    (9, 'pendiente'), (10, 'pendiente')
  ) as casos(n, estado_esperado)
  loop
    select * into resultado from public.bws_verificacion_publica(
      ('00000000-0000-0000-0000-' || lpad(caso.n::text, 12, '0'))::uuid
    );
    if not found or resultado.estado is distinct from caso.estado_esperado then
      raise exception 'Estado incorrecto para documento %: %', caso.n, resultado.estado;
    end if;
  end loop;

  select array_agg(clave order by clave) into columnas
  from jsonb_object_keys((
    select to_jsonb(fila) from public.bws_verificacion_publica('00000000-0000-0000-0000-000000000003') fila
  )) clave;
  if columnas is distinct from array['estado', 'hash_ajustado', 'hash_archivo', 'id', 'titular', 'titulo']
  then raise exception 'La función devolvió columnas inesperadas: %', columnas; end if;

  select * into resultado from public.bws_verificacion_publica('00000000-0000-0000-0000-000000000003');
  if resultado.titular is distinct from 'Titular de prueba'
     or resultado.titulo is distinct from 'Histórico 3'
     or resultado.hash_archivo is distinct from repeat('a', 64)
     or resultado.hash_ajustado is distinct from repeat('c', 64)
  then raise exception 'Datos públicos o selección del último ajuste incorrectos'; end if;
  select * into resultado from public.bws_verificacion_publica('00000000-0000-0000-0000-000000000010');
  if resultado.titular is distinct from 'Titular al firmar'
     or resultado.titulo is distinct from 'DOCUMENTO_BWS_PERSONA_NATURAL_SITIO_WEB_CLIENTE'
  then raise exception 'El titular o el título congelado no coinciden'; end if;
  select * into resultado from public.bws_verificacion_publica('00000000-0000-0000-0000-000000000006');
  if resultado.hash_ajustado is distinct from repeat('e', 64)
  then raise exception 'Desempate de ajustes distinto al usado por la descarga'; end if;
  select * into resultado from public.bws_verificacion_publica('00000000-0000-0000-0000-000000000001');
  if resultado.hash_ajustado is not null then raise exception 'Ajuste inexistente no es null'; end if;
  if exists (select 1 from public.bws_verificacion_publica('ffffffff-ffff-ffff-ffff-ffffffffffff'))
     or exists (select 1 from public.bws_verificacion_publica(null))
  then raise exception 'UUID inexistente devolvió filas'; end if;
end $$;
