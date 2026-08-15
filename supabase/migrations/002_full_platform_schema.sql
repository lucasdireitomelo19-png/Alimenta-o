-- Coral — Controle de Acesso — banco completo pra sustentar todo o menu lateral
-- Rode isso no SQL Editor do Supabase (depois do schema.sql original + 001_nullable_descriptor.sql)

-- ---------- Lixeira: soft-delete nas tabelas principais ----------
alter table companies add column if not exists deleted_at timestamptz;
alter table employees add column if not exists deleted_at timestamptz;

-- ---------- Setores ----------
create table if not exists sectors (
  id bigint generated always as identity primary key,
  company_id bigint not null references companies(id) on delete cascade,
  name text not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- Funções ----------
create table if not exists job_functions (
  id bigint generated always as identity primary key,
  company_id bigint references companies(id) on delete cascade, -- null = função genérica, disponível pra qualquer empresa
  name text not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

alter table employees add column if not exists sector_id bigint references sectors(id) on delete set null;
alter table employees add column if not exists function_id bigint references job_functions(id) on delete set null;

-- ---------- Portões de Acesso (uma empresa pode ter mais de uma catraca) ----------
create table if not exists access_gates (
  id bigint generated always as identity primary key,
  company_id bigint not null references companies(id) on delete cascade,
  label text not null,
  gate_key text not null unique, -- é o "gateId" usado na chamada de check-in
  location text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table access_logs add column if not exists gate_id bigint references access_gates(id) on delete set null;

-- ---------- Visitantes ----------
create table if not exists visitors (
  id bigint generated always as identity primary key,
  company_id bigint not null references companies(id) on delete cascade,
  name text not null,
  document text,
  host_employee_id bigint references employees(id) on delete set null,
  descriptor float8[],
  has_face boolean generated always as (descriptor is not null) stored,
  valid_from date not null default current_date,
  valid_until date not null default current_date,
  active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- Credenciais (métodos alternativos de acesso, além do rosto) ----------
-- Nota de segurança: "code" (número de cartão/PIN) está em texto puro aqui porque
-- o hardware de cartão/PIN ainda não foi implementado — é só a estrutura. Antes de
-- usar de verdade, PIN precisa ser hasheado (nunca armazenado em texto puro).
create table if not exists credentials (
  id bigint generated always as identity primary key,
  subject_type text not null check (subject_type in ('employee', 'visitor')),
  subject_id bigint not null,
  method text not null check (method in ('face', 'card', 'pin')),
  label text,
  code text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- Usuários & Permissões do painel administrativo ----------
create table if not exists app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null default 'operador' check (role in ('admin', 'operador', 'leitura')),
  created_at timestamptz not null default now()
);

-- primeiro usuário que se cadastrar vira admin automaticamente; os demais entram como operador
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into app_users (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    case when (select count(*) from app_users) = 0 then 'admin' else 'operador' end
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- Histórico (ações administrativas — diferente do access_logs, que é de catraca) ----------
create table if not exists audit_log (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id bigint,
  detail jsonb,
  created_at timestamptz not null default now()
);

-- ---------- Row Level Security ----------
-- Mesmo protótipo aberto das outras tabelas — trocar por regras reais quando o
-- login (Supabase Auth) entrar em produção de verdade.
alter table sectors enable row level security;
alter table job_functions enable row level security;
alter table access_gates enable row level security;
alter table visitors enable row level security;
alter table credentials enable row level security;
alter table app_users enable row level security;
alter table audit_log enable row level security;

create policy "anon full access - sectors" on sectors for all using (true) with check (true);
create policy "anon full access - job_functions" on job_functions for all using (true) with check (true);
create policy "anon full access - access_gates" on access_gates for all using (true) with check (true);
create policy "anon full access - visitors" on visitors for all using (true) with check (true);
create policy "anon full access - credentials" on credentials for all using (true) with check (true);
create policy "anon read audit_log" on audit_log for select using (true);

-- app_users é a exceção: cada usuário só enxerga o próprio perfil, já nascendo mais travado
create policy "self read app_users" on app_users for select using (auth.uid() = id);
