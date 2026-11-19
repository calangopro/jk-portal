-- 0170: a origem do negócio da Kommo até o anúncio (cartão 48, fase 4 do plano da Kommo).
--
-- O anúncio de clique para WhatsApp do Meta não passa pelo site: a pessoa
-- toca no anúncio e cai direto na conversa. O coletor de origem (0064) nunca
-- vê essa chegada, e a UTM não existe. O que existe é o que o Meta entrega à
-- Kommo junto da primeira mensagem: os campos de rastreio "Meta Ads ID do
-- anúncio", "do conjunto" e "da campanha", que o espelho (0160) já guarda em
-- `meta_ad_id`, `meta_adset_id` e `meta_campaign_id`.
--
-- A REGRA É A DE `origem_resolvida` (0112): pelo NÚMERO, nunca no chute.
--   1. o anúncio: `meta_ad_id`, depois `ad_id`, procurado entre os anúncios
--      de `anuncios_itens`; achou, a campanha e o conjunto são os DO ANÚNCIO;
--   2. sem anúncio que case, o conjunto: `meta_adset_id` entre os conjuntos;
--   3. sem conjunto, a campanha: `meta_campaign_id`, `utm_id` ou
--      `utm_campaign` (só quando é número) entre as campanhas.
-- Número que não está em `anuncios_itens` fica sem anúncio ("id sem casar"),
-- e número que aparece em duas plataformas no mesmo nível também. Ligação por
-- NOME (o que a 0112 faz com a UTM do site) não entra: em 18/11 nenhum
-- negócio chegou com UTM, e o clique para WhatsApp sempre traz o número.
-- A mesma regra mora em `anuncioDoNegocio` (`src/lib/kommo/origem.ts`), que
-- tem teste: mudou uma, muda a outra.
--
-- VENDA QUE CONTA UMA VEZ SÓ. A fase 3 (0165) liga o negócio ganho ao pedido
-- da loja pelo campo "Pedido Tray" (`kommo_vendas.pedido`, estado 'marcada').
-- Se esse pedido já está ligado a um anúncio pela UTM (`origem_resolvida`),
-- ele já aparece em "Resultado (UTM)" na tabela de Campanhas, e o negócio NÃO
-- soma de novo na venda do WhatsApp: vira "também na loja". A 0165 entra por
-- SQL dinâmico guardado por `to_regclass`, para esta migration rodar com ou
-- sem a fase 3 no banco.
--
-- Venda ganha é a fase 'ganho' de `fases_da_kommo` (0162): o 142 de funil de
-- pós-venda é pós-venda, não venda.
--
-- Nada aqui escreve na Kommo nem nas tabelas `kommo_*`. Leitura por funções
-- `security definer` com a área `trafego` conferida por dentro.

-- ---------------------------------------------------------------------------
-- A ligação de cada negócio do período, uma linha por negócio. Uso interno:
-- só as funções desta migration chamam.
-- ---------------------------------------------------------------------------
create or replace function public.kommo_anuncio_dos_negocios(p_de date, p_ate date)
returns table (
  negocio_id bigint, criado_dia date, fechado_dia date, ganho boolean, valor numeric,
  tem_id boolean, tem_utm boolean,
  plataforma text, campanha_id text, conjunto_id text, anuncio_id text, ligado_por text
)
language sql
stable
set search_path = ''
as $$
  with neg as (
    select n.*,
           (n.criado_em at time zone 'America/Sao_Paulo')::date as c_dia,
           (coalesce(n.fechado_em, n.etapa_desde) at time zone 'America/Sao_Paulo')::date as f_dia,
           coalesce(x.fase = 'ganho', false) as e_ganho
      from public.kommo_negocios n
      left join public.fases_da_kommo x on x.funil_id = n.funil_id and x.etapa_id = n.etapa_id
     where not n.apagado
       and ((n.criado_em at time zone 'America/Sao_Paulo')::date between p_de and p_ate
            or (coalesce(x.fase = 'ganho', false)
                and (coalesce(n.fechado_em, n.etapa_desde) at time zone 'America/Sao_Paulo')::date between p_de and p_ate))
  ),
  -- O número que vale de cada nível, só com dígitos (campo de rastreio às vezes vem com espaço).
  ids as (
    select n.id,
           nullif(regexp_replace(coalesce(n.meta_ad_id, ''), '\D', '', 'g'), '') as ad1,
           nullif(regexp_replace(coalesce(n.ad_id, ''), '\D', '', 'g'), '') as ad2,
           nullif(regexp_replace(coalesce(n.meta_adset_id, ''), '\D', '', 'g'), '') as conj,
           nullif(regexp_replace(coalesce(n.meta_campaign_id, ''), '\D', '', 'g'), '') as camp1,
           case when btrim(coalesce(n.utm_id, '')) ~ '^\d{6,}$' then btrim(n.utm_id) end as camp2,
           case when btrim(coalesce(n.utm_campaign, '')) ~ '^\d{6,}$' then btrim(n.utm_campaign) end as camp3
      from neg n
  ),
  -- Cada item que a plataforma já informou, com a campanha e o conjunto mais recentes.
  catalogo as materialized (
    select a.plataforma, a.nivel, a.item_id,
           (array_agg(a.campanha_id order by a.dia desc))[1] as campanha_id,
           (array_agg(a.conjunto_id order by a.dia desc))[1] as conjunto_id
      from public.anuncios_itens a
     where a.item_id in (select unnest(array[ad1, ad2, conj, camp1, camp2, camp3]) from ids)
     group by a.plataforma, a.nivel, a.item_id
  ),
  -- Achou em UMA plataforma só: com duas, é ambíguo e não liga.
  unico as (
    select nivel, item_id, min(plataforma) as plataforma, min(campanha_id) as campanha_id, min(conjunto_id) as conjunto_id
      from catalogo
     group by nivel, item_id
    having count(*) = 1
  ),
  casado as (
    select i.id,
           coalesce(an1.item_id, an2.item_id) as anuncio,
           coalesce(an1.plataforma, an2.plataforma) as plat_an,
           coalesce(an1.campanha_id, an2.campanha_id) as camp_an,
           coalesce(an1.conjunto_id, an2.conjunto_id) as conj_an,
           cj.item_id as conjunto, cj.plataforma as plat_cj, cj.campanha_id as camp_cj,
           coalesce(cp1.item_id, cp2.item_id, cp3.item_id) as campanha,
           coalesce(cp1.plataforma, cp2.plataforma, cp3.plataforma) as plat_cp
      from ids i
      left join unico an1 on an1.nivel = 'anuncio' and an1.item_id = i.ad1
      left join unico an2 on an2.nivel = 'anuncio' and an2.item_id = i.ad2
      left join unico cj on cj.nivel = 'conjunto' and cj.item_id = i.conj
      left join unico cp1 on cp1.nivel = 'campanha' and cp1.item_id = i.camp1
      left join unico cp2 on cp2.nivel = 'campanha' and cp2.item_id = i.camp2
      left join unico cp3 on cp3.nivel = 'campanha' and cp3.item_id = i.camp3
  )
  select n.id, n.c_dia, n.f_dia, n.e_ganho, coalesce(n.valor, 0),
         coalesce(n.meta_ad_id, n.ad_id, n.meta_adset_id, n.meta_campaign_id) is not null as tem_id,
         coalesce(nullif(btrim(n.utm_source), ''), nullif(btrim(n.utm_campaign), ''), nullif(btrim(n.utm_medium), ''),
                  nullif(btrim(n.gclid), ''), nullif(btrim(n.fbclid), '')) is not null as tem_utm,
         case when c.anuncio is not null then c.plat_an when c.conjunto is not null then c.plat_cj when c.campanha is not null then c.plat_cp end,
         case when c.anuncio is not null then c.camp_an when c.conjunto is not null then c.camp_cj else c.campanha end,
         case when c.anuncio is not null then c.conj_an when c.conjunto is not null then c.conjunto end,
         c.anuncio,
         case when c.anuncio is not null then 'anuncio' when c.conjunto is not null then 'conjunto' when c.campanha is not null then 'campanha' end
    from neg n
    join casado c on c.id = n.id;
$$;

revoke execute on function public.kommo_anuncio_dos_negocios(date, date) from public, anon, authenticated;

comment on function public.kommo_anuncio_dos_negocios(date, date) is
  'Uso interno (cartão 48): cada negócio da Kommo criado ou ganho no período, ligado pelo NÚMERO ao anúncio, conjunto ou campanha de anuncios_itens. Nunca por nome nem palpite.';

-- ---------------------------------------------------------------------------
-- Os negócios ganhos cujo pedido da loja (fase 3) já está ligado a um anúncio
-- pela UTM. Esses contam em "Resultado (UTM)" e não na venda do WhatsApp.
-- Sem a 0165 no banco, a lista é vazia. Uso interno.
-- ---------------------------------------------------------------------------
create or replace function public.kommo_ganhos_ja_na_loja(p_de date, p_ate date)
returns setof bigint
language plpgsql
stable
set search_path = ''
as $$
begin
  if to_regclass('public.kommo_vendas') is null then
    return;
  end if;
  return query execute
    'select v.negocio_id
       from public.kommo_vendas v
      where v.estado = ''marcada'' and v.pedido is not null
        and exists (select 1 from public.origem_resolvida($1, $2) r
                     where r.pedido = v.pedido and r.campanha_id is not null)'
    using p_de - 60, p_ate;
end
$$;

revoke execute on function public.kommo_ganhos_ja_na_loja(date, date) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Conversas e vendas do WhatsApp por campanha, conjunto e anúncio, para a
-- tabela de Campanhas. Área `trafego`.
-- ---------------------------------------------------------------------------
create or replace function public.kommo_whats_por_anuncio(p_de date, p_ate date, p_plataforma text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v jsonb;
begin
  if not coalesce(public.tem_acesso('trafego'), false) then
    return null;
  end if;

  with base as materialized (
    select b.*, (b.ganho and b.fechado_dia between p_de and p_ate) as ganho_no_periodo,
           (b.criado_dia between p_de and p_ate) as conversa_no_periodo,
           (b.negocio_id in (select public.kommo_ganhos_ja_na_loja(p_de, p_ate))) as na_loja
      from public.kommo_anuncio_dos_negocios(p_de, p_ate) b
  ),
  niveis as (
    select b.*, n.nivel, n.id as item
      from base b
     cross join lateral (values ('campanha', b.campanha_id), ('conjunto', b.conjunto_id), ('anuncio', b.anuncio_id)) as n(nivel, id)
     where n.id is not null and b.plataforma = p_plataforma
  )
  select jsonb_build_object(
    'lido_em', (select ultima_leitura_em from public.kommo_estado where id = 1),
    'cobertura', (
      select jsonb_build_object(
        'conversas', count(*) filter (where conversa_no_periodo),
        'conversas_com_id', count(*) filter (where conversa_no_periodo and tem_id),
        'conversas_ligadas', count(*) filter (where conversa_no_periodo and plataforma = p_plataforma),
        'conversas_ligadas_ao_anuncio', count(*) filter (where conversa_no_periodo and plataforma = p_plataforma and anuncio_id is not null),
        'vendas', count(*) filter (where ganho_no_periodo),
        'vendas_ligadas', count(*) filter (where ganho_no_periodo and plataforma = p_plataforma and not na_loja),
        'valor_ligado', coalesce(sum(valor) filter (where ganho_no_periodo and plataforma = p_plataforma and not na_loja), 0),
        'vendas_na_loja', count(*) filter (where ganho_no_periodo and plataforma = p_plataforma and na_loja)
      ) from base
    ),
    'por_item', coalesce((
      select jsonb_agg(jsonb_build_object(
        'nivel', nivel, 'id', item,
        'conversas', conversas, 'vendas', vendas, 'valor', valor, 'vendas_na_loja', vendas_na_loja))
        from (
          select nivel, item,
                 count(*) filter (where conversa_no_periodo) as conversas,
                 count(*) filter (where ganho_no_periodo and not na_loja) as vendas,
                 coalesce(sum(valor) filter (where ganho_no_periodo and not na_loja), 0) as valor,
                 count(*) filter (where ganho_no_periodo and na_loja) as vendas_na_loja
            from niveis
           group by nivel, item
        ) x
       where conversas > 0 or vendas > 0 or vendas_na_loja > 0
    ), '[]'::jsonb)
  ) into v;
  return v;
end
$$;

revoke execute on function public.kommo_whats_por_anuncio(date, date, text) from public, anon;
grant execute on function public.kommo_whats_por_anuncio(date, date, text) to authenticated, service_role;

comment on function public.kommo_whats_por_anuncio(date, date, text) is
  'Conversas (negócios criados) e vendas ganhas da Kommo por campanha, conjunto e anúncio de uma plataforma. Venda cujo pedido já está ligado a anúncio pela UTM fica em vendas_na_loja e não soma. Área trafego.';

-- ---------------------------------------------------------------------------
-- Os negócios do período por origem, para a tela de Origem. Área `trafego`.
-- Sem nome do cliente, telefone nem texto: o negócio, o funil, a etapa, o
-- valor e de onde veio.
--   anuncio      ligado a campanha, conjunto ou anúncio pelo número
--   id_sem_casar chegou com id de anúncio que não está em anuncios_itens
--   utm          chegou com UTM, gclid ou fbclid, sem número que case
--   codigo       código do site na primeira mensagem (ainda não existe: ver docs/kommo.md)
--   sem_origem   nada disso
-- ---------------------------------------------------------------------------
create or replace function public.kommo_negocios_por_origem(p_de date, p_ate date, p_origem text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v jsonb;
begin
  if not coalesce(public.tem_acesso('trafego'), false) then
    return null;
  end if;

  with base as materialized (
    select b.*,
           case when b.ligado_por is not null then 'anuncio'
                when b.tem_id then 'id_sem_casar'
                when b.tem_utm then 'utm'
                else 'sem_origem' end as origem
      from public.kommo_anuncio_dos_negocios(p_de, p_ate) b
     where b.criado_dia between p_de and p_ate
  ),
  nomes as (
    select a.nivel, a.item_id, (array_agg(a.nome order by a.dia desc))[1] as nome
      from public.anuncios_itens a
     where a.item_id in (select unnest(array[campanha_id, conjunto_id, anuncio_id]) from base)
     group by a.nivel, a.item_id
  )
  select jsonb_build_object(
    'lido_em', (select ultima_leitura_em from public.kommo_estado where id = 1),
    'por_origem', coalesce((
      select jsonb_object_agg(origem, jsonb_build_object('negocios', n, 'ganhos', g, 'valor', vl))
        from (select origem, count(*) as n, count(*) filter (where ganho) as g,
                     coalesce(sum(valor) filter (where ganho), 0) as vl
                from base group by origem) o
    ), '{}'::jsonb),
    'lista', coalesce((
      select jsonb_agg(j order by criado desc)
        from (
          select n.criado_em as criado,
                 jsonb_build_object(
                   'id', b.negocio_id,
                   'criado_em', n.criado_em,
                   'funil', f.nome,
                   'etapa', e.nome,
                   'fase', x.fase,
                   'ganho', b.ganho,
                   'valor', b.valor,
                   'origem', b.origem,
                   'plataforma', b.plataforma,
                   'ligado_por', b.ligado_por,
                   'campanha_id', b.campanha_id,
                   'conjunto_id', b.conjunto_id,
                   'anuncio_id', b.anuncio_id,
                   'campanha', (select nm.nome from nomes nm where nm.nivel = 'campanha' and nm.item_id = b.campanha_id),
                   'conjunto', (select nm.nome from nomes nm where nm.nivel = 'conjunto' and nm.item_id = b.conjunto_id),
                   'anuncio', (select nm.nome from nomes nm where nm.nivel = 'anuncio' and nm.item_id = b.anuncio_id),
                   'id_meta', coalesce(n.meta_ad_id, n.ad_id, n.meta_adset_id, n.meta_campaign_id),
                   'utm_source', n.utm_source,
                   'utm_medium', n.utm_medium,
                   'utm_campaign', n.utm_campaign,
                   'link', 'https://kathleengfz.kommo.com/leads/detail/' || b.negocio_id) as j
            from base b
            join public.kommo_negocios n on n.id = b.negocio_id
            left join public.kommo_funis f on f.id = n.funil_id
            left join public.kommo_etapas e on e.funil_id = n.funil_id and e.id = n.etapa_id
            left join public.fases_da_kommo x on x.funil_id = n.funil_id and x.etapa_id = n.etapa_id
           where p_origem is null or b.origem = p_origem
           order by n.criado_em desc
           limit 200
        ) l
    ), '[]'::jsonb)
  ) into v;
  return v;
end
$$;

revoke execute on function public.kommo_negocios_por_origem(date, date, text) from public, anon;
grant execute on function public.kommo_negocios_por_origem(date, date, text) to authenticated, service_role;

comment on function public.kommo_negocios_por_origem(date, date, text) is
  'Negócios da Kommo criados no período, separados por origem (anuncio, id_sem_casar, utm, codigo, sem_origem), com a lista dos 200 mais novos. Sem dado de cliente. Área trafego.';
