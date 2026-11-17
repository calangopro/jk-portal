-- O link da bio separado em dois: de quem veio de anúncio e de quem não veio.
--
-- O Instagram etiqueta TODO clique no link do perfil do mesmo jeito
-- (`ig / social / link_in_bio`), venha a pessoa de um anúncio ou não. Pelo
-- endereço não dá para saber. Quem sabe é o site, que reconhece o visitante:
-- desde 16/11/2026 a chegada pela bio de quem clicou num anúncio até sete dias
-- antes é gravada com as UTMs DAQUELE anúncio e a mídia terminada em `_bio`
-- (`src/lib/origem/registrar.ts`).
--
-- Esta função conta as chegadas pela bio de um período e diz quantas são de
-- quem veio de anúncio. Ela NÃO depende da marca gravada: refaz a pergunta
-- ("o mesmo visitante clicou num anúncio nos sete dias antes?") para cada
-- chegada. É o que deixa o número valer também para o que foi anotado antes
-- de a marca existir, sem reescrever linha nenhuma.
--
-- A regra do que é chegada pela bio e do que é clique em anúncio é a MESMA de
-- `chegouPelaBio` e `ehCliqueDeAnuncio` (`src/lib/origem/chegada.ts`): mudou
-- lá, muda aqui. A chegada que só HERDOU as UTMs (mídia terminada em `_bio`)
-- não conta como clique novo, senão quem voltasse pela bio a cada cinco dias
-- seria do anúncio para sempre.
--
-- Roda com os direitos de quem chama: `origem_toques` só abre para a área de
-- tráfego, e sem ela a conta vem zerada.

create or replace function public.chegadas_pela_bio(p_de date, p_ate date)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with bio as (
    select t.visitante, t.em, t.medium, t.campaign, t.clique
    from public.origem_toques t
    where t.em >= p_de::timestamp at time zone 'America/Sao_Paulo'
      and t.em < (p_ate + 1)::timestamp at time zone 'America/Sao_Paulo'
      and (
        t.entrada ~* '^/(guias/)?bio(/|$)'
        or lower(btrim(coalesce(t.content, ''))) = 'link_in_bio'
        or lower(btrim(coalesce(t.medium, ''))) ~ '_bio$'
      )
  ),
  marcada as (
    select
      b.visitante,
      -- O anúncio é o da própria chegada (anúncio que leva direto para a bio,
      -- ou chegada já gravada com as UTMs herdadas) ou o do clique de antes.
      coalesce(
        case
          when lower(btrim(coalesce(b.medium, ''))) ~ '^(paid|paga?|cpc|cpm|cpv|ppc|ads?|anuncios?|display|pmax|shopping)([_-].*)?$'
            or lower(coalesce(b.clique, '')) in ('gclid', 'gbraid', 'wbraid')
          then regexp_replace(replace(btrim(coalesce(b.campaign, '')), '+', ' '), '\s+', ' ', 'g')
        end,
        a.campanha
      ) as campanha
    from bio b
    left join lateral (
      select regexp_replace(replace(btrim(coalesce(x.campaign, '')), '+', ' '), '\s+', ' ', 'g') as campanha
      from public.origem_toques x
      where x.visitante = b.visitante
        and x.em < b.em
        and x.em >= b.em - interval '7 days'
        and lower(btrim(coalesce(x.medium, ''))) !~ '_bio$'
        and (
          lower(btrim(coalesce(x.medium, ''))) ~ '^(paid|paga?|cpc|cpm|cpv|ppc|ads?|anuncios?|display|pmax|shopping)([_-].*)?$'
          or lower(coalesce(x.clique, '')) in ('gclid', 'gbraid', 'wbraid')
          or x.canal = 'google_ads'
        )
      order by x.em desc
      limit 1
    ) a on true
  )
  select jsonb_build_object(
    'chegadas', count(*),
    'visitantes', count(distinct m.visitante),
    'de_anuncio', count(*) filter (where m.campanha is not null),
    'visitantes_de_anuncio', count(distinct m.visitante) filter (where m.campanha is not null),
    'por_campanha', coalesce((
      select jsonb_agg(jsonb_build_object('campanha', c.campanha, 'chegadas', c.chegadas, 'visitantes', c.visitantes) order by c.visitantes desc, c.chegadas desc, c.campanha)
      from (
        select n.campanha, count(*) as chegadas, count(distinct n.visitante) as visitantes
        from marcada n
        where n.campanha is not null
        group by n.campanha
        order by 3 desc, 2 desc, 1
        limit 6
      ) c
    ), '[]'::jsonb)
  )
  from marcada m
$$;

revoke execute on function public.chegadas_pela_bio(date, date) from public, anon;
grant execute on function public.chegadas_pela_bio(date, date) to authenticated, service_role;
