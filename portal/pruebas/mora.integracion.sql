-- Exclusivo del PostgreSQL desechable de mora-db.test.ts; nunca usar una base existente.
-- Datos anteriores a 0018 para comprobar que la migración no altera el régimen histórico.
set timezone = 'UTC';
insert into usuarios (id, correo, clave_hash, nombre, rol) values
  ('10000000-0000-0000-0000-000000000001', 'admin@example.test', 'hash', 'Admin', 'admin'),
  ('10000000-0000-0000-0000-000000000002', 'cliente1@example.test', 'hash', 'Cliente uno', 'cliente'),
  ('10000000-0000-0000-0000-000000000003', 'cliente2@example.test', 'hash', 'Cliente dos', 'cliente');
insert into clientes (id, usuario_id, razon_social, documento_tipo, documento_numero, domicilio_fiscal, telefono, correo_factura) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'Uno', 'cedula', '1', 'Uno', '1', 'uno@example.test'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003', 'Dos', 'cedula', '2', 'Dos', '2', 'dos@example.test');
insert into planes_infra (clave, nivel, version, nombre, limites, precio_usd, costo_usd, fuente, fecha)
values ('prueba', 'uno', 1, 'Plan', '{}', 30, 0, 'prueba', '2026-01-01');
insert into proyectos (id, cliente_id, nombre, categoria, dominio, buzones, alcance, complejidad, plan_clave, plan_nivel, plan_version)
select ('30000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
       case when n = 12 then '20000000-0000-0000-0000-000000000002'::uuid
            else '20000000-0000-0000-0000-000000000001'::uuid end,
       'Proyecto ' || n, 'categoria', 'proyecto' || n || '.example.test', '["a@example.test"]', 'alcance',
       'simple', 'prueba', 'uno', 1
from generate_series(1, 13) n;
insert into plantillas (codigo, version, contenido, sha256) values
  ('BWS-CON-004', 1, '{}', 'historico'), ('BWS-CON-009', 1, '{}', 'nuevo');
insert into documentos (id, proyecto_id, plantilla_codigo, plantilla_version, orden, pdf, sello,
                        hash_archivo, hash_anterior, hash_cadena, estado)
select ('40000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
       ('30000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
       case when n = 1 then 'BWS-CON-004' else 'BWS-CON-009' end, 1, 1, '\x00', 'sello',
       'archivo', 'anterior', 'cadena',
       case n when 2 then 'generado' when 3 then 'anulado' when 7 then 'enviado' else 'firmado' end
from generate_series(1, 13) n where n <> 8;
insert into firmas_cliente (id, cliente_id, png, sha256, utc, metodo, version, hash_consentimiento) values
  ('50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '\x00', 'hash', now(), 'simple_reforzada', 1, 'hash'),
  ('50000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '\x00', 'hash', now(), 'simple_reforzada', 1, 'hash');
insert into representantes (id, nombre, documento, png, sha256, utc)
values ('60000000-0000-0000-0000-000000000001', 'Representante', '1', '\x00', 'hash', now());
insert into actos_firma (documento_id, firmante, firma_id, representante_id, sello, utc)
select ('40000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid, firmante,
       case when firmante = 'cliente' then
         case when n = 12 then '50000000-0000-0000-0000-000000000002'::uuid
              else '50000000-0000-0000-0000-000000000001'::uuid end end,
       case when firmante = 'representante' then '60000000-0000-0000-0000-000000000001'::uuid end,
       case when n = 5 and firmante = 'cliente' then 'otro sello' else 'sello' end, now()
from generate_series(1, 13) n cross join (values ('cliente'), ('representante')) f(firmante)
where n <> 8 and not (n = 4 and firmante = 'cliente');
insert into suscripciones (id, proyecto_id, plan_clave, plan_nivel, plan_version, monto_usd,
                           dia_cobro, proximo_vencimiento, dias_gracia, estado)
select ('70000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
       ('30000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
       'prueba', 'uno', 1, 30, 5, '2090-01-05', 5,
       case when n = 11 then 'terminada' when n in (1, 6, 9, 10, 12, 13) then 'suspendida' else 'al_dia' end
from generate_series(1, 13) n;
insert into licencias (proyecto_id, tipo, alcance, inicio, estado)
select proyecto_id, 'uso', 'prueba', '2089-01-01',
       case when estado = 'terminada' then 'terminada' when estado = 'suspendida' then 'suspendida' else 'activa' end
from suscripciones;
insert into licencias (proyecto_id, tipo, alcance, inicio, estado) values
  ('30000000-0000-0000-0000-000000000006', 'compra_codigo', 'prueba', '2089-01-01', 'suspendida'),
  ('30000000-0000-0000-0000-000000000006', 'compra_arquitectura', 'prueba', '2089-01-01', 'terminada');
insert into pagos (id, suscripcion_id, periodo, monto, moneda, referencia, fecha, creado) values
  ('80000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', '2089-12', 30, 'USD', 'histórico', '2089-12-05', '2089-12-05'),
  ('80000000-0000-0000-0000-000000000009', '70000000-0000-0000-0000-000000000009', '2089-12', 30, 'USD', 'antecedente', '2089-12-05', '2089-12-06'),
  ('80000000-0000-0000-0000-000000000010', '70000000-0000-0000-0000-000000000010', '2026-99', 30, 'USD', 'inválido', '2089-12-05', '2089-12-05'),
  ('80000000-0000-0000-0000-000000000011', '70000000-0000-0000-0000-000000000010', '2089-12', 30, 'USD', 'anterior', '2089-12-05', '2089-12-05'),
  ('80000000-0000-0000-0000-000000000012', '70000000-0000-0000-0000-000000000010', '2090-01', 29, 'USD', 'parcial', '2090-01-05', '2089-12-05'),
  ('80000000-0000-0000-0000-000000000014', '70000000-0000-0000-0000-000000000011', '2090-01', 30, 'USD', 'terminada', '2090-01-05', '2089-12-05'),
  ('80000000-0000-0000-0000-000000000013', '70000000-0000-0000-0000-000000000013', '2090-01', 30, 'USD', 'fecha futura histórica', '2090-01-06', '2089-12-05');

-- APLICAR_MIGRACION_0018

do $$
begin
  if not exists (select 1 from suscripciones where id = '70000000-0000-0000-0000-000000000001'
    and proximo_vencimiento = '2090-01-05' and dias_gracia = 5 and estado = 'suspendida'
    and vencimiento_inicial_mora is null)
    or not exists (select 1 from pagos where id = '80000000-0000-0000-0000-000000000001' and monto = 30)
    or not exists (select 1 from licencias where proyecto_id = '30000000-0000-0000-0000-000000000001' and estado = 'suspendida')
  then raise exception '0018 modificó datos históricos'; end if;
end $$;
update suscripciones set vencimiento_inicial_mora = '2090-01-05'
where id in ('70000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000006',
             '70000000-0000-0000-0000-000000000007', '70000000-0000-0000-0000-000000000010',
             '70000000-0000-0000-0000-000000000011', '70000000-0000-0000-0000-000000000012',
             '70000000-0000-0000-0000-000000000013');

-- El resto usa el rol sin BYPASSRLS, no el dueño ni el superusuario.
reset role;
set role bws_app;
do $$
begin
  if current_user <> 'bws_app' or (select rolbypassrls or rolsuper from pg_roles where rolname = current_user)
     or exists (select 1 from suscripciones) or exists (select 1 from pagos)
     or exists (select 1 from revisiones_intereses_mora)
     or exists (select 1 from bws_deuda_mora('70000000-0000-0000-0000-000000000006', '2090-01-06'))
     or bws_contrato_mora_nuevo('30000000-0000-0000-0000-000000000006')
  then raise exception 'RLS permitió acceso sin identidad'; end if;
end $$;
set app.usuario_id = '10000000-0000-0000-0000-000000000001';
set app.rol = 'admin';

-- Histórico, generado, anulado, firma incompleta, sello distinto y sin documento no son régimen nuevo.
do $$
declare caso record; proyecto uuid;
begin
  for caso in select * from (values
    (1, false), (2, false), (3, false), (4, false), (5, false), (6, true),
    (7, true), (8, false), (9, true), (10, true), (11, true), (12, true), (13, true)
  ) as casos(n, esperado) loop
    proyecto := ('30000000-0000-0000-0000-' || lpad(caso.n::text, 12, '0'))::uuid;
    if bws_contrato_mora_nuevo(proyecto) is distinct from caso.esperado then
      raise exception 'Régimen incorrecto para proyecto %', caso.n;
    end if;
  end loop;
end $$;

-- Las operaciones nuevas tampoco deben aplicarse a contratos no confirmados o terminados.
do $$
declare rechazo boolean; s uuid;
begin
  foreach s in array array['70000000-0000-0000-0000-000000000001'::uuid,
                            '70000000-0000-0000-0000-000000000002'::uuid,
                            '70000000-0000-0000-0000-000000000011'::uuid] loop
    rechazo := false;
    begin
      perform * from bws_pago_mora(s, '2090-01', 30, 'USD', null, 'rechazado', '2090-01-05', '2090-01-05', null, null);
    exception when sqlstate 'P0001' then rechazo := true; end;
    if not rechazo then raise exception 'Pago admitido para régimen histórico/no confirmado/terminado: %', s; end if;
    rechazo := false;
    begin
      perform * from bws_regularizar_mora(s, null, 0, 0, 'Fundamento de prueba', '2090-01-05', null, null);
    exception when sqlstate 'P0001' then rechazo := true; end;
    if not rechazo then raise exception 'Regularización admitida indebidamente: %', s; end if;
  end loop;
  rechazo := false;
  begin
    perform * from bws_anular_pago_mora('80000000-0000-0000-0000-000000000001', 'motivo', '2090-01-05', null, null);
  exception when sqlstate 'P0001' then rechazo := true; end;
  if not rechazo then raise exception 'Anulación nueva admitida para contrato histórico'; end if;
  rechazo := false;
  begin
    perform * from bws_anular_pago_mora('80000000-0000-0000-0000-000000000014', 'motivo', '2090-01-05', null, null);
  exception when sqlstate 'P0001' then rechazo := true; end;
  if not rechazo or exists (select 1 from pagos where anulacion_de = '80000000-0000-0000-0000-000000000014')
     or not exists (select 1 from licencias where proyecto_id = '30000000-0000-0000-0000-000000000011' and estado = 'terminada')
  then raise exception 'Se anuló o reactivó una suscripción terminada'; end if;
end $$;

-- Inicio desconocido: no deducirlo de pagos ni reactivar al registrarlo.
do $$
declare d record; r record; rechazo boolean := false;
begin
  select * into d from bws_deuda_mora('70000000-0000-0000-0000-000000000009', '2090-01-04');
  if d.inicio_conocido is distinct from false or d.proximo is not null or d.intereses_regularizados is distinct from false
  then raise exception 'Se presumió el inicio o los intereses'; end if;
  begin
    perform * from bws_pago_mora('70000000-0000-0000-0000-000000000009', '2090-01', 30, 'USD', null, 'pago', '2090-01-04', '2090-01-04', null, null);
  exception when sqlstate 'P0001' then rechazo := true; end;
  if not rechazo then raise exception 'Pago admitido sin inicio acreditado'; end if;
  rechazo := false;
  begin
    perform * from bws_regularizar_mora('70000000-0000-0000-0000-000000000009', '2090-01-05', null, null, 'Contrato y factura', '2090-01-04', null, null);
  exception when sqlstate 'P0001' then rechazo := true; end;
  if not rechazo then raise exception 'Inicio posterior al antecedente admitido'; end if;
  select * into r from bws_regularizar_mora('70000000-0000-0000-0000-000000000009', '2089-12-05', null, null, 'Contrato y factura', '2090-01-04', null, null);
  if row(r.inicio_registrado, r.reactivada, r.estado_actual, r.proximo, r.pendientes)
     is distinct from row(true, false, 'suspendida'::text, '2090-01-05'::date, 0)
     or not exists (select 1 from licencias where proyecto_id = '30000000-0000-0000-0000-000000000009' and tipo = 'uso' and estado = 'suspendida')
  then raise exception 'Registrar inicio activó la suscripción o calculó mal los antecedentes: %', row_to_json(r); end if;
  select * into d from bws_deuda_mora('70000000-0000-0000-0000-000000000009', '2090-01-04');
  if d.firma_pagos is distinct from '80000000-0000-0000-0000-000000000009'
     or d.intereses_regularizados is distinct from false
  then raise exception 'La fecha de registro posterior no se reconoció como tardía: %', row_to_json(d); end if;
end $$;

-- Día del vencimiento frente a día siguiente; pago adelantado con meses omitidos.
do $$
declare d record; r record; rechazo boolean;
begin
  select * into d from bws_deuda_mora('70000000-0000-0000-0000-000000000006', '2090-01-05');
  if row(d.proximo, d.vencidas, d.exigibles, d.pendientes, d.principal_usd, d.intereses_regularizados)
     is distinct from row('2090-01-05'::date, 0, 1, 1, 30::numeric, true)
  then raise exception 'Deuda en el día del vencimiento: %', row_to_json(d); end if;
  select * into d from bws_deuda_mora('70000000-0000-0000-0000-000000000006', '2090-02-06');
  if row(d.proximo, d.vencidas, d.exigibles, d.pendientes, d.principal_usd)
     is distinct from row('2090-01-05'::date, 2, 2, 2, 60::numeric)
  then raise exception 'No se acumularon dos mensualidades: %', row_to_json(d); end if;
  select * into r from bws_pago_mora('70000000-0000-0000-0000-000000000006', '2090-03', 30, 'USD', null, 'adelanto marzo', '2090-01-04', '2090-01-04', null, null);
  if row(r.anterior, r.nuevo, r.proximo) is distinct from row('suspendida'::text, 'suspendida'::text, '2090-01-05'::date)
  then raise exception 'El pago adelantado saltó cuotas o levantó la suspensión: %', row_to_json(r); end if;
  select * into d from bws_deuda_mora('70000000-0000-0000-0000-000000000006', '2090-01-04');
  if row(d.proximo, d.vencidas, d.exigibles, d.pendientes, d.principal_usd)
     is distinct from row('2090-01-05'::date, 0, 0, 2, 0::numeric)
  then raise exception 'Los meses omitidos anteriores al adelanto no se contaron: %', row_to_json(d); end if;
  select * into r from bws_regularizar_mora('70000000-0000-0000-0000-000000000006', null, 0, 0, 'Revisión de intereses', '2090-01-04', null, null);
  if r.reactivada is distinct from false or r.estado_actual is distinct from 'suspendida'
  then raise exception 'Reactivó con mensualidades omitidas futuras: %', row_to_json(r); end if;
  rechazo := false;
  begin
    perform * from bws_pago_mora('70000000-0000-0000-0000-000000000006', '2090-03', 30, 'USD', null, 'duplicado', '2090-01-04', '2090-01-04', null, null);
  exception when unique_violation then rechazo := true; end;
  if not rechazo then raise exception 'Admitió pago vigente duplicado'; end if;
end $$;

-- Cobertura íntegra en VES y validaciones de periodos.
do $$
declare rechazo boolean; d record;
begin
  rechazo := false;
  begin
    perform * from bws_pago_mora('70000000-0000-0000-0000-000000000007', '2090-01', 2999.99, 'VES', 100, 'parcial', '2090-01-04', '2090-01-04', null, null);
  exception when sqlstate 'P0001' then rechazo := true; end;
  if not rechazo then raise exception 'Admitió pago VES inferior a una cuota'; end if;
  rechazo := false;
  begin
    perform * from bws_pago_mora('70000000-0000-0000-0000-000000000007', '2089-12', 30, 'USD', null, 'anterior', '2090-01-04', '2090-01-04', null, null);
  exception when sqlstate 'P0001' then rechazo := true; end;
  if not rechazo then raise exception 'Admitió periodo anterior al inicio'; end if;
  rechazo := false;
  begin
    perform * from bws_pago_mora('70000000-0000-0000-0000-000000000007', '2090-13', 30, 'USD', null, 'inválido', '2090-01-04', '2090-01-04', null, null);
  exception when sqlstate 'P0001' then rechazo := true; end;
  if not rechazo then raise exception 'Admitió periodo inválido'; end if;
  perform * from bws_pago_mora('70000000-0000-0000-0000-000000000007', '2090-01', 3000, 'VES', 100, 'completo', '2090-01-04', '2090-01-04', null, null);
  select * into d from bws_deuda_mora('70000000-0000-0000-0000-000000000007', '2090-01-05');
  if row(d.proximo, d.pendientes, d.principal_usd) is distinct from row('2090-02-05'::date, 0, 0::numeric)
  then raise exception 'Pago VES íntegro no cubrió la cuota: %', row_to_json(d); end if;
end $$;

-- Pago tardío: una revisión anterior ya no cubre el nuevo pago; ni pago ni revisión parcial reactivan.
do $$
declare d record; r record; pago_febrero uuid; rechazo boolean := false;
begin
  perform * from bws_pago_mora('70000000-0000-0000-0000-000000000006', '2090-01', 30, 'USD', null, 'enero', '2090-01-05', '2090-02-06', null, null);
  select * into d from bws_deuda_mora('70000000-0000-0000-0000-000000000006', '2090-02-06');
  if row(d.proximo, d.vencidas, d.exigibles, d.pendientes, d.principal_usd)
     is distinct from row('2090-02-05'::date, 1, 1, 1, 30::numeric)
  then raise exception 'El pago de enero no dejó febrero pendiente: %', row_to_json(d); end if;
  select * into r from bws_regularizar_mora('70000000-0000-0000-0000-000000000006', null, 0, 0, 'Revisión con principal pendiente', '2090-02-06', null, null);
  if r.reactivada is distinct from false or r.principal_usd is distinct from 30::numeric
  then raise exception 'Reactivó con principal vencido: %', row_to_json(r); end if;
  select pago_id into pago_febrero from bws_pago_mora('70000000-0000-0000-0000-000000000006', '2090-02', 30, 'USD', null, 'febrero tardío', '2090-02-10', '2090-02-10', null, null);
  select * into d from bws_deuda_mora('70000000-0000-0000-0000-000000000006', '2090-02-10');
  if row(d.proximo, d.vencidas, d.exigibles, d.pendientes, d.principal_usd, d.firma_pagos, d.intereses_regularizados)
     is distinct from row('2090-04-05'::date, 0, 0, 0, 0::numeric, pago_febrero::text, false)
     or d.intereses_debidos_usd is not null or d.intereses_pagados_usd is not null
     or not exists (select 1 from suscripciones where id = '70000000-0000-0000-0000-000000000006' and estado = 'suspendida')
     or not exists (select 1 from licencias where proyecto_id = '30000000-0000-0000-0000-000000000006' and tipo = 'uso' and estado = 'suspendida')
  then raise exception 'Pago tardío reactivó o mantuvo vigente la revisión anterior: %', row_to_json(d); end if;
  begin
    perform * from bws_regularizar_mora('70000000-0000-0000-0000-000000000006', null, null, 0, 'Intereses sin monto', '2090-02-10', null, null);
  exception when sqlstate 'P0001' then rechazo := true; end;
  if not rechazo then raise exception 'Admitió intereses no declarados'; end if;
  select * into r from bws_regularizar_mora('70000000-0000-0000-0000-000000000006', null, 7.50, 2, 'Intereses según comprobante', '2090-02-10', null, null);
  if row(r.reactivada, r.estado_actual, r.principal_usd, r.intereses_debidos_usd, r.intereses_pagados_usd)
     is distinct from row(false, 'suspendida'::text, 0::numeric, 7.50::numeric, 2::numeric)
     or not exists (select 1 from licencias where proyecto_id = '30000000-0000-0000-0000-000000000006' and tipo = 'uso' and estado = 'suspendida')
  then raise exception 'Revisión parcial no conservó deuda o suspensión: %', row_to_json(r); end if;
  select * into r from bws_regularizar_mora('70000000-0000-0000-0000-000000000006', null, 7.50, 7.50, 'Intereses pagados según comprobante', '2090-02-10', null, null);
  if row(r.reactivada, r.estado_actual, r.principal_usd, r.intereses_debidos_usd, r.intereses_pagados_usd)
     is distinct from row(true, 'al_dia'::text, 0::numeric, 7.50::numeric, 7.50::numeric)
     or not exists (select 1 from licencias where proyecto_id = '30000000-0000-0000-0000-000000000006' and tipo = 'uso' and estado = 'activa')
     or not exists (select 1 from licencias where proyecto_id = '30000000-0000-0000-0000-000000000006' and tipo = 'compra_codigo' and estado = 'suspendida')
     or not exists (select 1 from licencias where proyecto_id = '30000000-0000-0000-0000-000000000006' and tipo = 'compra_arquitectura' and estado = 'terminada')
  then raise exception 'Regularización completa o licencias incorrectas: %', row_to_json(r); end if;

  -- Anular el pago tardío vuelve a abrir principal e invalida la firma de la revisión.
  select * into r from bws_anular_pago_mora(pago_febrero, 'Comprobante incorrecto', '2090-02-10', null, null);
  select * into d from bws_deuda_mora('70000000-0000-0000-0000-000000000006', '2090-02-10');
  if row(r.anterior, r.nuevo, r.proximo) is distinct from row('al_dia'::text, 'mora'::text, '2090-02-05'::date)
     or row(d.pendientes, d.principal_usd, d.firma_pagos, d.intereses_regularizados)
        is distinct from row(1, 30::numeric, ''::text, false)
     or d.intereses_debidos_usd is not null
     or (select count(*) from pagos where id = pago_febrero or anulacion_de = pago_febrero) <> 2
  then raise exception 'Anulación no restauró la deuda e invalidó intereses: %, %', row_to_json(r), row_to_json(d); end if;
  rechazo := false;
  begin
    perform * from bws_anular_pago_mora(pago_febrero, 'Segunda anulación', '2090-02-10', null, null);
  exception when sqlstate 'P0001' then rechazo := true; end;
  if not rechazo then raise exception 'Admitió anular dos veces'; end if;
  -- La suspensión manual ocurre fuera de 0018; comprobar el comportamiento posterior de sus funciones.
  update suscripciones set estado = 'suspendida' where id = '70000000-0000-0000-0000-000000000006';
  update licencias set estado = 'suspendida' where proyecto_id = '30000000-0000-0000-0000-000000000006' and tipo = 'uso';
  select * into r from bws_regularizar_mora('70000000-0000-0000-0000-000000000006', null, 0, 0, 'Revisión después de anular', '2090-02-10', null, null);
  if r.reactivada is distinct from false or r.principal_usd is distinct from 30::numeric
  then raise exception 'Reactivó después de anular sin pagar nuevamente'; end if;
  perform * from bws_pago_mora('70000000-0000-0000-0000-000000000006', '2090-02', 30, 'USD', null, 'pago reemplazo', '2090-02-05', '2090-02-10', null, null);
  if not exists (select 1 from suscripciones where id = '70000000-0000-0000-0000-000000000006' and estado = 'suspendida')
  then raise exception 'El pago de reemplazo reactivó automáticamente'; end if;
end $$;

-- Un pago histórico parcial no cubre la mensualidad; periodos irregulares bloquean la apertura.
do $$
declare d record; r record; rechazo boolean := false;
begin
  select * into d from bws_deuda_mora('70000000-0000-0000-0000-000000000010', '2090-01-06');
  if row(d.irregularidades, d.vencidas, d.pendientes, d.principal_usd)
     is distinct from row(2, 1, 1, 30::numeric)
  then raise exception 'Pagos históricos parciales o irregulares mal calculados: %', row_to_json(d); end if;
  select * into r from bws_regularizar_mora('70000000-0000-0000-0000-000000000010', null, 0, 0, 'Revisión de antecedentes', '2090-01-06', null, null);
  if r.reactivada is distinct from false or r.irregularidades is distinct from 2
  then raise exception 'Reactivó con antecedentes irregulares'; end if;
  begin
    perform * from bws_pago_mora('70000000-0000-0000-0000-000000000010', '2090-01', 30, 'USD', null, 'sustituto', '2090-01-05', '2090-01-06', null, null);
  exception when unique_violation then rechazo := true; end;
  if not rechazo then raise exception 'Admitió sustituto sin anular el parcial vigente'; end if;
  perform * from bws_anular_pago_mora('80000000-0000-0000-0000-000000000010', 'Corregir periodo inválido', '2090-01-06', null, null);
  perform * from bws_anular_pago_mora('80000000-0000-0000-0000-000000000011', 'Corregir periodo anterior', '2090-01-06', null, null);
  perform * from bws_anular_pago_mora('80000000-0000-0000-0000-000000000012', 'Corregir pago parcial', '2090-01-06', null, null);
  perform * from bws_pago_mora('70000000-0000-0000-0000-000000000010', '2090-01', 30, 'USD', null, 'pago íntegro', '2090-01-05', '2090-01-06', null, null);
  select * into r from bws_regularizar_mora('70000000-0000-0000-0000-000000000010', null, 0, 0, 'Antecedentes corregidos', '2090-01-06', null, null);
  if row(r.reactivada, r.estado_actual, r.irregularidades, r.principal_usd)
     is distinct from row(true, 'al_dia'::text, 0, 0::numeric)
  then raise exception 'Correcciones no permitieron regularizar: %', row_to_json(r); end if;
end $$;

-- Un pago previo a la migración fechado en el futuro tampoco acredita el principal.
do $$
declare d record; r record;
begin
  select * into d from bws_deuda_mora('70000000-0000-0000-0000-000000000013', '2090-01-05');
  select * into r from bws_regularizar_mora('70000000-0000-0000-0000-000000000013', null, 0, 0, 'Revisión de fecha futura histórica', '2090-01-05', null, null);
  if r.reactivada then raise exception 'Un pago histórico con fecha futura permitió reactivar antes del cobro'; end if;
  if row(d.pendientes, d.principal_usd, d.irregularidades) is distinct from row(1, 30::numeric, 1)
     or r.estado_actual is distinct from 'suspendida'
  then raise exception 'El pago histórico futuro ocultó principal o irregularidades: %', row_to_json(d); end if;
  select * into d from bws_deuda_mora('70000000-0000-0000-0000-000000000013', '2090-01-06');
  if row(d.pendientes, d.principal_usd, d.irregularidades, d.firma_pagos, d.intereses_regularizados)
     is distinct from row(0, 0::numeric, 0, '80000000-0000-0000-0000-000000000013'::text, false)
  then raise exception 'Al llegar la fecha no se reconoció el pago tardío ni se invalidó la revisión: %', row_to_json(d); end if;
end $$;

-- Sin fecha de corte no puede darse por saldado el principal.
do $$
declare rechazo boolean := false; r record;
begin
  begin
    select * into r from bws_regularizar_mora('70000000-0000-0000-0000-000000000012', null, 0, 0, 'Revisión sin fecha', null, null, null);
  exception when sqlstate 'P0001' then rechazo := true; end;
  if not rechazo then
    if r.reactivada then raise exception 'Se reactivó una deuda sin fecha de corte'; end if;
    raise exception 'Se admitió una revisión sin fecha de corte';
  end if;
  if exists (select 1 from bws_deuda_mora('70000000-0000-0000-0000-000000000012', null))
  then raise exception 'Se presentó deuda calculada sin fecha de corte'; end if;
end $$;

-- El pago y su anulación también requieren fecha para no dejar al día una deuda vencida.
do $$
declare rechazo boolean := false; r record; d record; pago uuid;
begin
  update suscripciones set estado = 'mora' where id = '70000000-0000-0000-0000-000000000007';
  begin
    select * into r from bws_pago_mora('70000000-0000-0000-0000-000000000007', '2090-03', 30, 'USD', null, 'pago sin corte', '2090-02-06', null, null, null);
  exception when sqlstate 'P0001' then rechazo := true; end;
  if not rechazo then
    select * into d from bws_deuda_mora('70000000-0000-0000-0000-000000000007', '2090-02-06');
    if r.nuevo = 'al_dia' and d.principal_usd > 0 then raise exception 'Un pago sin fecha de corte ocultó deuda vencida'; end if;
    raise exception 'Se admitió un pago sin fecha de corte';
  end if;
  update suscripciones set estado = 'al_dia' where id = '70000000-0000-0000-0000-000000000007';
  select id into pago from pagos where suscripcion_id = '70000000-0000-0000-0000-000000000007' and periodo = '2090-01' and estado = 'registrado';
  rechazo := false;
  begin
    select * into r from bws_anular_pago_mora(pago, 'Anulación sin fecha', null, null, null);
  exception when sqlstate 'P0001' then rechazo := true; end;
  if not rechazo then
    select * into d from bws_deuda_mora('70000000-0000-0000-0000-000000000007', '2090-01-06');
    if r.nuevo = 'al_dia' and d.principal_usd > 0 then raise exception 'Una anulación sin fecha de corte ocultó deuda vencida'; end if;
    raise exception 'Se admitió una anulación sin fecha de corte';
  end if;
end $$;

-- No se puede declarar cobrado un pago con fecha posterior a hoy ni reabrir con él.
do $$
declare rechazo boolean := false; r record;
begin
  begin
    perform * from bws_pago_mora('70000000-0000-0000-0000-000000000012', '2090-01', 30, 'USD', null, 'fecha futura', '2090-01-06', '2090-01-05', null, null);
  exception when sqlstate 'P0001' then rechazo := true; end;
  if not rechazo then
    select * into r from bws_regularizar_mora('70000000-0000-0000-0000-000000000012', null, 0, 0, 'Revisión de pago futuro', '2090-01-05', null, null);
    if r.reactivada then raise exception 'Un pago con fecha futura permitió reactivar antes del cobro'; end if;
    raise exception 'Admitió como cobrado un pago con fecha futura';
  end if;
  select * into r from bws_regularizar_mora('70000000-0000-0000-0000-000000000012', null, 0, 0, 'Revisión de cliente dos', '2090-01-05', null, null);
  if row(r.reactivada, r.estado_actual, r.pendientes, r.principal_usd)
     is distinct from row(false, 'suspendida'::text, 1, 30::numeric)
     or exists (select 1 from pagos where suscripcion_id = '70000000-0000-0000-0000-000000000012')
     or not exists (select 1 from licencias where proyecto_id = '30000000-0000-0000-0000-000000000012' and tipo = 'uso' and estado = 'suspendida')
  then raise exception 'Reactivó con principal todavía no cobrado: %', row_to_json(r); end if;
end $$;

-- Revisiones y auditoría visibles al administrador; actor debe coincidir con la sesión.
do $$
declare rechazo boolean := false;
begin
  if (select count(*) from revisiones_intereses_mora where suscripcion_id = '70000000-0000-0000-0000-000000000006') < 4
     or not exists (select 1 from eventos where accion = 'pago.registrado' and entidad_id = '70000000-0000-0000-0000-000000000006')
     or not exists (select 1 from eventos where accion = 'pago.anulado')
     or not exists (select 1 from eventos where accion = 'suscripcion.intereses_revisados')
  then raise exception 'Faltan revisiones o eventos de auditoría'; end if;
  begin
    insert into revisiones_intereses_mora (suscripcion_id, firma_pagos, intereses_debidos_usd, intereses_pagados_usd, fundamento, actor)
    values ('70000000-0000-0000-0000-000000000006', '', 0, 0, 'Prueba de actor', '10000000-0000-0000-0000-000000000002');
  exception when insufficient_privilege then rechazo := true; end;
  if not rechazo then raise exception 'RLS permitió suplantar el actor'; end if;
end $$;
set app.usuario_id = '10000000-0000-0000-0000-000000000002';
set app.rol = 'cliente';
do $$
declare rechazo boolean := false;
begin
  if not exists (select 1 from revisiones_intereses_mora where suscripcion_id = '70000000-0000-0000-0000-000000000006')
     or exists (select 1 from suscripciones where id = '70000000-0000-0000-0000-000000000012')
     or exists (select 1 from revisiones_intereses_mora where suscripcion_id = '70000000-0000-0000-0000-000000000012')
     or exists (select 1 from bws_deuda_mora('70000000-0000-0000-0000-000000000012', '2090-01-06'))
     or bws_contrato_mora_nuevo('30000000-0000-0000-0000-000000000012')
  then raise exception 'RLS no aisló las suscripciones entre clientes'; end if;
  begin
    insert into revisiones_intereses_mora (suscripcion_id, firma_pagos, intereses_debidos_usd, intereses_pagados_usd, fundamento, actor)
    values ('70000000-0000-0000-0000-000000000006', '', 0, 0, 'Prueba de cliente', '10000000-0000-0000-0000-000000000002');
  exception when insufficient_privilege then rechazo := true; end;
  if not rechazo then raise exception 'RLS permitió que un cliente cree revisiones'; end if;
  rechazo := false;
  begin
    perform * from bws_regularizar_mora('70000000-0000-0000-0000-000000000006', null, 0, 0, 'Prueba de cliente', '2090-02-10', null, null);
  exception when sqlstate 'P0001' then rechazo := true; end;
  if not rechazo then raise exception 'Un cliente pudo regularizar'; end if;
  rechazo := false;
  begin
    perform * from bws_pago_mora('70000000-0000-0000-0000-000000000006', '2090-04', 30, 'USD', null, 'Pago de cliente', '2090-02-10', '2090-02-10', null, null);
  exception when sqlstate 'P0001' then rechazo := true; end;
  if not rechazo then raise exception 'Un cliente pudo registrar un pago'; end if;
  rechazo := false;
  begin
    perform * from bws_anular_pago_mora('80000000-0000-0000-0000-000000000009', 'Anulación por cliente', '2090-02-10', null, null);
  exception when sqlstate 'P0001' then rechazo := true; end;
  if not rechazo then raise exception 'Un cliente pudo anular un pago'; end if;
  rechazo := false;
  begin
    update revisiones_intereses_mora set fundamento = 'Manipulado';
  exception when insufficient_privilege then rechazo := true; end;
  if not rechazo then raise exception 'Un cliente pudo editar revisiones'; end if;
end $$;
set app.usuario_id = '10000000-0000-0000-0000-000000000003';
do $$
begin
  if not exists (select 1 from revisiones_intereses_mora where suscripcion_id = '70000000-0000-0000-0000-000000000012')
     or exists (select 1 from revisiones_intereses_mora where suscripcion_id = '70000000-0000-0000-0000-000000000006')
     or exists (select 1 from bws_deuda_mora('70000000-0000-0000-0000-000000000006', '2090-02-10'))
     or not exists (select 1 from bws_deuda_mora('70000000-0000-0000-0000-000000000012', '2090-01-06'))
     or not bws_contrato_mora_nuevo('30000000-0000-0000-0000-000000000012')
  then raise exception 'RLS filtró deuda o revisiones de otro cliente'; end if;
end $$;
-- Incluso el dueño debe respetar el trigger de solo agregar.
reset role;
set role bws_owner;
do $$
declare rechazo boolean := false;
begin
  begin
    update revisiones_intereses_mora set fundamento = 'Manipulado' where suscripcion_id = '70000000-0000-0000-0000-000000000006';
  exception when insufficient_privilege then rechazo := true; end;
  if not rechazo then raise exception 'El trigger permitió editar revisiones'; end if;
end $$;
