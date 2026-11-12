-- ============================================================
-- 0012 — El preset de infraestructura pasa de Vercel a Cloudflare
-- ------------------------------------------------------------
-- La clave cambia de `neon-vercel` a `neon-cloudflare` y el plan
-- Pro suma el mínimo de Workers Paid (USD 5) al de Neon Launch
-- (USD 19). No hay proyectos ni suscripciones con la clave vieja,
-- así que las filas anteriores se retiran en vez de conservarse.
-- Los presets siguen sin editarse: esta migración inserta filas
-- nuevas con su propia fuente y fecha.
-- ============================================================

delete from planes_infra where clave = 'neon-vercel';

insert into planes_infra
  (clave, nivel, version, nombre, limites, precio_usd, costo_usd, fuente, fecha, estado)
values
  (
    'neon-cloudflare', 'inicial', 1, 'Inicial',
    '[
      {"concepto": "Almacenamiento por proyecto", "valor": "1 GB"},
      {"concepto": "Cómputo", "valor": "hasta 100 horas de cómputo al mes"},
      {"concepto": "Alojamiento y funciones", "valor": "plan gratuito de Cloudflare: hasta 100.000 solicitudes al día"},
      {"concepto": "Disponibilidad", "valor": "el servicio se suspende por inactividad y se reanuda al recibir tráfico"}
    ]'::jsonb,
    0, 0, 'Condiciones públicas del plan gratuito de Neon y del plan Free de Cloudflare', '2026-11-11', 'vigente'
  ),
  (
    'neon-cloudflare', 'pro', 1, 'Pro',
    '[
      {"concepto": "Disponibilidad", "valor": "continua, sin suspensión por inactividad"},
      {"concepto": "Respaldos", "valor": "automáticos según el proveedor"},
      {"concepto": "Alojamiento y funciones", "valor": "Cloudflare Workers Paid: 30 s de CPU por solicitud"},
      {"concepto": "Límites", "valor": "ampliados según consumo y condiciones del proveedor"}
    ]'::jsonb,
    30, 24, 'Condiciones públicas del plan Launch de Neon y del plan Workers Paid de Cloudflare', '2026-11-11', 'vigente'
  )
on conflict (clave, nivel, version) do nothing;
