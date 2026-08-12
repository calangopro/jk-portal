-- Fase 4: estrutura de cluster, que é o que o editor precisa para virar fábrica.
--
-- Pilar e cluster fazem um conjunto de páginas ser lido como um assunto só,
-- pelo Google e pela IA. O pilar é o guia central do assunto; o cluster é o
-- nome do assunto, usado para agrupar e para achar página órfã.
--
-- O token de preview NÃO virou coluna de propósito: é assinado com HMAC a
-- partir do id, então não ocupa linha, não vaza numa leitura do banco e some
-- todo de uma vez se o segredo for trocado.

alter table public.contents
  add column if not exists cluster   text,
  add column if not exists pillar_id uuid references public.contents(id) on delete set null;

comment on column public.contents.cluster is
  'Nome do assunto que agrupa as páginas, ex.: "aliança de namoro".';
comment on column public.contents.pillar_id is
  'Guia central do cluster. Nulo quando a própria página é o pilar.';

create index if not exists contents_cluster_idx on public.contents (cluster);
create index if not exists contents_pillar_idx  on public.contents (pillar_id);

-- Consulta alvo em minúsculas: base da checagem determinística de canibalização.
create index if not exists contents_target_query_idx on public.contents (lower(target_query));

-- Consulta do grafo de links: quem aponta para uma página. É o que responde
-- "esta página está órfã" sem varrer a tabela inteira.
create index if not exists content_links_target_idx
  on public.content_links (target_content_id);
