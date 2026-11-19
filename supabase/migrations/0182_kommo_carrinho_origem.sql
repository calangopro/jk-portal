-- 0182: a origem do carrinho abandonado pela sessão da Tray (cartão 53).
--
-- O n8n cria um negócio no funil ECOMM | RECUPERAÇÃO da Kommo a cada carrinho
-- largado na loja, com o campo "Link do carrinho" (id 3177638) no formato
-- `https://www.jkaliancas.com.br/checkout/cart?session_id=<sessão>&store_id=1305187`.
-- Essa sessão é a MESMA que o coletor anota em `origem_sessoes` (0064) e que o
-- pedido carrega em `tray_pedidos.sessao`. Com ela:
--
--   1. o carrinho liga ao VISITANTE (`origem_sessoes`), e daí à origem pela
--      MESMA regra dos pedidos: clique em anúncio nos sete dias antes leva;
--      senão, a última chegada que não seja direta, em trinta dias. O momento
--      que vale é a criação do negócio;
--   2. o pedido da mesma sessão feito depois do carrinho (de uma hora antes,
--      folga para o atraso do n8n, até trinta dias depois) é o pedido em que o
--      carrinho virou. Em 18/11 nenhum pedido caía entre duas horas antes e o
--      carrinho: os que vêm antes são compras anteriores na mesma sessão (a
--      sessão da Tray dura semanas) e não contam.
--
-- UMA REGRA SÓ. A parte de `origem_resolvida` (0113) que acha a chegada e casa
-- a campanha, o conjunto e o anúncio saiu, sem mudar uma linha, para
-- `origem_das_chegadas`, que recebe (referência, visitante, momento). Os
-- pedidos e os carrinhos chamam a mesma função. A saída de `origem_resolvida`
-- não muda: conferido no banco, antes de aplicar, comparando as linhas de
-- 01/05 a 18/11 com as da versão antiga (nenhuma diferença).
--
-- A sessão sai do link por `kommo_sessao_do_link`, com o MESMO padrão de
-- `sessaoDoLinkDoCarrinho` (`src/lib/kommo/carrinho.ts`): o teste confere que
-- o texto é igual nos dois. Só o domínio da JK; link sem `session_id`, de
-- outra loja (`store_id` diferente) ou com sessão de formato estranho não vira
-- palpite.
--
-- Nada aqui escreve na Kommo nem nas tabelas `kommo_*`. A tela lê por
-- `kommo_carrinhos_por_origem`, `security definer` com a área `trafego`; a
-- parte de pedido (número, pago, valor) só sai com a área `vendas`. Sem nome
-- nem telefone do cliente. A gaveta do pedido ganha os carrinhos da mesma
-- sessão em `origem_do_pedido`, que já só responde a quem vê pedido.

-- ---------------------------------------------------------------------------
-- A regra da chegada, para qualquer lista de (referência, visitante, momento).
-- Roda com os direitos de quem chama, como `origem_resolvida`.
-- ---------------------------------------------------------------------------
create or replace function public.origem_das_chegadas(p_ref bigint[], p_visitante uuid[], p_em timestamptz[])
returns table (
  ref bigint,
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
    select m.ref, m.visitante, m.em as feito_em
    from unnest(p_ref, p_visitante, p_em) as m(ref, visitante, em)
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
    m.ref,
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

comment on function public.origem_das_chegadas(bigint[], uuid[], timestamptz[]) is
  'A regra da chegada de origem_resolvida (0113) para qualquer lista de (referência, visitante, momento): clique em anúncio nos sete dias antes leva; senão a última chegada não direta em trinta dias; e a campanha, o conjunto e o anúncio casados. Serve aos pedidos e aos carrinhos da Kommo (0182).';

revoke execute on function public.origem_das_chegadas(bigint[], uuid[], timestamptz[]) from public, anon;
grant execute on function public.origem_das_chegadas(bigint[], uuid[], timestamptz[]) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- `origem_resolvida`, com a mesma saída, lendo a regra de cima.
-- ---------------------------------------------------------------------------
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
  with ped as materialized (
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
  lista as (
    select array_agg(pedido) as refs, array_agg(visitante) as visitantes, array_agg(feito_em) as momentos from ped
  )
  select
    p.pedido, p.feito_em, p.dia, p.situacao, p.status, p.total,
    p.sessao, p.visitante, p.etiqueta,
    o.canal, o.source, o.medium, o.campaign, o.content, o.term,
    o.clique, o.entrada, o.aparelho, o.chegou_em, coalesce(o.chegadas, 0),
    o.plataforma, o.campanha_id, o.conjunto_id, o.anuncio_id,
    o.campanha_nome, o.conjunto_nome, o.anuncio_nome,
    o.campanha_por, o.conjunto_por, o.anuncio_por
  from ped p
  left join (
    select c.* from lista l cross join lateral public.origem_das_chegadas(l.refs, l.visitantes, l.momentos) c
  ) o on o.ref = p.pedido;
$$;

comment on function public.origem_resolvida(date, date) is
  'Uma linha por pedido do período: a chegada que vale (clique em anúncio dos últimos sete dias, senão a última que não seja direta em trinta), as UTMs e a campanha, o conjunto e o anúncio casados. A regra mora em origem_das_chegadas (0182). Roda com os direitos de quem chama.';

-- ---------------------------------------------------------------------------
-- A sessão da Tray no "Link do carrinho". O MESMO padrão de
-- `sessaoDoLinkDoCarrinho` (src/lib/kommo/carrinho.ts).
-- ---------------------------------------------------------------------------
create or replace function public.kommo_sessao_do_link(p_link text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when (regexp_match(btrim(coalesce(p_link, '')), '[?&]store_id=([^&#]*)', 'i'))[1] is not null
     and (regexp_match(btrim(coalesce(p_link, '')), '[?&]store_id=([^&#]*)', 'i'))[1] <> '1305187' then null
    else (regexp_match(btrim(coalesce(p_link, '')), '^https?://(www\.)?jkaliancas\.com\.br(/[^?#\s]*)?\?([^#\s]*&)?session_id=([A-Za-z0-9_-]{16,128})(&[^#\s]*)?(#.*)?$', 'i'))[4]
  end;
$$;

comment on function public.kommo_sessao_do_link(text) is
  'A sessão da Tray tirada do campo Link do carrinho da Kommo, ou null. Só o domínio da JK e a loja 1305187. O mesmo padrão de sessaoDoLinkDoCarrinho (cartão 53).';

-- ---------------------------------------------------------------------------
-- Cada negócio da Kommo com "Link do carrinho", criado no período: a sessão,
-- o visitante, a origem pela regra dos pedidos e o pedido em que virou.
-- Uso interno: só as funções desta migration chamam.
-- ---------------------------------------------------------------------------
create or replace function public.kommo_carrinhos(p_de date, p_ate date)
returns table (
  negocio_id bigint, criado_em timestamptz, funil_id bigint, etapa_id bigint,
  sessao text, visitante uuid,
  canal text, plataforma text, campanha_id text, conjunto_id text, anuncio_id text,
  campanha_nome text, conjunto_nome text, anuncio_nome text,
  pedido bigint, pedido_em timestamptz, pago boolean, total numeric
)
language sql
stable
set search_path = ''
as $$
  with neg as materialized (
    select n.id, n.criado_em, n.funil_id, n.etapa_id,
           public.kommo_sessao_do_link((
             select e->>'valor' from jsonb_array_elements(n.campos) e
              where e->>'id' = '3177638' limit 1)) as sessao
      from public.kommo_negocios n
     where not n.apagado
       and (n.criado_em at time zone 'America/Sao_Paulo')::date between p_de and p_ate
       and n.campos @> '[{"id": 3177638}]'::jsonb
  ),
  com_visitante as materialized (
    select g.*, (select os.visitante from public.origem_sessoes os where os.sessao = g.sessao) as visitante
      from neg g
  ),
  lista as (
    select array_agg(id) as refs, array_agg(visitante) as visitantes, array_agg(criado_em) as momentos from com_visitante
  ),
  origem as (
    select c.* from lista l cross join lateral public.origem_das_chegadas(l.refs, l.visitantes, l.momentos) c
  )
  select g.id, g.criado_em, g.funil_id, g.etapa_id, g.sessao, g.visitante,
         o.canal, o.plataforma, o.campanha_id, o.conjunto_id, o.anuncio_id,
         o.campanha_nome, o.conjunto_nome, o.anuncio_nome,
         pd.pedido, pd.feito_em, pd.pago, pd.total
    from com_visitante g
    left join origem o on o.ref = g.id
    left join lateral (
      -- O pedido da mesma sessão feito do carrinho em diante (uma hora de folga
      -- para o atraso do n8n), até trinta dias depois. O pago vem na frente.
      select p.pedido, p.feito_em, p.situacao = 'pago' as pago, p.total
        from public.tray_pedidos p
       where g.sessao is not null and p.sessao = g.sessao
         and p.feito_em >= g.criado_em - interval '1 hour'
         and p.feito_em < g.criado_em + interval '30 days'
       order by (p.situacao = 'pago') desc, p.feito_em
       limit 1
    ) pd on true;
$$;

revoke execute on function public.kommo_carrinhos(date, date) from public, anon, authenticated;

comment on function public.kommo_carrinhos(date, date) is
  'Uso interno (cartão 53): cada negócio da Kommo com Link do carrinho criado no período, com a sessão da Tray, o visitante, a origem pela regra dos pedidos e o pedido da mesma sessão feito depois.';

-- ---------------------------------------------------------------------------
-- O recorte "Carrinho abandonado" da tela de Origem. Área `trafego`; a parte
-- de pedido só com a área `vendas`. Sem nome nem telefone do cliente.
-- ---------------------------------------------------------------------------
create or replace function public.kommo_carrinhos_por_origem(p_de date, p_ate date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v jsonb;
  v_vendas boolean := coalesce(public.tem_acesso('vendas'), false);
begin
  if not coalesce(public.tem_acesso('trafego'), false) then
    return null;
  end if;

  with b as materialized (
    select c.*,
           case when c.sessao is null then 'sem_sessao'
                when c.visitante is null then 'sem_visitante'
                when c.canal is null then 'sem_chegada'
                else c.canal end as grupo,
           extract(epoch from (c.pedido_em - c.criado_em)) / 3600.0 as horas
      from public.kommo_carrinhos(p_de, p_ate) c
  )
  select jsonb_build_object(
    'lido_em', (select ultima_leitura_em from public.kommo_estado where id = 1),
    'total', (select count(*) from b),
    'com_sessao', (select count(*) from b where sessao is not null),
    'ligados', (select count(*) from b where visitante is not null),
    'com_origem', (select count(*) from b where canal is not null and canal <> 'direto'),
    'com_anuncio', (select count(*) from b where plataforma is not null),
    'por_canal', coalesce((
      select jsonb_agg(jsonb_build_object(
        'canal', grupo, 'carrinhos', n, 'anuncio', an,
        'pedidos', case when v_vendas then pd end,
        'pagos', case when v_vendas then pg end))
        from (select grupo, count(*) as n, count(*) filter (where plataforma is not null) as an,
                     count(*) filter (where pedido is not null) as pd,
                     count(*) filter (where pago) as pg
                from b group by grupo) x
    ), '[]'::jsonb),
    'pedidos', case when v_vendas then (
      select jsonb_build_object(
        'viraram', count(*) filter (where pedido is not null),
        'pagos', count(*) filter (where pago),
        'valor_pago', coalesce((select sum(t.total) from (select distinct b2.pedido, b2.total from b b2 where b2.pago) t), 0),
        'horas_mediana', percentile_cont(0.5) within group (order by horas) filter (where pago))
      from b
    ) end,
    'lista', coalesce((
      select jsonb_agg(j order by criado desc)
        from (
          select b.criado_em as criado,
                 jsonb_build_object(
                   'id', b.negocio_id,
                   'criado_em', b.criado_em,
                   'etapa', concat_ws(' › ', f.nome, e.nome),
                   'tem_sessao', b.sessao is not null,
                   'ligado', b.visitante is not null,
                   'canal', b.canal,
                   'plataforma', b.plataforma,
                   'campanha', b.campanha_nome,
                   'conjunto', b.conjunto_nome,
                   'anuncio', b.anuncio_nome,
                   'pedido', case when v_vendas then b.pedido end,
                   'pago', case when v_vendas then b.pago end,
                   'horas', case when v_vendas then round(b.horas::numeric, 2) end) as j
            from b
            left join public.kommo_funis f on f.id = b.funil_id
            left join public.kommo_etapas e on e.funil_id = b.funil_id and e.id = b.etapa_id
           order by b.criado_em desc
           limit 200
        ) l
    ), '[]'::jsonb)
  ) into v;
  return v;
end
$$;

revoke execute on function public.kommo_carrinhos_por_origem(date, date) from public, anon;
grant execute on function public.kommo_carrinhos_por_origem(date, date) to authenticated, service_role;

comment on function public.kommo_carrinhos_por_origem(date, date) is
  'Carrinhos abandonados da Kommo (negócios com Link do carrinho) criados no período: quantos ligam ao visitante pela sessão da Tray, de onde vieram e, com a área vendas, quantos viraram pedido e pedido pago e em quanto tempo. Sem dado de cliente. Área trafego.';

-- ---------------------------------------------------------------------------
-- A gaveta do pedido: os carrinhos abandonados da mesma sessão, do mais novo
-- para o mais velho, nos trinta dias antes do pedido. O resto é o da 0112.
-- ---------------------------------------------------------------------------
create or replace function public.origem_do_pedido(p_numero bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with pode as (
    select coalesce((select public.tem_acesso('vendas')), false)
        or coalesce((select public.tem_acesso('trafego')), false)
        or coalesce((select public.tem_acesso('lancar_venda')), false)
        or coalesce((select public.tem_acesso('recuperacao')), false)
        or coalesce((select public.tem_acesso('suporte')), false)
        or coalesce((select public.tem_acesso('fabrica')), false) as sim
  ),
  p as (
    select t.pedido, t.dia
    from public.tray_pedidos t, pode
    where pode.sim and t.pedido = p_numero
  ),
  r as (
    select o.*
    from p
    cross join lateral public.origem_resolvida(p.dia, p.dia) o
    where o.pedido = p.pedido
  )
  select case when not exists (select 1 from r) then null else jsonb_build_object(
    'origem', (
      select jsonb_build_object(
        'etiqueta', r.etiqueta, 'ligado', r.visitante is not null,
        'canal', r.canal, 'source', r.source, 'medium', r.medium, 'campaign', r.campaign, 'content', r.content, 'term', r.term,
        'clique', r.clique, 'entrada', r.entrada, 'aparelho', r.aparelho, 'chegou_em', r.chegou_em, 'chegadas', r.chegadas,
        'plataforma', r.plataforma, 'campanha_id', r.campanha_id, 'conjunto_id', r.conjunto_id, 'anuncio_id', r.anuncio_id,
        'campanha_nome', r.campanha_nome, 'conjunto_nome', r.conjunto_nome, 'anuncio_nome', r.anuncio_nome,
        'campanha_por', r.campanha_por, 'conjunto_por', r.conjunto_por, 'anuncio_por', r.anuncio_por
      )
      from r
    ),
    'chegadas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'em', t.em, 'canal', t.canal, 'source', t.source, 'medium', t.medium, 'campaign', t.campaign, 'content', t.content, 'term', t.term,
        'clique', t.clique, 'entrada', t.entrada, 'aparelho', t.aparelho
      ) order by t.em desc)
      from (
        select t.*
        from public.origem_toques t, r
        where t.visitante = r.visitante
          and t.em between r.feito_em - interval '30 days' and r.feito_em + interval '15 minutes'
        order by t.em desc
        limit 40
      ) t
    ), '[]'::jsonb),
    -- A mesma janela de `kommo_carrinhos`, vista do lado do pedido.
    'carrinhos', coalesce((
      select jsonb_agg(jsonb_build_object('id', n.id, 'criado_em', n.criado_em) order by n.criado_em desc)
      from r
      join public.kommo_negocios n
        on r.sessao is not null
       and not n.apagado
       and n.campos @> '[{"id": 3177638}]'::jsonb
       and n.criado_em > r.feito_em - interval '30 days'
       and n.criado_em <= r.feito_em + interval '1 hour'
       and public.kommo_sessao_do_link((
             select e->>'valor' from jsonb_array_elements(n.campos) e
              where e->>'id' = '3177638' limit 1)) = r.sessao
    ), '[]'::jsonb)
  ) end;
$$;

comment on function public.origem_do_pedido(bigint) is
  'A origem de um pedido para a gaveta: o anúncio casado, as chegadas do visitante e os carrinhos abandonados da Kommo da mesma sessão (0182). Só para quem já vê pedido em alguma tela.';

revoke execute on function public.origem_do_pedido(bigint) from public, anon;
grant execute on function public.origem_do_pedido(bigint) to authenticated, service_role;
