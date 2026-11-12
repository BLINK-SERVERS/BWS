/* ============================================================
   La ficha fiscal se completa al contratar, no al crear la cuenta.
   ------------------------------------------------------------
   El registro pide nombre, teléfono, correo y clave. La razón
   social, el documento, el domicilio fiscal y el correo de
   facturación se capturan en el alta del proyecto, antes de
   enviarlo. Las columnas siguen existiendo: solo dejan de ser
   obligatorias al insertar. El teléfono se conserva obligatorio
   porque se pide en el registro.
   ============================================================ */

alter table clientes alter column razon_social drop not null;
alter table clientes alter column documento_tipo drop not null;
alter table clientes alter column documento_numero drop not null;
alter table clientes alter column domicilio_fiscal drop not null;
alter table clientes alter column correo_factura drop not null;
