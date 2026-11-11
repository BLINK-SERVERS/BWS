-- ============================================================
-- 0003 — Índices
-- ------------------------------------------------------------
-- Cubren las consultas del portal: sesión, expedientes por cliente,
-- auditoría por entidad, pagos por suscripción y mora por vencer.
-- ============================================================

create unique index if not exists usuarios_correo_unico on usuarios (lower(correo));

create index if not exists sesiones_usuario_idx on sesiones (usuario_id);
create index if not exists sesiones_expira_idx on sesiones (expira) where revocada = false;

create index if not exists tokens_correo_usuario_idx on tokens_correo (usuario_id, tipo);
create index if not exists tokens_correo_expira_idx on tokens_correo (expira) where usado = false;

create index if not exists clientes_usuario_idx on clientes (usuario_id);

create index if not exists firmas_cliente_cliente_idx on firmas_cliente (cliente_id, utc);

create index if not exists proyectos_cliente_idx on proyectos (cliente_id);
create unique index if not exists proyectos_dominio_unico on proyectos (lower(dominio));

create index if not exists documentos_proyecto_idx on documentos (proyecto_id, orden);
create index if not exists documentos_sello_idx on documentos (sello);

create index if not exists actos_firma_documento_idx on actos_firma (documento_id);
create index if not exists actos_firma_firma_idx on actos_firma (firma_id);

create index if not exists eventos_entidad_idx on eventos (entidad, entidad_id, ocurrido);
create index if not exists eventos_actor_idx on eventos (actor, ocurrido);

create index if not exists envios_documento_idx on envios (documento_id, utc);

create index if not exists limites_expira_idx on limites (expira);

create index if not exists pagos_suscripcion_idx on pagos (suscripcion_id, fecha);
create unique index if not exists pagos_anulacion_unica
  on pagos (anulacion_de) where anulacion_de is not null;

create index if not exists licencias_proyecto_idx on licencias (proyecto_id, tipo);
create index if not exists suscripciones_vencimiento_idx
  on suscripciones (proximo_vencimiento) where estado in ('al_dia', 'mora');
