-- Coral — Controle de Acesso — schema Supabase (Postgres)
-- Cole isso em: Supabase Dashboard → SQL Editor → New query → Run

create table if not exists companies (
  id bigint generated always as identity primary key,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists employees (
  id bigint generated always as identity primary key,
  company_id bigint not null references companies(id) on delete cascade,
  name text not null,
  role text,
  descriptor float8[] not null,
  active boolean not null default true,
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

create policy "anon full access - companies" on companies
  for all using (true) with check (true);

create policy "anon full access - employees" on employees
  for all using (true) with check (true);

create policy "anon full access - access_rules" on access_rules
  for all using (true) with check (true);

-- access_logs: só a edge function (service role) escreve; leitura liberada pro painel ver o histórico
create policy "anon read logs" on access_logs
  for select using (true);
