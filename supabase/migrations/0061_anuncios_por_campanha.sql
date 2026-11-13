-- Anúncio por campanha, conjunto e anúncio, para dizer o que está bom e o que
-- está ruim dentro de cada plataforma.
--
-- POR QUE
--
-- `anuncios_gasto` (0059) guarda o total da plataforma por dia: serve para a
-- volta por real gasto, mas não diz QUAL campanha puxa o resultado para baixo.
-- Quem decide o que pausar e onde pôr mais verba precisa dos três níveis.
--
-- COMO
--
-- Uma linha por dia, plataforma, nível e item. Os três níveis são gravados
-- separados, como a plataforma devolve, em vez de somar anúncio para chegar na
-- campanha: no Google isso não fecha (Performance Max e Shopping gastam na
-- campanha sem ter anúncio comum por baixo).
--
-- As colunas do funil são o que a PLATAFORMA diz (pixel do Meta, conversão do
-- Google). Não são venda paga: a plataforma conta pedido criado. A venda de
-- verdade continua vindo de `tray_pedidos`, e a tela mostra as duas lado a lado.
-- A Tray não guarda a campanha do pedido, só a origem, então no nível de
-- campanha o número da plataforma é o único que existe.
--
-- Quem escreve é só a rotina, com a chave de serviço. Quem tem a área de
-- tráfego lê.

create table public.anuncios_itens (
  dia           date not null,
  plataforma    text not null check (plataforma in ('meta', 'google')),
  nivel         text not null check (nivel in ('campanha', 'conjunto', 'anuncio')),
  item_id       text not null check (char_length(item_id) between 1 and 64),
  nome          text not null default '' check (char_length(nome) <= 300),
  campanha_id   text,
  conjunto_id   text,
  -- Objetivo da campanha (Meta) ou tipo de canal (Google), já em palavra nossa.
  tipo          text,
  -- Está veiculando agora. Nulo quando a plataforma não disse.
  ativo         boolean,
  gasto         numeric(12, 2) not null default 0 check (gasto >= 0),
  impressoes    integer not null default 0,
  -- Clique no link. `cliques_todos` conta qualquer clique no anúncio.
  cliques       integer not null default 0,
  cliques_todos integer,
  visitas       integer,
  carrinhos     integer,
  checkouts     integer,
  -- O Google devolve conversão fracionada.
  compras       numeric(12, 2),
  valor         numeric(14, 2),
  conversas     integer,
  atualizado_em timestamptz not null default now(),
  primary key (dia, plataforma, nivel, item_id)
);

comment on table public.anuncios_itens is
  'Desempenho por dia de cada campanha, conjunto e anúncio, como a plataforma informa. Não é venda paga.';

create index anuncios_itens_leitura_idx on public.anuncios_itens (plataforma, dia);

alter table public.anuncios_itens enable row level security;

create policy anuncios_itens_select on public.anuncios_itens
  for select to authenticated using ((select public.tem_acesso('trafego')));

revoke all on public.anuncios_itens from anon;

-- Soma do intervalo por item, com o nome e o estado mais recentes. Roda com os
-- direitos de quem chama: sem a área de tráfego, vem lista vazia.
create function public.resumo_de_anuncios(p_de date, p_ate date, p_plataforma text)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
  from (
    select
      nivel,
      item_id as id,
      (array_agg(nome order by dia desc))[1] as nome,
      (array_agg(campanha_id order by dia desc))[1] as campanha_id,
      (array_agg(conjunto_id order by dia desc))[1] as conjunto_id,
      (array_agg(tipo order by dia desc))[1] as tipo,
      (array_agg(ativo order by dia desc))[1] as ativo,
      sum(gasto) as gasto,
      sum(impressoes) as impressoes,
      sum(cliques) as cliques,
      sum(cliques_todos) as cliques_todos,
      sum(visitas) as visitas,
      sum(carrinhos) as carrinhos,
      sum(checkouts) as checkouts,
      sum(compras) as compras,
      sum(valor) as valor,
      sum(conversas) as conversas,
      count(distinct dia) as dias,
      max(dia) as ultimo_dia
    from public.anuncios_itens
    where plataforma = p_plataforma and dia between p_de and p_ate
    group by nivel, item_id
  ) t;
$$;

revoke execute on function public.resumo_de_anuncios(date, date, text) from public, anon;
grant execute on function public.resumo_de_anuncios(date, date, text) to authenticated, service_role;
