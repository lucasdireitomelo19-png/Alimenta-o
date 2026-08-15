-- Coral — Controle de Acesso — schema Supabase (Postgres)
-- Cole isso em: Supabase Dashboard → SQL Editor → New query → Run

create table if not exists companies (
  id bigint generated always as identity primary key,
  name text not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists employees (
  id bigint generated always as identity primary key,
  company_id bigint not null references companies(id) on delete cascade,
  name text not null,
  role text,
  -- nullable: um funcionário importado via CSV começa sem rosto capturado
  descriptor float8[],
  has_face boolean generated always as (descriptor is not null) stored,
  active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists access_rules (
  employee_id bigint primary key references employees(id) on delete cascade,
  days int[] not null default '{1,2,3,4,5}',
  cafe_allowed boolean not null default false,
  cafe_start text not null default '07:00',
  cafe_end text not null default '09:00',
  almoco_allowed boolean not null default true,
  almoco_start text not null default '11:30',
  almoco_end text not null default '14:00',
  janta_allowed boolean not null default false,
  janta_start text not null default '18:00',
  janta_end text not null default '20:00'
);

create table if not exists access_logs (
  id bigint generated always as identity primary key,
  employee_id bigint references employees(id) on delete set null,
  employee_name text,
  company_name text,
  ts timestamptz not null default now(),
  granted boolean not null,
  reason text not null,
  meal_type text,
  distance float8
);

-- Cria a regra de acesso padrão automaticamente ao cadastrar um funcionário
create or replace function create_default_access_rule()
returns trigger as $$
begin
  insert into access_rules (employee_id) values (new.id);
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_create_default_access_rule on employees;
create trigger trg_create_default_access_rule
  after insert on employees
  for each row execute function create_default_access_rule();

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
-- Protótipo: painel administrativo ainda não tem login, então libera leitura/escrita
-- em companies/employees/access_rules pra chave "anon". A tabela employees guarda o
-- descriptor (dado biométrico) e por isso é a mais sensível — antes de ir pra produção
-- de verdade, isso precisa ficar atrás de autenticação (Supabase Auth) em vez de aberto
-- pra chave anônima.
alter table companies enable row level security;
alter table employees enable row level security;
alter table access_rules enable row level security;
alter table access_logs enable row level security;
alter table sectors enable row level security;
alter table job_functions enable row level security;
alter table access_gates enable row level security;
alter table visitors enable row level security;
alter table credentials enable row level security;
alter table app_users enable row level security;
alter table audit_log enable row level security;

-- drop policy if exists antes de cada create: torna esse arquivo seguro pra rodar
-- de novo em um banco que já existe, sem travar em "policy already exists".
drop policy if exists "anon full access - companies" on companies;
create policy "anon full access - companies" on companies
  for all using (true) with check (true);

drop policy if exists "anon full access - employees" on employees;
create policy "anon full access - employees" on employees
  for all using (true) with check (true);

drop policy if exists "anon full access - access_rules" on access_rules;
create policy "anon full access - access_rules" on access_rules
  for all using (true) with check (true);

-- access_logs: só a edge function (service role) escreve; leitura liberada pro painel ver o histórico
drop policy if exists "anon read logs" on access_logs;
create policy "anon read logs" on access_logs
  for select using (true);

drop policy if exists "anon full access - sectors" on sectors;
create policy "anon full access - sectors" on sectors for all using (true) with check (true);
drop policy if exists "anon full access - job_functions" on job_functions;
create policy "anon full access - job_functions" on job_functions for all using (true) with check (true);
drop policy if exists "anon full access - access_gates" on access_gates;
create policy "anon full access - access_gates" on access_gates for all using (true) with check (true);
drop policy if exists "anon full access - visitors" on visitors;
create policy "anon full access - visitors" on visitors for all using (true) with check (true);
drop policy if exists "anon full access - credentials" on credentials;
create policy "anon full access - credentials" on credentials for all using (true) with check (true);
drop policy if exists "anon read audit_log" on audit_log;
create policy "anon read audit_log" on audit_log for select using (true);

-- app_users é a exceção: cada usuário só enxerga o próprio perfil, já nascendo mais travado
drop policy if exists "self read app_users" on app_users;
create policy "self read app_users" on app_users for select using (auth.uid() = id);
