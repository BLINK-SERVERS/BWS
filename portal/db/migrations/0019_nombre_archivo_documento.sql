-- Los documentos existentes conservan NULL y su nombre histórico de descarga.
-- El nombre de los nuevos se inserta al generar; documentos es de solo agregar.
alter table documentos add column if not exists nombre_archivo text;

create or replace function public.bws_verificacion_publica(p_documento uuid)
returns table (
  id uuid,
  titular text,
  titulo text,
  estado text,
  hash_archivo text,
  hash_ajustado text
)
language sql stable security definer
set search_path = pg_catalog, pg_temp
as $$
  select d.id,
         coalesce(nullif(d.contexto_sello #>> '{datos,variables,cliente_razon_social}', ''), c.razon_social),
         coalesce(nullif(regexp_replace(d.nombre_archivo, '\.pdf$', '', 'i'), ''), t.contenido->>'titulo'),
         case
           when d.estado = 'anulado' then 'anulado'
           when d.estado in ('firmado', 'enviado')
             and exists (
               select 1 from public.actos_firma a
               where a.documento_id = d.id
                 and a.firmante = 'representante' and a.sello = d.sello
             )
             and exists (
               select 1 from public.actos_firma a
               where a.documento_id = d.id
                 and a.firmante = 'cliente' and a.sello = d.sello
             ) then 'confirmado'
           else 'pendiente'
         end,
         d.hash_archivo, ajuste.sha256_ajustado
  from public.documentos d
  join public.proyectos p on p.id = d.proyecto_id
  join public.clientes c on c.id = p.cliente_id
  join public.plantillas t
    on t.codigo = d.plantilla_codigo and t.version = d.plantilla_version
  left join lateral (
    select a.sha256_ajustado
    from public.documentos_ajustados a
    where a.documento_id = d.id
    order by a.utc desc, a.id
    limit 1
  ) ajuste on true
  where d.id = p_documento
$$;

revoke all on function public.bws_verificacion_publica(uuid) from public;
grant execute on function public.bws_verificacion_publica(uuid) to bws_app;
