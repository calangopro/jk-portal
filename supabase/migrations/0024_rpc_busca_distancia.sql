-- Acrescenta a distância vetorial na saída e um corte de relevância.
--
-- Motivo medido: com o corpus atual (1 guia e 10 lojas), o ramo vetorial sempre
-- devolvia seus 60 candidatos, então as lojas apareciam em TODA consulta, mesmo
-- em "posso gravar o nome dentro?". O RRF ordena bem, mas não sabe dizer que um
-- resultado é simplesmente ruim: ele compara posições, não qualidade absoluta.
--
-- O corte entra DEPOIS da varredura vetorial, de propósito. Filtrar dentro da
-- subquery do ANN faria o Postgres aplicar o predicado durante a busca no
-- índice e devolver menos linhas que o limite pedido.
--
-- `distancia_maxima` nulo mantém o comportamento antigo, para dar para calibrar
-- sem quebrar quem já chama.

drop function if exists public.buscar_no_site(text, text, int, int, int);

create or replace function public.buscar_no_site(
  consulta         text,
  consulta_vec     text default null,
  limite           int  default 12,
  candidatos       int  default 60,
  k                int  default 60,
  distancia_maxima real default null
)
returns table (
  chunk_id uuid, tipo text, content_id uuid, location_id uuid, slug text,
  titulo text, secao text, ancora text, origem text, trecho text,
  score real, pos_lexico int, pos_vetor int, distancia real
)
language sql stable parallel safe
set search_path = public, extensions
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
    where numnode(e.tsq) > 0 and ch.busca @@ e.tsq
    order by rank desc
    limit candidatos
  ) s
),
vizinhos as (
  select ch.id, (ch.embedding <=> e.vec)::real as dist
  from public.search_chunks ch, entrada e
  where e.vec is not null and ch.embedding is not null
  order by ch.embedding <=> e.vec
  limit candidatos
),
vetor as (
  select id, dist, row_number() over (order by dist, id) as pos
  from vizinhos
  where distancia_maxima is null or dist <= distancia_maxima
),
fundido as (
  select coalesce(l.id, v.id) as id,
         (coalesce(1.0 / (k + l.pos), 0.0) + coalesce(1.0 / (k + v.pos), 0.0))::real as score,
         l.pos as pl, v.pos as pv, v.dist as dist
  from lexico l full outer join vetor v on v.id = l.id
)
select ch.id, ch.tipo, ch.content_id, ch.location_id, ch.slug, ch.titulo,
       ch.secao, ch.ancora, ch.origem, left(ch.texto, 320),
       f.score, f.pl, f.pv, f.dist
from fundido f join public.search_chunks ch on ch.id = f.id
order by f.score desc, ch.tipo, ch.ordem
limit limite;
$$;

grant execute on function public.buscar_no_site(text, text, int, int, int, real) to anon, authenticated;
