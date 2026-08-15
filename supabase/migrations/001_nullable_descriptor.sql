-- Rode isso no SQL Editor do Supabase se você já executou o schema.sql original
-- antes desta mudança (permite cadastrar funcionário sem foto via importação CSV,
-- com o rosto pendente de captura depois).

alter table employees alter column descriptor drop not null;

alter table employees drop column if exists has_face;
alter table employees add column has_face boolean generated always as (descriptor is not null) stored;
