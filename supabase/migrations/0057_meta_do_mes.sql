-- Meta de faturamento do mês, para o painel dizer se a loja está no ritmo.
--
-- POR QUE
--
-- A meta existia só na conversa ("queria bater 50 mil hoje"). Sem ela escrita,
-- o painel mostra quanto vendeu mas não diz se isso é bom ou ruim, e ninguém
-- sabe quanto precisa vender por dia para fechar o mês.
--
-- COMO
--
-- Uma linha por mês, com o dia 1 como chave. Quem tem a área de vendas lê;
-- quem define é administrador, dono ou GM. O valor entra pelo painel, nunca
-- por migration: é número da empresa.

create table public.metas (
  mes           date primary key check (extract(day from mes) = 1),
  valor         numeric(12, 2) not null check (valor > 0),
  definido_por  uuid references public.profiles (id) on delete set null,
  atualizado_em timestamptz not null default now()
);

comment on table public.metas is
  'Meta de faturamento pago da loja virtual em cada mês. A chave é o dia 1 do mês.';

create index metas_definido_por_idx on public.metas (definido_por);

alter table public.metas enable row level security;

create policy metas_vendas_select on public.metas
  for select to authenticated using ((select public.tem_acesso('vendas')));
create policy metas_admin_insert on public.metas
  for insert to authenticated with check ((select public.is_admin()));
create policy metas_admin_update on public.metas
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

revoke all on public.metas from anon;
