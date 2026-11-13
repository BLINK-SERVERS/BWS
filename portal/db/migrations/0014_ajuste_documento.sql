-- ============================================================
-- 0014 — Ajuste a mano de un documento del expediente
-- ------------------------------------------------------------
-- Blink revisa los PDF generados, los ajusta fuera del sistema y
-- los vuelve a subir. `documentos` es de solo agregar y tiene
-- `unique (proyecto_id, plantilla_codigo)`, así que el archivo
-- ajustado no puede reemplazar al generado: necesita su propia
-- fila. El sello y la cadena del expediente quedan intactos y la
-- prueba de qué salió por correo es este registro.
--
-- Dos hashes conviven en la fila: `sha256_original` es el del PDF
-- generado (coincide con `documentos.hash_archivo`, y la clave
-- ajena lo garantiza) y `sha256_ajustado` el del archivo subido.
-- La última fila por documento es la que se sirve y se adjunta al
-- correo; las anteriores se conservan como historial.
-- ============================================================

-- Dos claves compuestas para que el ajuste quede atado, por la
-- base de datos, al documento y al hash que dice estar ajustando.
create unique index if not exists documentos_id_proyecto_unica
  on documentos (id, proyecto_id);
create unique index if not exists documentos_id_hash_unica
  on documentos (id, hash_archivo);

create table if not exists documentos_ajustados (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid not null,
  proyecto_id uuid not null,
  pdf bytea not null,
  sha256_original text not null,
  sha256_ajustado text not null check (sha256_ajustado ~ '^[0-9a-f]{64}$'),
  nota text,
  actor uuid not null references usuarios(id),
  utc timestamptz not null default now(),
  foreign key (documento_id, proyecto_id) references documentos (id, proyecto_id),
  foreign key (documento_id, sha256_original) references documentos (id, hash_archivo),
  -- Subir dos veces el mismo archivo no crea dos filas.
  unique (documento_id, sha256_ajustado),
  check (nota is null or length(trim(nota)) <= 500)
);

create index if not exists documentos_ajustados_documento_idx
  on documentos_ajustados (documento_id, utc desc);
create index if not exists documentos_ajustados_proyecto_idx
  on documentos_ajustados (proyecto_id, utc desc);

-- Solo agregar, como el resto de la evidencia.
drop trigger if exists bws_solo_agregar on documentos_ajustados;
create trigger bws_solo_agregar
  before update or delete on documentos_ajustados
  for each row execute function bws_abortar_cambio();

-- La tabla nace después de 0006 y el dueño tiene privilegios por
-- defecto (`arwd`) para las tablas nuevas, así que el UPDATE y el
-- DELETE hay que quitarlos aquí, no solo omitir el grant.
grant select, insert on documentos_ajustados to bws_app;
revoke update, delete on documentos_ajustados from bws_app;

alter table documentos_ajustados enable row level security;

drop policy if exists ajustes_lectura on documentos_ajustados;
create policy ajustes_lectura on documentos_ajustados
  for select using (bws_proyecto_propio(proyecto_id) or bws_es_admin());

-- Solo la administración registra un ajuste: el cliente recibe el
-- archivo, no lo edita.
drop policy if exists ajustes_alta on documentos_ajustados;
create policy ajustes_alta on documentos_ajustados
  for insert with check (bws_es_admin());
