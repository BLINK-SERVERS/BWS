-- ============================================================
-- 0009 — Un solo borrador por cliente
-- ------------------------------------------------------------
-- El portal guarda el proyecto como borrador y lo congela al
-- enviarlo. Sin esta restricción, dos pestañas podrían crear dos
-- borradores y el cliente no sabría cuál se envió. El índice es
-- parcial: un cliente puede tener varios proyectos ya enviados,
-- pero solo un borrador a la vez.
-- ============================================================

create unique index if not exists proyectos_borrador_unico
  on proyectos (cliente_id)
  where estado = 'borrador';
