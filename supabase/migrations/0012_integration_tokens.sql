-- Tokens de integração (Tray, e futuramente Google).
--
-- Tabela deliberadamente SEM POLICY: com RLS ligado e nenhuma policy, nem anon
-- nem authenticated conseguem ler. Só a service_role (que ignora RLS, usada
-- apenas no servidor) tem acesso. É o lugar certo para access_token e
-- refresh_token, que não podem ficar no config público de `integrations`.

create table public.integration_tokens (
  provider        text primary key,
  access_token    text,
  refresh_token   text,
  expires_at      timestamptz,
  meta            jsonb not null default '{}'::jsonb,
  updated_at      timestamptz not null default now()
);

alter table public.integration_tokens enable row level security;

-- Nenhuma policy de propósito. Ver comentário acima.

create trigger integration_tokens_set_updated_at
  before update on public.integration_tokens
  for each row execute function public.set_updated_at();

comment on table public.integration_tokens is
  'Tokens de integração. Sem policy: acesso exclusivo da service_role no servidor.';
