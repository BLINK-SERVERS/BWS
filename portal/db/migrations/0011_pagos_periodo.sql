-- ============================================================
-- 0011 — Un solo pago vigente por periodo
-- ------------------------------------------------------------
-- `pagos` es de solo agregar: anular no borra ni edita el pago
-- original, agrega una fila `anulado` que lo referencia. Por eso
-- la unicidad no puede ser un índice parcial (el original sigue
-- con `estado = 'registrado'`): la comprueba un disparador que
-- excluye los pagos que ya tienen su anulación.
--
-- El bloqueo consultivo serializa dos altas simultáneas del mismo
-- periodo; sin él, dos transacciones podrían pasar la comprobación
-- antes de que la otra confirme.
-- ============================================================

create index if not exists pagos_suscripcion_periodo_idx
  on pagos (suscripcion_id, periodo);

create or replace function bws_pago_periodo_unico() returns trigger
language plpgsql
as $$
begin
  if new.estado <> 'registrado' then
    return new;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(new.suscripcion_id::text || ':' || new.periodo, 0)
  );

  if exists (
    select 1
    from pagos p
    where p.suscripcion_id = new.suscripcion_id
      and p.periodo = new.periodo
      and p.estado = 'registrado'
      and not exists (select 1 from pagos a where a.anulacion_de = p.id)
  ) then
    raise exception 'El periodo % ya tiene un pago registrado', new.periodo
      using errcode = '23505';
  end if;

  return new;
end;
$$;

drop trigger if exists bws_pago_periodo_unico on pagos;
create trigger bws_pago_periodo_unico
  before insert on pagos
  for each row execute function bws_pago_periodo_unico();
