-- Busca híbrida: texto em português mais similaridade vetorial.
--
-- "Híbrida" porque as duas metades erram de formas diferentes. O full-text acha
-- a palavra exata e não entende sinônimo; o vetorial entende a pergunta e às
-- vezes ignora o termo literal que a pessoa digitou. Juntando os dois rankings
-- por Reciprocal Rank Fusion, o que aparece bem nos dois sobe, e nenhum dos
-- dois precisa estar certo sozinho.

create extension if not exists vector   with schema extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm  with schema extensions;

-- ---------------------------------------------------------------------------
-- Normalização de texto, IMUTÁVEL
-- ---------------------------------------------------------------------------
-- `unaccent(text)` é STABLE, porque resolve o dicionário pelo search_path da
-- hora. O Postgres recusa função STABLE em índice e em coluna gerada. A
-- sobrecarga `unaccent(regdictionary, text)` é IMMUTABLE justamente por receber
-- o dicionário explícito.
--
-- O corpo vai como STRING (e não `BEGIN ATOMIC`) de propósito: assim ele é
-- reparseado a cada execução e o `::regdictionary` resolve o OID na hora. Com
-- corpo atômico, o OID ficaria congelado na árvore salva, e um
-- `drop extension unaccent` seguido de `create` (ou um restore em outra ordem)
-- deixaria a função apontando para um dicionário que não existe mais.
create or replace function public.jk_tsv_pt(txt text)
returns tsvector
language sql
immutable
parallel safe
as $$
  select to_tsvector(
           'portuguese'::regconfig,
           extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(txt, ''))
         );
$$;

-- ---------------------------------------------------------------------------
-- Trechos indexáveis
-- ---------------------------------------------------------------------------
-- Uma tabela só para guia e loja, porque a busca da home é única: quem digita
-- "aliança em osasco" não sabe nem quer saber se a resposta mora em `contents`
-- ou em `locations`.
--
-- Só entra conteúdo PUBLICADO. Filtrar status dentro da varredura vetorial
-- faria o pgvector aplicar o filtro DEPOIS de percorrer o índice, devolvendo
-- menos linhas que o limite pedido ou fazendo o planejador abandonar o índice.
-- Despublicar apaga os trechos, e a policy de leitura fica trivial.
create table public.search_chunks (
  id          uuid primary key default gen_random_uuid(),
  -- Exatamente um dos dois é preenchido. FK de verdade para o apagar em
  -- cascata funcionar sozinho, sem depender de a aplicação lembrar.
  content_id  uuid references public.contents(id)  on delete cascade,
  location_id uuid references public.locations(id) on delete cascade,
  tipo        text not null check (tipo in ('guia', 'loja')),
  -- Desnormalizados para o caminho quente da busca não precisar de join.
  slug        text not null,
  titulo      text not null,
  secao       text,
  ancora      text,
  origem      text not null default 'corpo'
              check (origem in ('corpo', 'resposta', 'resumo', 'faq', 'loja')),
  ordem       int  not null,
  texto       text not null,
  -- sha256 do texto: na republicação, só re-embeda o trecho que mudou.
  hash        text not null,
  embedding   extensions.vector(1536),
  busca       tsvector,
  created_at  timestamptz not null default now(),

  constraint search_chunks_uma_origem check (
    (content_id is not null and location_id is null and tipo = 'guia')
    or (location_id is not null and content_id is null and tipo = 'loja')
  )
);

create unique index search_chunks_conteudo_ordem on public.search_chunks (content_id, ordem)
  where content_id is not null;
create unique index search_chunks_loja_ordem on public.search_chunks (location_id, ordem)
  where location_id is not null;

-- Trigger em vez de coluna gerada: com `generated always as`, mudar a
-- tokenização exigiria reescrever a tabela inteira, e o Postgres passaria a
-- recusar alterar a função. Vamos querer afinar (sinônimo de "aliança",
-- stopword de joalheria), então precisa ser trocável com um `create or replace`
-- seguido de um `update`.
create or replace function public.jk_search_chunks_busca()
returns trigger language plpgsql as $$
begin
  new.busca := public.jk_tsv_pt(
    coalesce(new.titulo, '') || ' ' || coalesce(new.secao, '') || ' ' || new.texto
  );
  return new;
end $$;

create trigger search_chunks_busca_tg
  before insert or update of texto, secao, titulo
  on public.search_chunks
  for each row execute function public.jk_search_chunks_busca();

create index search_chunks_busca_idx on public.search_chunks using gin (busca);

create index search_chunks_hnsw_idx on public.search_chunks
  using hnsw (embedding extensions.vector_cosine_ops) with (m = 16, ef_construction = 64);

-- Trigrama SÓ no título. GIN de trigrama sobre corpo de artigo fica enorme e
-- lento, e o valor dele aqui é o "você quis dizer", não a busca do corpo.
create index search_chunks_titulo_trgm_idx on public.search_chunks
  using gin (titulo extensions.gin_trgm_ops);

alter table public.search_chunks enable row level security;

-- Leitura liberada: só existe trecho de conteúdo já publicado.
create policy search_chunks_public_read on public.search_chunks
  for select to anon, authenticated using (true);

create policy search_chunks_staff_write on public.search_chunks
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
