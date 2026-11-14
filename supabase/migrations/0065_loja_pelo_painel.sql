-- A loja passa a ser mexida pelo painel: área de acesso e registro de cada alteração.
--
-- POR QUE
--
-- Até 13/11/2026 o painel só LIA a Tray: preço, estoque e pedido eram da loja,
-- e a regra do projeto dizia para não editar nada disso aqui. Nesse dia o dono
-- do projeto decidiu o contrário: tudo o que a API da Tray permitir passa a
-- ser feito pelo painel (produto, estoque, estado, pedido, envio, rastreio).
--
-- A Tray continua sendo a fonte de verdade. O painel não guarda um valor
-- próprio e torce para a loja concordar: ele manda a alteração para a Tray, lê
-- de volta o que ficou e só então atualiza o espelho.
--
-- COMO
--
-- Escrever na loja é o tipo de coisa que precisa de dono. Então:
--
--   1. Área nova, `loja`: quem pode alterar a loja pelo painel. Preço fica mais
--      fechado ainda (administrador, dono e GM), e essa trava mora no código
--      que grava, porque mexer em preço por fora passaria por cima da
--      aprovação de campanha.
--   2. `loja_alteracoes`: uma linha por tentativa, com quem fez, o que era e o
--      que ficou, e a resposta da Tray. Inclusive as recusadas. Ninguém escreve
--      nesta tabela pelo navegador: só a função do servidor que faz a
--      alteração, com a service_role.

alter table public.acessos_por_papel drop constraint acessos_por_papel_area_check;
alter table public.acessos_por_papel add constraint acessos_por_papel_area_check check (area in (
  'conteudo', 'site', 'catalogo', 'campanhas', 'vendas', 'recuperacao',
  'metricas', 'anuncios', 'margem', 'custos', 'equipe', 'fabrica', 'lancar_venda', 'trafego', 'loja'));

insert into public.acessos_por_papel (papel, area)
select p, 'loja' from unnest(array['admin', 'dono', 'gm', 'gerente']) as p;

create table public.loja_alteracoes (
  id         bigint generated always as identity primary key,
  feita_em   timestamptz not null default now(),
  feita_por  uuid references public.profiles (id) on delete set null,
  loja       text not null check (loja in ('jk', 'teste')),
  recurso    text not null check (recurso in ('produto', 'variacao', 'imagem', 'pedido')),
  recurso_id text not null check (char_length(recurso_id) between 1 and 40),
  rotulo     text check (char_length(rotulo) <= 300),
  antes      jsonb not null default '{}'::jsonb,
  depois     jsonb not null default '{}'::jsonb,
  resultado  text not null check (resultado in ('ok', 'recusada', 'erro')),
  http       integer,
  erro       text check (char_length(erro) <= 600)
);

comment on table public.loja_alteracoes is
  'Cada alteração que o painel mandou para a loja na Tray: quem, o que era, o que ficou e o que a Tray respondeu.';
comment on column public.loja_alteracoes.antes is
  'Só os campos que a pessoa pediu para mudar, com o valor lido da Tray logo antes de gravar.';
comment on column public.loja_alteracoes.depois is
  'Os mesmos campos, com o valor lido da Tray logo depois. Em alteração recusada, o valor pedido.';

create index loja_alteracoes_recurso_idx on public.loja_alteracoes (recurso, recurso_id, feita_em desc);
create index loja_alteracoes_quando_idx on public.loja_alteracoes (feita_em desc);
create index loja_alteracoes_quem_idx on public.loja_alteracoes (feita_por);

alter table public.loja_alteracoes enable row level security;

create policy loja_alteracoes_select on public.loja_alteracoes
  for select to authenticated using ((select public.tem_acesso('loja')));

revoke all on public.loja_alteracoes from anon;
