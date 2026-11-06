-- 0046_conector_claude.sql
--
-- O conector do Claude (MCP) em /guias/api/mcp. Duas tabelas novas, nada do que
-- existe muda.
--
-- conector_chaves: cada linha é um acesso. Ou uma chave "jk_..." criada à mão
-- no painel (para o Claude Code), ou uma conexão feita pelo login do app do
-- Claude (OAuth), que se reconhece pelo `oauth_codigo` preenchido. A chave em
-- si nunca fica gravada: só o sha256 dela e os primeiros caracteres, para a
-- pessoa reconhecer na lista.
--
-- conector_registro: uma linha por operação que o Claude rodou, com quem, por
-- qual acesso, se deu certo e quanto tempo levou. É o que a tela
-- /admin/conector mostra em "O que o Claude fez".
--
-- As duas ficam com RLS ligada e SEM policy, como `integration_tokens`: só a
-- service_role, no servidor, lê e escreve. A chave anônima (que vai no HTML)
-- não enxerga nem a lista de acessos.

create table if not exists public.conector_chaves (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  prefixo text not null,
  hash text not null unique,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  escopo text not null default 'completo' check (escopo in ('leitura', 'completo')),
  cliente text,
  oauth_codigo text unique,
  criado_em timestamptz not null default now(),
  expira_em timestamptz,
  ultimo_uso_em timestamptz,
  revogada_em timestamptz,
  revogada_por uuid references public.profiles(id) on delete set null
);

comment on table public.conector_chaves is
  'Acessos do conector do Claude (chave manual ou login OAuth). Sem policy: só a service_role.';
comment on column public.conector_chaves.oauth_codigo is
  'Preenchido só em conexão feita pelo login do app. Único: o mesmo código não abre duas conexões.';

create index if not exists conector_chaves_profile_idx on public.conector_chaves (profile_id);

alter table public.conector_chaves enable row level security;

create table if not exists public.conector_registro (
  id bigint generated always as identity primary key,
  criado_em timestamptz not null default now(),
  chave_id uuid references public.conector_chaves(id) on delete set null,
  profile_id uuid references public.profiles(id) on delete set null,
  ferramenta text not null,
  operacao text,
  risco text,
  ok boolean not null,
  erro text,
  ms integer,
  entrada jsonb,
  alvo text
);

comment on table public.conector_registro is
  'O que o Claude fez pelo conector, uma linha por operação. Sem policy: só a service_role.';

create index if not exists conector_registro_criado_idx on public.conector_registro (criado_em desc);
create index if not exists conector_registro_chave_idx on public.conector_registro (chave_id, criado_em desc);

alter table public.conector_registro enable row level security;
