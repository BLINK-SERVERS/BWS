-- ============================================================
-- 0001 — Esquema base de bws-contratos
-- ------------------------------------------------------------
-- Todas las tablas del portal. Las firmas, los actos, los
-- documentos, los envíos, los pagos, los representantes y los
-- eventos son de solo agregar; sus triggers viven en 0002.
-- ============================================================

create table if not exists usuarios (
  id uuid primary key default gen_random_uuid(),
  correo text not null,
  clave_hash text not null,
  nombre text not null,
  rol text not null default 'cliente' check (rol in ('cliente', 'admin')),
  correo_verificado boolean not null default false,
  bloqueado boolean not null default false,
  creado timestamptz not null default now()
);

create table if not exists sesiones (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id),
  token_hash text not null unique,
  expira timestamptz not null,
  ip inet,
  agente text,
  revocada boolean not null default false,
  creada timestamptz not null default now()
);

create table if not exists tokens_correo (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id),
  tipo text not null check (tipo in ('verificacion', 'recuperacion')),
  token_hash text not null unique,
  expira timestamptz not null,
  usado boolean not null default false,
  creado timestamptz not null default now()
);

create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null unique references usuarios(id),
  razon_social text not null,
  documento_tipo text not null check (documento_tipo in ('RIF', 'cedula', 'pasaporte')),
  documento_numero text not null,
  domicilio_fiscal text not null,
  telefono text not null,
  correo_factura text not null,
  firma_actual uuid,
  creado timestamptz not null default now(),
  unique (documento_tipo, documento_numero)
);

create table if not exists firmas_cliente (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id),
  png bytea not null,
  sha256 text not null,
  ip inet,
  agente text,
  utc timestamptz not null,
  metodo text not null check (metodo in ('simple_reforzada', 'papel')),
  version integer not null check (version > 0),
  hash_consentimiento text not null,
  motivo text,
  reemplaza_a uuid references firmas_cliente(id),
  creada timestamptz not null default now()
);

-- La firma original es única por cliente; un reemplazo lleva motivo y
-- apunta a la anterior, que permanece intacta.
create unique index if not exists firmas_cliente_original_unica
  on firmas_cliente (cliente_id) where motivo is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'clientes_firma_actual_fk'
  ) then
    alter table clientes
      add constraint clientes_firma_actual_fk
      foreign key (firma_actual) references firmas_cliente(id);
  end if;
end $$;

create table if not exists representantes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  documento text not null,
  correo text,
  png bytea not null,
  sha256 text not null,
  utc timestamptz not null,
  creado timestamptz not null default now()
);

create table if not exists planes_infra (
  clave text not null,
  nivel text not null,
  version integer not null check (version > 0),
  nombre text not null,
  limites jsonb not null,
  precio_usd numeric(10, 2) not null check (precio_usd >= 0),
  costo_usd numeric(10, 2) not null check (costo_usd >= 0),
  margen_usd numeric(10, 2) generated always as (precio_usd - costo_usd) stored,
  fuente text not null,
  fecha date not null,
  estado text not null default 'vigente' check (estado in ('vigente', 'retirado')),
  primary key (clave, nivel, version)
);

-- Un solo preset vigente por proveedor y nivel; los retirados se conservan
-- para que un anexo antiguo siga imprimiendo lo que se firmó.
create unique index if not exists planes_vigente_unico
  on planes_infra (clave, nivel) where estado = 'vigente';

create table if not exists proyectos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id),
  nombre text not null,
  categoria text not null,
  dominio text not null,
  buzones jsonb not null default '[]'::jsonb,
  alcance text not null,
  complejidad text not null check (complejidad in ('simple', 'media', 'alta')),
  plan_clave text not null,
  plan_nivel text not null,
  plan_version integer not null,
  estado text not null default 'borrador'
    check (estado in ('borrador', 'enviado', 'en_revision', 'aprobado', 'entregado', 'terminado')),
  creado timestamptz not null default now(),
  enviado timestamptz,
  foreign key (plan_clave, plan_nivel, plan_version)
    references planes_infra(clave, nivel, version),
  constraint proyectos_buzones_cantidad check (
    jsonb_typeof(buzones) = 'array' and jsonb_array_length(buzones) between 1 and 5
  )
);

create table if not exists plantillas (
  codigo text not null,
  version integer not null check (version > 0),
  contenido jsonb not null,
  sha256 text not null,
  activa boolean not null default true,
  publicada timestamptz not null default now(),
  primary key (codigo, version)
);

-- Una sola versión activa por documento.
create unique index if not exists plantillas_activa_unica
  on plantillas (codigo) where activa;

create table if not exists documentos (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references proyectos(id),
  plantilla_codigo text not null,
  plantilla_version integer not null,
  orden integer not null check (orden > 0),
  pdf bytea not null,
  sello text not null,
  hash_archivo text not null,
  hash_anterior text not null,
  hash_cadena text not null,
  estado text not null default 'generado'
    check (estado in ('generado', 'firmado', 'enviado', 'anulado')),
  creado timestamptz not null default now(),
  firmado timestamptz,
  unique (proyecto_id, plantilla_codigo),
  unique (proyecto_id, orden),
  foreign key (plantilla_codigo, plantilla_version) references plantillas(codigo, version)
);

create table if not exists actos_firma (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid not null references documentos(id),
  firmante text not null check (firmante in ('representante', 'cliente')),
  firma_id uuid references firmas_cliente(id),
  representante_id uuid references representantes(id),
  sello text not null,
  ip inet,
  agente text,
  utc timestamptz not null,
  creado timestamptz not null default now(),
  unique (documento_id, firmante),
  constraint actos_firma_origen check (
    (firmante = 'cliente' and firma_id is not null and representante_id is null)
    or (firmante = 'representante' and representante_id is not null and firma_id is null)
  )
);

create table if not exists eventos (
  id bigint generated always as identity primary key,
  ocurrido timestamptz not null default now(),
  actor uuid references usuarios(id),
  rol text,
  accion text not null,
  entidad text not null,
  entidad_id text,
  detalle jsonb,
  ip inet,
  agente text
);

create table if not exists envios (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid not null references documentos(id),
  proveedor text not null,
  mensaje_id text,
  clave_idempotencia text not null unique,
  estado text not null check (estado in ('pendiente', 'enviado', 'fallido')),
  error text,
  utc timestamptz not null default now()
);

create table if not exists limites (
  clave text primary key,
  intentos integer not null default 0 check (intentos >= 0),
  ventana_inicio timestamptz not null default now(),
  expira timestamptz not null
);

create table if not exists suscripciones (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null unique references proyectos(id),
  plan_clave text not null,
  plan_nivel text not null,
  plan_version integer not null,
  monto_usd numeric(10, 2) not null check (monto_usd >= 0),
  moneda text not null default 'USD' check (moneda in ('USD', 'VES')),
  dia_cobro integer not null check (dia_cobro between 1 and 28),
  proximo_vencimiento date not null,
  dias_gracia integer not null default 5 check (dias_gracia >= 0),
  estado text not null default 'al_dia'
    check (estado in ('al_dia', 'mora', 'suspendida', 'terminada')),
  creada timestamptz not null default now(),
  actualizada timestamptz not null default now(),
  foreign key (plan_clave, plan_nivel, plan_version)
    references planes_infra(clave, nivel, version)
);

create table if not exists pagos (
  id uuid primary key default gen_random_uuid(),
  suscripcion_id uuid not null references suscripciones(id),
  periodo text not null,
  monto numeric(14, 2) not null check (monto > 0),
  moneda text not null check (moneda in ('USD', 'VES')),
  tasa_bcv numeric(14, 4),
  referencia text not null,
  fecha date not null,
  estado text not null default 'registrado' check (estado in ('registrado', 'anulado')),
  comprobante bytea,
  anulacion_de uuid references pagos(id),
  motivo text,
  creado timestamptz not null default now(),
  constraint pagos_anulacion_coherente check (
    (estado = 'registrado' and anulacion_de is null and motivo is null)
    or (estado = 'anulado' and anulacion_de is not null and motivo is not null)
  )
);

create table if not exists licencias (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references proyectos(id),
  tipo text not null check (tipo in ('uso', 'compra_codigo', 'compra_arquitectura')),
  alcance text not null,
  inicio date not null,
  fin date,
  estado text not null default 'activa' check (estado in ('activa', 'suspendida', 'terminada')),
  condiciones text,
  creado timestamptz not null default now(),
  check (fin is null or fin >= inicio)
);
