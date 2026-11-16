-- O clique em anúncio tem precedência, e as duas contas de origem viram uma.
--
-- POR QUE
--
-- Pedido do dono em 16/11/2026, olhando a tabela de campanhas: "queria que
-- marcasse aqui, porque aí sim marcaria CORRETO as vendas. Poderia ter
-- Resultado Meta | Resultado UTM". As colunas da loja estavam vazias em todas
-- as campanhas.
--
-- A conta (0112) dava o pedido à ÚLTIMA chegada que não fosse acesso direto.
-- Quem clicava no anúncio, saía, e voltava duas horas depois pela busca do
-- Google ou pelo link da bio, virava venda da busca ou da bio, e o anúncio
-- ficava com zero. Medido de 13 a 16/11: o pedido 11735 teve clique em anúncio
-- do Google duas horas antes da compra e uma chegada pela busca depois; a
-- conta dizia "busca do Google", e a etiqueta da própria Tray dizia "Google
-- Ads".
--
-- A REGRA NOVA
--
-- 1. Se o visitante clicou num ANÚNCIO nos sete dias antes do pedido, a venda
--    é do anúncio (o clique mais recente), mesmo com chegada orgânica depois.
--    Sete dias é a janela de clique padrão do Meta: é o que deixa "Resultado
--    Meta" e "Resultado UTM" lado a lado sem comparar janelas diferentes.
-- 2. Sem clique em anúncio nesses sete dias, vale o de antes: a última chegada
--    que não seja acesso direto, até trinta dias antes do pedido.
--
-- É anúncio a chegada com mídia paga na UTM, com clique do Google Ads (gclid)
-- ou cujo número bate com um item lido das plataformas. `fbclid` não conta: o
-- link da bio do Instagram também traz. É a regra de `ehAnuncio`, em
-- `src/lib/origem/pedidos.ts`.
--
-- Cada pedido continua indo para UM anúncio só. É o que tira a duplicidade: o
-- Meta e o Google contam a mesma venda cada um para si; aqui ela entra uma vez.
--
-- UMA CONTA SÓ
--
-- `canal_anotado_dos_pedidos` (0111), que alimenta Vendas, a Visão geral,
-- Tráfego e Gargalos, repetia a parte de achar a chegada. Com a regra mudando,
-- as duas iam discordar. Ela passa a ler de `origem_resolvida`, e a regra mora
-- num lugar só. `historico_do_pedido` (0103) ainda tem a própria cópia para a
-- linha do tempo da gaveta; o bloco "De qual anúncio veio" já lê daqui.

create or replace function public.origem_resolvida(p_de date, p_ate date)
returns table (
  pedido bigint, feito_em timestamptz, dia date, situacao text, status text, total numeric,
  sessao text, visitante uuid, etiqueta text,
  canal text, source text, medium text, campaign text, content text, term text,
  clique text, entrada text, aparelho text, chegou_em timestamptz, chegadas integer,
  plataforma text, campanha_id text, conjunto_id text, anuncio_id text,
  campanha_nome text, conjunto_nome text, anuncio_nome text,
  campanha_por text, conjunto_por text, anuncio_por text
)
language sql
stable
set search_path = ''
as $$
  with ped as (
    select
      p.pedido, p.feito_em, p.dia, p.situacao, p.status, p.total, p.sessao,
      nullif(btrim(p.utm_source), '') as etiqueta,
      -- A sessão vem antes: ninguém adivinha uma sessão, e número de pedido é sequencial.
      coalesce(
        (select os.visitante from public.origem_sessoes os where os.sessao = p.sessao),
        (select op.visitante from public.origem_pedidos op
          where op.pedido = p.pedido
            and op.em between p.feito_em - interval '15 minutes' and p.feito_em + interval '3 days')
      ) as visitante
    from public.tray_pedidos p
    where p.dia between p_de and p_ate
  ),
  -- Cada nome que cada item já teve. Primeiro junta (poucas centenas de linhas), depois normaliza.
  catalogo as materialized (
    select d.plataforma, d.nivel, d.item_id, d.campanha_id, d.conjunto_id, d.nome, d.visto_em, public.so_letras(d.nome) as chave
    from (
      select a.plataforma, a.nivel, a.item_id, a.campanha_id, a.conjunto_id, a.nome, max(a.dia) as visto_em
      from public.anuncios_itens a
      group by a.plataforma, a.nivel, a.item_id, a.campanha_id, a.conjunto_id, a.nome
    ) d
  ),
  nomes as materialized (
    select distinct on (k.nivel, k.item_id) k.nivel, k.item_id, k.nome
    from catalogo k
    order by k.nivel, k.item_id, k.visto_em desc
  ),
  com_toque as (
    select
      ped.*,
      u.canal as canal_do_toque, u.ids, u.source, u.medium, u.campaign, u.content, u.term, u.clique, u.entrada, u.aparelho,
      coalesce(u.em, v.ultima) as chegou_em,
      coalesce(v.n, 0) as chegadas
    from ped
    left join lateral (
      select t.canal, t.ids, t.source, t.medium, t.campaign, t.content, t.term, t.clique, t.entrada, t.aparelho, t.em
      from public.origem_toques t
      where t.visitante = ped.visitante
        and t.em between ped.feito_em - interval '30 days' and ped.feito_em + interval '15 minutes'
        and t.canal <> 'direto'
      order by
        -- O clique em ANÚNCIO dos últimos sete dias vem na frente de qualquer chegada orgânica posterior.
        -- É a mesma regra de `ehAnuncio`, em `src/lib/origem/pedidos.ts`: mudou uma, muda a outra.
        (t.em >= ped.feito_em - interval '7 days' and (
          lower(btrim(coalesce(t.medium, ''))) ~ '^(paid|paga?|cpc|cpm|cpv|ppc|ads?|anuncios?|display|pmax|shopping)([_-].*)?$'
          or lower(coalesce(t.clique, '')) in ('gclid', 'gbraid', 'wbraid')
          or (cardinality(t.ids) > 0 and exists (select 1 from catalogo k where k.item_id = any (t.ids)))
        )) desc,
        t.em desc
      limit 1
    ) u on true
    left join lateral (
      select count(*)::int as n, max(t.em) as ultima
      from public.origem_toques t
      where t.visitante = ped.visitante
        and t.em between ped.feito_em - interval '30 days' and ped.feito_em + interval '15 minutes'
    ) v on true
  ),
  casado as (
    select
      c.*,
      coalesce(pn.plataforma, cn.plataforma) as plataforma,
      camp.id as campanha_id,
      conj.id as conjunto_id,
      anun.id as anuncio_id,
      case when pn.item_id is not null then 'numero' when cn.item_id is not null then 'nome' end as campanha_por,
      case
        when conj.id is null then null
        when pn.nivel in ('conjunto', 'anuncio') then 'numero'
        when sn.n = 1 then 'nome'
        when su.n = 1 then 'unico'
        else 'anuncio'
      end as conjunto_por,
      case
        when anun.id is null then null
        when pn.nivel = 'anuncio' then 'numero'
        when an.n = 1 then 'nome'
        else 'unico'
      end as anuncio_por
    from com_toque c
    -- 1. Pelo número: o item mais específico que algum número da UTM aponta.
    left join lateral (
      select k.plataforma, k.nivel, k.item_id, k.campanha_id, k.conjunto_id
      from catalogo k
      where cardinality(c.ids) > 0 and k.item_id = any (c.ids)
      order by case k.nivel when 'anuncio' then 1 when 'conjunto' then 2 else 3 end, k.visto_em desc
      limit 1
    ) pn on true
    -- 2. A campanha pelo nome, só quando nenhum número apontou nada.
    left join lateral (
      select k.plataforma, k.item_id
      from catalogo k
      where pn.item_id is null and c.campaign is not null and k.nivel = 'campanha' and k.chave <> ''
        and k.chave = public.so_letras(c.campaign)
        and k.plataforma = case c.canal_do_toque when 'meta' then 'meta' when 'google_ads' then 'google' else k.plataforma end
      order by k.visto_em desc
      limit 1
    ) cn on true
    cross join lateral (
      select coalesce(case pn.nivel when 'campanha' then pn.item_id else pn.campanha_id end, cn.item_id) as id
    ) camp
    -- 3. O conjunto pelo nome, dentro da campanha.
    left join lateral (
      select min(k.item_id) as item_id, count(distinct k.item_id) as n
      from catalogo k
      where camp.id is not null and c.term is not null and k.nivel = 'conjunto' and k.campanha_id = camp.id and k.chave <> ''
        and (k.chave = public.so_letras(c.term)
             or (char_length(c.term) >= 190 and k.chave like public.so_letras(c.term) || '%'))
    ) sn on true
    -- 5a. Campanha com um conjunto só.
    left join lateral (
      select min(k.item_id) as item_id, count(distinct k.item_id) as n
      from catalogo k
      where camp.id is not null and k.nivel = 'conjunto' and k.campanha_id = camp.id
    ) su on true
    cross join lateral (
      select coalesce(
        case pn.nivel when 'conjunto' then pn.item_id when 'anuncio' then pn.conjunto_id end,
        case when sn.n = 1 then sn.item_id end,
        case when su.n = 1 then su.item_id end
      ) as id
    ) conj0
    -- 4. O anúncio pelo nome, dentro da campanha e, se já se sabe, do conjunto.
    left join lateral (
      select min(k.item_id) as item_id, min(k.conjunto_id) as conjunto_id, count(distinct k.item_id) as n
      from catalogo k
      where camp.id is not null and c.content is not null and k.nivel = 'anuncio' and k.campanha_id = camp.id and k.chave <> ''
        and (conj0.id is null or k.conjunto_id = conj0.id)
        and (k.chave = public.so_letras(c.content)
             or (char_length(c.content) >= 190 and k.chave like public.so_letras(c.content) || '%'))
    ) an on true
    -- 5b. Conjunto com um anúncio só.
    left join lateral (
      select min(k.item_id) as item_id, count(distinct k.item_id) as n
      from catalogo k
      where conj0.id is not null and k.nivel = 'anuncio' and k.conjunto_id = conj0.id
    ) au on true
    cross join lateral (
      select coalesce(
        case when pn.nivel = 'anuncio' then pn.item_id end,
        case when an.n = 1 then an.item_id end,
        case when au.n = 1 then au.item_id end
      ) as id
    ) anun
    cross join lateral (
      select coalesce(conj0.id, case when an.n = 1 then an.conjunto_id end) as id
    ) conj
  )
  select
    m.pedido, m.feito_em, m.dia, m.situacao, m.status, m.total,
    m.sessao, m.visitante, m.etiqueta,
    case when m.canal_do_toque is not null then m.canal_do_toque when m.chegadas > 0 then 'direto' end as canal,
    m.source, m.medium, m.campaign, m.content, m.term,
    m.clique, m.entrada, m.aparelho, m.chegou_em, m.chegadas,
    m.plataforma, m.campanha_id, m.conjunto_id, m.anuncio_id,
    (select n.nome from nomes n where n.nivel = 'campanha' and n.item_id = m.campanha_id) as campanha_nome,
    (select n.nome from nomes n where n.nivel = 'conjunto' and n.item_id = m.conjunto_id) as conjunto_nome,
    (select n.nome from nomes n where n.nivel = 'anuncio' and n.item_id = m.anuncio_id) as anuncio_nome,
    m.campanha_por, m.conjunto_por, m.anuncio_por
  from casado m;
$$;


comment on function public.origem_resolvida(date, date) is
  'Uma linha por pedido do período: a chegada que vale (clique em anúncio dos últimos sete dias, senão a última que não seja direta em trinta), as UTMs e a campanha, o conjunto e o anúncio casados. Roda com os direitos de quem chama.';

-- O canal de cada pedido para as contas de vendas, lido da mesma regra.
-- Continua `security definer` com a área conferida por dentro: as tabelas do
-- coletor só abrem para tráfego, e a conta serve a quem tem vendas.
create or replace function public.canal_anotado_dos_pedidos(p_de date, p_ate date)
returns table (pedido bigint, canal text)
language sql
stable
security definer
set search_path = ''
as $$
  select r.pedido, r.canal
  from public.origem_resolvida(p_de, p_ate) r
  where r.visitante is not null
    and (coalesce((select public.tem_acesso('vendas')), false)
      or coalesce((select public.tem_acesso('trafego')), false)
      or coalesce((select auth.role()) = 'service_role', false));
$$;
