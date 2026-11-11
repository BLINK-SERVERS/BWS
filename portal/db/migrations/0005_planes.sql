-- ============================================================
-- 0005 — Presets de infraestructura (versión 1)
-- ------------------------------------------------------------
-- Son los planes de la aplicación del cliente, no del portal.
-- El anexo B imprime la fila elegida con su fuente y fecha. Los
-- presets no se editan: si cambian los límites del proveedor se
-- inserta una versión nueva y la anterior pasa a `retirado`.
-- ============================================================

insert into planes_infra
  (clave, nivel, version, nombre, limites, precio_usd, costo_usd, fuente, fecha, estado)
values
  (
    'supabase', 'inicial', 1, 'Inicial',
    '[
      {"concepto": "Usuarios activos por mes", "valor": "hasta 50.000"},
      {"concepto": "Almacenamiento de archivos", "valor": "1 GB"},
      {"concepto": "Espacio de base de datos", "valor": "500 MB"},
      {"concepto": "Disponibilidad", "valor": "el servicio se pausa tras siete (7) días continuos sin actividad"}
    ]'::jsonb,
    0, 0, 'Condiciones públicas del plan gratuito de Supabase', '2026-11-11', 'vigente'
  ),
  (
    'supabase', 'pro', 1, 'Pro',
    '[
      {"concepto": "Disponibilidad", "valor": "continua, sin pausa por inactividad"},
      {"concepto": "Respaldos", "valor": "diarios automáticos"},
      {"concepto": "Límites", "valor": "ampliados según las condiciones del proveedor"}
    ]'::jsonb,
    30, 25, 'Condiciones públicas del plan Pro de Supabase', '2026-11-11', 'vigente'
  ),
  (
    'neon-vercel', 'inicial', 1, 'Inicial',
    '[
      {"concepto": "Almacenamiento por proyecto", "valor": "1 GB"},
      {"concepto": "Cómputo", "valor": "hasta 100 horas de cómputo al mes"},
      {"concepto": "Disponibilidad", "valor": "el servicio se suspende por inactividad y se reanuda al recibir tráfico"}
    ]'::jsonb,
    0, 0, 'Condiciones públicas del plan gratuito de Neon', '2026-11-11', 'vigente'
  ),
  (
    'neon-vercel', 'pro', 1, 'Pro',
    '[
      {"concepto": "Disponibilidad", "valor": "continua, sin suspensión por inactividad"},
      {"concepto": "Respaldos", "valor": "automáticos según el proveedor"},
      {"concepto": "Límites", "valor": "ampliados según consumo y condiciones del proveedor"}
    ]'::jsonb,
    30, 19, 'Condiciones públicas del plan Launch de Neon y del plan Pro de Vercel', '2026-11-11', 'vigente'
  )
on conflict (clave, nivel, version) do nothing;
