-- Lectura pública acotada al UUID: no abre políticas RLS ni entrega archivos.
-- El dueño que aplica la migración debe ser el dueño de las tablas, como en 0004.
create function public.bws_verificacion_publica(p_documento uuid)
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
  select d.id, c.razon_social, t.contenido->>'titulo',
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
