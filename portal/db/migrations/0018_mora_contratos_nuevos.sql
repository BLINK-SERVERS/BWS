-- Régimen nuevo: no altera las condiciones ni los saldos históricos.
-- Una suscripción anterior a esta migración necesita fijar su primer
-- vencimiento con evidencia antes de poder regularizarse.
alter table suscripciones add column if not exists vencimiento_inicial_mora date;

create table if not exists revisiones_intereses_mora (
  id bigint generated always as identity primary key,
  suscripcion_id uuid not null references suscripciones(id),
  firma_pagos text not null,
  intereses_debidos_usd numeric(14, 2) not null check (intereses_debidos_usd >= 0),
  intereses_pagados_usd numeric(14, 2) not null check (intereses_pagados_usd >= 0),
  fundamento text not null check (length(trim(fundamento)) between 5 and 500),
  actor uuid not null references usuarios(id),
  creado timestamptz not null default now()
);
create index if not exists revisiones_intereses_suscripcion_idx
  on revisiones_intereses_mora (suscripcion_id, id desc);
create trigger bws_solo_agregar before update or delete on revisiones_intereses_mora
  for each row execute function bws_abortar_cambio();
alter table revisiones_intereses_mora enable row level security;
create policy revisiones_intereses_lectura on revisiones_intereses_mora
  for select using (bws_suscripcion_propia(suscripcion_id) or bws_es_admin());
create policy revisiones_intereses_alta on revisiones_intereses_mora
  for insert with check (bws_es_admin() and actor = bws_usuario_id());
grant select, insert on revisiones_intereses_mora to bws_app;
grant usage, select on sequence revisiones_intereses_mora_id_seq to bws_app;

-- No basta un documento generado, anulado, ni actos de otro sello.
create or replace function bws_contrato_mora_nuevo(p_proyecto uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from documentos d
    where d.proyecto_id = p_proyecto
      and d.plantilla_codigo like 'BWS-CON-%'
      and d.plantilla_codigo <> 'BWS-CON-004'
      and d.estado in ('firmado', 'enviado')
      and exists (select 1 from actos_firma a where a.documento_id = d.id
                  and a.firmante = 'cliente' and a.sello = d.sello)
      and exists (select 1 from actos_firma a where a.documento_id = d.id
                  and a.firmante = 'representante' and a.sello = d.sello)
  )
$$;

-- Una cuota se considera cubierta solo por un pago vigente suficiente.
-- El primer vencimiento es explícito; no se deduce de un saldo ya adelantado.
-- Los pagos con fecha futura no cubren cuotas y requieren revisión mientras
-- no llegue esa fecha. Las revisiones cubren exactamente los pagos tardíos
-- vigentes, no pagos nuevos ni anulaciones posteriores. No se presupone una tasa.
create or replace function bws_deuda_mora(p_suscripcion uuid, p_hoy date)
returns table (
  inicio_conocido boolean, proximo date, vencidas integer, exigibles integer, pendientes integer,
  irregularidades integer, principal_usd numeric, firma_pagos text, intereses_debidos_usd numeric,
  intereses_pagados_usd numeric, intereses_regularizados boolean
) language sql volatile as $$
  with s as (
    select * from suscripciones where id = p_suscripcion and p_hoy is not null
  ), pagos_vigentes as (
    select p.* from pagos p join s on s.id = p.suscripcion_id
    where p.estado = 'registrado' and p.fecha <= p_hoy
      and p.periodo ~ '^(20[2-9][0-9]|2100)-(0[1-9]|1[0-2])$'
      and not exists (select 1 from pagos a where a.anulacion_de = p.id)
  ), limites as (
    select s.*, greatest(date_trunc('month', p_hoy::timestamp),
      date_trunc('month', s.vencimiento_inicial_mora::timestamp),
      coalesce((select max(to_date(p.periodo || '-01', 'YYYY-MM-DD'))::timestamp
                from pagos_vigentes p), date_trunc('month', p_hoy::timestamp))) as ultimo_mes,
      (select max(p.periodo) from pagos_vigentes p) as ultimo_periodo,
      (select count(*)::int from pagos p where p.suscripcion_id = s.id and p.estado = 'registrado'
        and not exists (select 1 from pagos a where a.anulacion_de = p.id)
        and (p.periodo !~ '^(20[2-9][0-9]|2100)-(0[1-9]|1[0-2])$'
          or p.periodo < to_char(s.vencimiento_inicial_mora, 'YYYY-MM')
          or p.fecha > p_hoy)) as irregularidades
    from s
  ), meses as (
    select l.*, m.mes,
      to_char(m.mes, 'YYYY-MM') as periodo,
      case when m.mes::date = date_trunc('month', l.vencimiento_inicial_mora)::date
        then l.vencimiento_inicial_mora
        else (m.mes::date + (l.dia_cobro - 1)) end as vence
    from limites l
    cross join lateral generate_series(date_trunc('month', l.vencimiento_inicial_mora::timestamp),
      l.ultimo_mes + interval '1 month', interval '1 month') m(mes)
    where l.vencimiento_inicial_mora is not null
  ), faltantes as (
    select m.* from meses m where not exists (
      select 1 from pagos_vigentes p where p.periodo = m.periodo
        and case when p.moneda = 'USD' then p.monto
                 when p.tasa_bcv > 0 then p.monto / p.tasa_bcv
                 else 0 end >= m.monto_usd
    )
  ), tardios as (
    select coalesce(string_agg(p.id::text, ',' order by p.id::text), '') as firma
    from pagos_vigentes p join meses m on m.periodo = p.periodo
    where p.fecha > m.vence or (p.creado at time zone 'UTC')::date > m.vence
  ), resumen as (
    select min(vence) as proximo,
      count(*) filter (where vence < p_hoy)::int as vencidas,
      count(*) filter (where vence <= p_hoy)::int as exigibles,
      count(*) filter (where vence <= p_hoy or periodo < ultimo_periodo)::int as pendientes
    from faltantes
  ), revision as (
    select r.* from revisiones_intereses_mora r
    where r.suscripcion_id = p_suscripcion order by r.id desc limit 1
  )
  select l.vencimiento_inicial_mora is not null, r.proximo, r.vencidas, r.exigibles, r.pendientes,
    l.irregularidades, r.exigibles * l.monto_usd, t.firma,
    case when rev.firma_pagos = t.firma then rev.intereses_debidos_usd end,
    case when rev.firma_pagos = t.firma then rev.intereses_pagados_usd end,
    l.vencimiento_inicial_mora is not null and case
      when rev.id is not null then rev.firma_pagos = t.firma and
        rev.intereses_pagados_usd >= rev.intereses_debidos_usd
      else t.firma = '' end
  from limites l cross join resumen r cross join tardios t left join revision rev on true
$$;

-- Cada operación toma primero el mismo bloqueo de la suscripción. Así un
-- pago, una anulación y una revisión no pueden abrir con una lectura vieja.
create or replace function bws_pago_mora(
  p_id uuid, p_periodo text, p_monto numeric, p_moneda text, p_tasa numeric,
  p_referencia text, p_fecha date, p_hoy date, p_ip inet, p_agente text
) returns table (pago_id uuid, anterior text, nuevo text, proximo date)
language plpgsql as $$
declare
  s suscripciones%rowtype;
  d record;
  pago uuid;
  estado_nuevo text;
begin
  select * into s from suscripciones where id = p_id for update;
  if not found or p_hoy is null or not bws_es_admin() or not bws_contrato_mora_nuevo(s.proyecto_id)
     or s.estado = 'terminada' or s.vencimiento_inicial_mora is null then
    raise exception 'No se puede registrar el pago; revise el inicio y el estado' using errcode = 'P0001';
  end if;
  if p_fecha > p_hoy then
    raise exception 'La fecha del pago no puede ser posterior a hoy' using errcode = 'P0001';
  end if;
  if p_periodo !~ '^(20[2-9][0-9]|2100)-(0[1-9]|1[0-2])$'
     or p_periodo < to_char(s.vencimiento_inicial_mora, 'YYYY-MM')
     or p_monto <= 0 or p_moneda not in ('USD', 'VES')
     or (p_moneda = 'VES' and (p_tasa is null or p_tasa <= 0))
     or (case when p_moneda = 'USD' then p_monto else p_monto / p_tasa end) < s.monto_usd then
    raise exception 'El pago no cubre una mensualidad o el periodo es anterior al inicio' using errcode = 'P0001';
  end if;
  insert into pagos (suscripcion_id, periodo, monto, moneda, tasa_bcv, referencia, fecha)
    values (p_id, p_periodo, p_monto, p_moneda, p_tasa, p_referencia, p_fecha)
    returning id into pago;
  select * into d from bws_deuda_mora(p_id, p_hoy);
  estado_nuevo := case when s.estado = 'suspendida' then 'suspendida'
    when d.vencidas > 0 or d.irregularidades > 0 or not coalesce(d.intereses_regularizados, false) then 'mora'
    else 'al_dia' end;
  update suscripciones set proximo_vencimiento = d.proximo, estado = estado_nuevo,
    dias_gracia = 0, actualizada = now() where id = p_id;
  insert into eventos (actor, rol, accion, entidad, entidad_id, detalle, ip, agente)
    values (bws_usuario_id(), 'admin', 'pago.registrado', 'suscripciones', p_id::text,
      jsonb_build_object('pago_id', pago, 'periodo', p_periodo, 'monto', p_monto,
        'moneda', p_moneda, 'tasa_bcv', p_tasa, 'referencia', p_referencia,
        'fecha', p_fecha, 'estado_anterior', s.estado, 'estado_nuevo', estado_nuevo,
        'pendientes', d.pendientes, 'intereses_regularizados', d.intereses_regularizados),
      p_ip, p_agente);
  return query select pago, s.estado, estado_nuevo, d.proximo;
end $$;

create or replace function bws_anular_pago_mora(
  p_pago uuid, p_motivo text, p_hoy date, p_ip inet, p_agente text
) returns table (suscripcion_id uuid, anterior text, nuevo text, proximo date)
language plpgsql as $$
declare
  s suscripciones%rowtype;
  p pagos%rowtype;
  d record;
  estado_nuevo text;
begin
  select * into p from pagos where id = p_pago;
  if not found then raise exception 'Pago inexistente' using errcode = 'P0001'; end if;
  select * into s from suscripciones where id = p.suscripcion_id for update;
  if not found or p_hoy is null or not bws_es_admin() or not bws_contrato_mora_nuevo(s.proyecto_id)
     or s.estado = 'terminada'
     or p.estado <> 'registrado' or exists (select 1 from pagos a where a.anulacion_de = p_pago) then
    raise exception 'No se puede anular el pago; revise el inicio y el estado' using errcode = 'P0001';
  end if;
  insert into pagos (suscripcion_id, periodo, monto, moneda, tasa_bcv, referencia,
                     fecha, estado, comprobante, anulacion_de, motivo)
    values (p.suscripcion_id, p.periodo, p.monto, p.moneda, p.tasa_bcv, p.referencia,
            p.fecha, 'anulado', p.comprobante, p_pago, p_motivo);
  select * into d from bws_deuda_mora(s.id, p_hoy);
  estado_nuevo := case when s.estado = 'suspendida' or not d.inicio_conocido then s.estado
    when d.vencidas > 0 or d.irregularidades > 0 or not coalesce(d.intereses_regularizados, false) then 'mora'
    else s.estado end;
  update suscripciones set proximo_vencimiento = coalesce(d.proximo, s.proximo_vencimiento), estado = estado_nuevo,
    dias_gracia = 0, actualizada = now() where id = s.id;
  insert into eventos (actor, rol, accion, entidad, entidad_id, detalle, ip, agente)
    values (bws_usuario_id(), 'admin', 'pago.anulado', 'pagos', p_pago::text,
      jsonb_build_object('suscripcion_id', s.id, 'periodo', p.periodo, 'motivo', p_motivo,
        'vencimiento', coalesce(d.proximo, s.proximo_vencimiento), 'inicio_conocido', d.inicio_conocido,
        'estado_anterior', s.estado, 'estado_nuevo', estado_nuevo),
      p_ip, p_agente);
  return query select s.id, s.estado, estado_nuevo, coalesce(d.proximo, s.proximo_vencimiento);
end $$;

-- El inicio se registra una sola vez y con fundamento. En una llamada
-- posterior se registra la liquidación íntegra (incluso si queda saldo), y
-- solo entonces se abre si no faltan cuotas ni intereses.
create or replace function bws_regularizar_mora(
  p_id uuid, p_inicio date, p_debidos numeric, p_pagados numeric,
  p_fundamento text, p_hoy date, p_ip inet, p_agente text
) returns table (inicio_registrado boolean, reactivada boolean, estado_actual text,
  proximo date, pendientes integer, irregularidades integer, principal_usd numeric,
  intereses_debidos_usd numeric, intereses_pagados_usd numeric)
language plpgsql as $$
declare
  s suscripciones%rowtype;
  d record;
  abre boolean := false;
  inicio_nuevo boolean := false;
begin
  if p_hoy is null then
    raise exception 'Se requiere la fecha de corte para regularizar' using errcode = 'P0001';
  end if;
  select * into s from suscripciones where id = p_id for update;
  if not found or not bws_es_admin() or not bws_contrato_mora_nuevo(s.proyecto_id)
     or s.estado = 'terminada' then
    raise exception 'No se puede regularizar la suscripción' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_fundamento, ''))) not between 5 and 500 then
    raise exception 'Se requiere fundamento documental' using errcode = 'P0001';
  end if;
  if s.vencimiento_inicial_mora is null then
    if p_inicio is null or p_inicio > s.proximo_vencimiento or exists (
      select 1 from pagos p where p.suscripcion_id = s.id and p.estado = 'registrado'
        and p.periodo < to_char(p_inicio, 'YYYY-MM')
    ) then
      raise exception 'El primer vencimiento no concuerda con los antecedentes' using errcode = 'P0001';
    end if;
    update suscripciones set vencimiento_inicial_mora = p_inicio, dias_gracia = 0,
      actualizada = now() where id = p_id;
    inicio_nuevo := true;
    select * into d from bws_deuda_mora(p_id, p_hoy);
    update suscripciones set proximo_vencimiento = d.proximo,
      estado = case when s.estado = 'al_dia' and (d.vencidas > 0 or d.irregularidades > 0
        or not coalesce(d.intereses_regularizados, false)) then 'mora' else s.estado end
      where id = p_id;
    insert into eventos (actor, rol, accion, entidad, entidad_id, detalle, ip, agente)
      values (bws_usuario_id(), 'admin', 'suscripcion.inicio_mora_registrado', 'suscripciones', p_id::text,
        jsonb_build_object('vencimiento_inicial', p_inicio, 'fundamento', p_fundamento), p_ip, p_agente);
  else
    if p_debidos is null or p_pagados is null or p_debidos < 0 or p_pagados < 0 then
      raise exception 'Indique intereses debidos y pagados' using errcode = 'P0001';
    end if;
    select * into d from bws_deuda_mora(p_id, p_hoy);
    insert into revisiones_intereses_mora
      (suscripcion_id, firma_pagos, intereses_debidos_usd, intereses_pagados_usd, fundamento, actor)
      values (p_id, d.firma_pagos, p_debidos, p_pagados, p_fundamento, bws_usuario_id());
    abre := d.pendientes = 0 and d.irregularidades = 0 and p_pagados >= p_debidos;
    if abre then
      update suscripciones set estado = 'al_dia', proximo_vencimiento = d.proximo,
        dias_gracia = 0, actualizada = now() where id = p_id;
      update licencias set estado = 'activa'
        where proyecto_id = s.proyecto_id and tipo = 'uso' and estado = 'suspendida';
    elsif s.estado = 'al_dia' and (d.vencidas > 0 or d.irregularidades > 0 or p_pagados < p_debidos) then
      update suscripciones set estado = 'mora', actualizada = now() where id = p_id;
    end if;
    insert into eventos (actor, rol, accion, entidad, entidad_id, detalle, ip, agente)
      values (bws_usuario_id(), 'admin', 'suscripcion.intereses_revisados', 'suscripciones', p_id::text,
        jsonb_build_object('fundamento', p_fundamento, 'firma_pagos', d.firma_pagos,
          'intereses_debidos_usd', p_debidos, 'intereses_pagados_usd', p_pagados,
          'pendientes', d.pendientes, 'irregularidades', d.irregularidades,
          'reactivada', abre, 'estado_anterior', s.estado), p_ip, p_agente);
  end if;
  select * into d from bws_deuda_mora(p_id, p_hoy);
  return query select inicio_nuevo, abre, (select x.estado from suscripciones x where x.id = p_id),
    d.proximo, d.pendientes, d.irregularidades, d.principal_usd, d.intereses_debidos_usd, d.intereses_pagados_usd;
end $$;
