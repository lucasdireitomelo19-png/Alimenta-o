-- Rode isso no SQL Editor do Supabase. Corrige dois problemas:
--
-- 1) A coluna employees.has_face nunca foi criada nesse projeto porque a
--    migração 001_nullable_descriptor.sql não chegou a ser executada — toda
--    tela que lista funcionários (Empresas, Funcionários, Credenciais,
--    Visitantes) depende dela e quebrava com "column employees.has_face
--    does not exist".
-- 2) audit_log tinha só política de leitura — o registro automático de
--    ações (Histórico) estava sendo bloqueado com 401 ao tentar inserir.
--
-- Seguro rodar de novo caso já tenha aplicado parte disso.

alter table employees alter column descriptor drop not null;

alter table employees drop column if exists has_face;
alter table employees add column has_face boolean generated always as (descriptor is not null) stored;

drop policy if exists "anon insert audit_log" on audit_log;
create policy "anon insert audit_log" on audit_log for insert with check (true);
