-- Função de busca: funde o ranking de texto com o de similaridade.
--
-- Reciprocal Rank Fusion (RRF): cada lado dá uma POSIÇÃO, e a nota final é a
-- soma de 1/(k + posição). Somar posição em vez de nota resolve o problema de
-- as duas escalas serem incomparáveis (ts_rank_cd vai de 0 a ~1 com
-- distribuição própria; distância de cosseno vai de 0 a 2 ao contrário). O que
-- aparece bem nos dois lados sobe; o que aparece muito bem em um só ainda
-- compete.
--
-- O embedding entra como TEXTO e é convertido aqui dentro. Dois motivos: evita
-- depender de como o PostgREST mapeia um array para o tipo `vector`, e deixa o
-- valor ser nulo, que é exatamente o modo de queda suave quando a chave da
-- OpenAI falta ou a chamada falha. Sem embedding, a busca vira full-text puro
-- e continua respondendo.
create or replace function public.buscar_no_site(
  consulta     text,
  consulta_vec text default null,
  limite       int  default 12,
  candidatos   int  default 60,
  k            int  default 60
)
returns table (
  chunk_id    uuid,
  tipo        text,
  content_id  uuid,
  location_id uuid,
  slug        text,
  titulo      text,
  secao       text,
  ancora      text,
  origem      text,
  trecho      text,
  score       real,
  pos_lexico  int,
  pos_vetor   int
)
language sql
stable
parallel safe
-- `extensions` no search_path é obrigatório: o operador `<=>` é resolvido pelo
-- search_path, não pela qualificação do tipo. Com `search_path = ''` esta
-- função quebraria com "operator does not exist".
set search_path = public, extensions
-- NOTA sobre `hnsw.ef_search` (quantos vizinhos o índice visita):
-- fixar em 80 aqui seria melhor para recall, mas o Supabase recusa com
-- "permission denied to set parameter", porque a GUC só é registrada depois de
-- a biblioteca do pgvector carregar na sessão, e a validação do SET acontece
-- antes. Com o corpus atual (dezenas de trechos) o padrão 40 varre quase tudo
-- de qualquer jeito. Quando passar de alguns milhares de trechos, o caminho é
-- transformar esta função em plpgsql e chamar
-- `set_config('hnsw.ef_search', '80', true)` já dentro do corpo, quando a
-- extensão comprovadamente está carregada.
as $$
with entrada as (
  select
    websearch_to_tsquery('portuguese'::regconfig, extensions.unaccent(coalesce(consulta, ''))) as tsq,
    nullif(btrim(coalesce(consulta_vec, '')), '')::extensions.vector as vec
),
lexico as (
  select id, row_number() over (order by rank desc, id) as pos
  from (
    select ch.id, ts_rank_cd(ch.busca, e.tsq) as rank
    from public.search_chunks ch, entrada e
    -- `numnode > 0` porque consulta só de stopword ("o que é") vira tsquery
    -- VAZIO, e não nulo. Sem esta checagem o ramo léxico sumiria em silêncio e
    -- a busca viraria 100% vetorial sem ninguém perceber.
    where numnode(e.tsq) > 0 and ch.busca @@ e.tsq
    order by rank desc
    limit candidatos
  ) s
),
vetor as (
  -- A subquery interna existe para o HNSW ser usado de verdade. Se o
  -- `row_number()` ficasse no mesmo nível do `order by ... limit`, o Postgres
  -- ordenaria a TABELA INTEIRA por distância antes de limitar, e o índice seria
  -- ignorado. É o erro clássico de juntar pgvector com RRF.
  select id, row_number() over (order by dist, id) as pos
  from (
    select ch.id, ch.embedding <=> e.vec as dist
    from public.search_chunks ch, entrada e
    where e.vec is not null and ch.embedding is not null
    order by ch.embedding <=> e.vec
    limit candidatos
  ) s
),
fundido as (
  select
    coalesce(l.id, v.id) as id,
    (coalesce(1.0 / (k + l.pos), 0.0) + coalesce(1.0 / (k + v.pos), 0.0))::real as score,
    l.pos as pl,
    v.pos as pv
  from lexico l
  full outer join vetor v on v.id = l.id
)
select
  ch.id, ch.tipo, ch.content_id, ch.location_id, ch.slug, ch.titulo,
  ch.secao, ch.ancora, ch.origem, left(ch.texto, 320),
  f.score, f.pl, f.pv
from fundido f
join public.search_chunks ch on ch.id = f.id
order by f.score desc, ch.tipo, ch.ordem
limit limite;
$$;

-- Quem pode chamar: qualquer visitante, porque a busca é pública.
grant execute on function public.buscar_no_site(text, text, int, int, int) to anon, authenticated;
