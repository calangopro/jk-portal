-- A UTM do pedido ligada à campanha, ao conjunto e ao anúncio certos.
--
-- POR QUE
--
-- Pedido do dono em 16/11/2026: "queria que as UTMs fossem automaticamente
-- vinculadas ao anúncio, conjunto e campanha certa. Como tem as UTMs, é só
-- elas baterem e você sabe EXATAMENTE qual anúncio vendeu."
--
-- A conta de origem (0064) só casava por NÚMERO: procurava em `anuncios_itens`
-- cada número comprido achado nas UTMs. Medido nesse dia: os anúncios do Meta
-- mandam o número só da CAMPANHA (`utm_id`), e o anúncio e o conjunto vêm pelo
-- NOME (`utm_content` é o nome do anúncio, `utm_term` o do conjunto). Então
-- todo pedido parava na campanha, e a tela de campanhas mostrava "na loja,
-- pago" em branco para todo conjunto e todo anúncio.
--
-- COMO CASA, do mais certo para o menos certo, e nunca no chute:
--
--   1. Pelo número, quando a UTM traz o número do anúncio ou do conjunto.
--   2. A campanha pelo número; sem número, pelo nome exato (`utm_campaign`).
--   3. O conjunto pelo NOME, só DENTRO da campanha já achada.
--   4. O anúncio pelo NOME, dentro da campanha e do conjunto já achados.
--   5. Campanha com um conjunto só, ou conjunto com um anúncio só: é ele.
--
-- Nome igual em dois lugares (o mesmo criativo em dois conjuntos, sem o
-- conjunto para desempatar) fica SEM anúncio. Medido em 7 dias de chegadas do
-- Meta: 75% ligam ao anúncio exato, e nenhuma ficou ambígua. O resto é uma
-- campanha cujas UTMs têm texto fixo em vez do nome do anúncio: ela liga à
-- campanha e ao conjunto (que é um só), e o anúncio depende de trocar a UTM.
--
-- "Nome igual" compara só letras e números (`so_letras`): a mesma UTM chega
-- com `+` no lugar de espaço em parte das visitas, e com ou sem acento. A
-- comparação é com TODO nome que o item já teve, porque a UTM leva o nome do
-- dia do clique e o anúncio pode ter sido renomeado depois.
--
-- O QUE MUDA
--
--   origem_resolvida      nova: uma linha por pedido do período, com a
--                         chegada, as UTMs e o anúncio casado. É a regra
--                         inteira, num lugar só.
--   origem_dos_pedidos    a mesma saída de antes, agora somando a partir da
--                         função acima. Conjunto e anúncio passam a encher.
--   pedidos_com_origem    nova: a lista pedido a pedido, para a tela de
--                         consulta em Tráfego.
--   origem_do_pedido      nova: a origem de UM pedido, com todas as chegadas
--                         do visitante, para a gaveta do pedido.
--
-- `canal_anotado_dos_pedidos` (0111) e `historico_do_pedido` (0103) repetem a
-- parte de achar o visitante e a chegada. Mudou a regra aqui, muda lá.

create or replace function public.so_letras(p text)
returns text
language sql
stable
set search_path = ''
as $$
  select lower(regexp_replace(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(p, '')), '[^a-zA-Z0-9]+', '', 'g'));
$$;

comment on function public.so_letras(text) is
  'Só letras e números, sem acento e em minúscula. É como dois nomes de anúncio são comparados.';

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
      order by t.em desc
      limit 1
    ) u on true
    left join lateral (
      select count(*)::int as n, max(t.em) as ultima
      from public.origem_toques t
      where t.visitante = ped.visitante
        and t.em between ped.feito_em - interval '30 days' and ped.feito_em + interval '15 minutes'
    ) v on true
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
  'Uma linha por pedido do período: a chegada anotada pelo coletor, as UTMs e a campanha, o conjunto e o anúncio casados. Roda com os direitos de quem chama.';

revoke execute on function public.origem_resolvida(date, date) from public, anon;
grant execute on function public.origem_resolvida(date, date) to authenticated, service_role;

-- A mesma saída da 0064, somando a partir de `origem_resolvida`. Ganha duas
-- chaves em `cobertura`: os pedidos pagos ligados ao anúncio exato.
create or replace function public.origem_dos_pedidos(p_de date, p_ate date)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with resolvido as materialized (
    select * from public.origem_resolvida(p_de, p_ate)
  )
  select jsonb_build_object(
    'cobertura', (
      select jsonb_build_object(
        'criados', count(*),
        'com_sessao', count(sessao),
        'ligados', count(visitante),
        'com_origem', count(canal),
        'pagos', count(*) filter (where situacao = 'pago'),
        'pagos_com_origem', count(canal) filter (where situacao = 'pago'),
        'pagos_com_anuncio', count(campanha_id) filter (where situacao = 'pago'),
        'pagos_com_anuncio_exato', count(anuncio_id) filter (where situacao = 'pago'),
        'valor_pago', coalesce(sum(total) filter (where situacao = 'pago'), 0),
        'valor_pago_com_origem', coalesce(sum(total) filter (where situacao = 'pago' and canal is not null), 0),
        'valor_pago_com_anuncio', coalesce(sum(total) filter (where situacao = 'pago' and campanha_id is not null), 0),
        'valor_pago_com_anuncio_exato', coalesce(sum(total) filter (where situacao = 'pago' and anuncio_id is not null), 0)
      )
      from resolvido
    ),
    'por_canal', coalesce((
      select jsonb_agg(linha order by (linha->>'valor')::numeric desc, (linha->>'criados')::int desc)
      from (
        select jsonb_build_object(
          'canal', canal,
          'criados', count(*),
          'pagos', count(*) filter (where situacao = 'pago'),
          'valor', coalesce(sum(total) filter (where situacao = 'pago'), 0)
        ) as linha
        from resolvido
        where canal is not null
        group by canal
      ) x
    ), '[]'::jsonb),
    'por_item', coalesce((
      select jsonb_agg(linha)
      from (
        select jsonb_build_object(
          'plataforma', r.plataforma,
          'nivel', n.nivel,
          'id', n.id,
          'criados', count(*),
          'pagos', count(*) filter (where r.situacao = 'pago'),
          'valor', coalesce(sum(r.total) filter (where r.situacao = 'pago'), 0)
        ) as linha
        from resolvido r
        cross join lateral (
          values ('campanha', r.campanha_id), ('conjunto', r.conjunto_id), ('anuncio', r.anuncio_id)
        ) as n(nivel, id)
        where n.id is not null
        group by r.plataforma, n.nivel, n.id
      ) y
    ), '[]'::jsonb)
  );
$$;

-- A lista pedido a pedido, do mais novo para o mais velho, para a tela de
-- consulta. Sem dado de cliente: só o pedido, a chegada e o anúncio.
create or replace function public.pedidos_com_origem(p_de date, p_ate date)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.feito_em desc), '[]'::jsonb)
  from (
    select
      r.pedido, r.feito_em, r.dia, r.situacao, r.status, r.total, r.etiqueta,
      (r.visitante is not null) as ligado,
      r.canal, r.source, r.medium, r.campaign, r.content, r.term, r.clique, r.entrada, r.aparelho, r.chegou_em, r.chegadas,
      r.plataforma, r.campanha_id, r.conjunto_id, r.anuncio_id,
      r.campanha_nome, r.conjunto_nome, r.anuncio_nome,
      r.campanha_por, r.conjunto_por, r.anuncio_por
    from public.origem_resolvida(p_de, p_ate) r
  ) x;
$$;

comment on function public.pedidos_com_origem(date, date) is
  'Cada pedido do período com a chegada, as UTMs e o anúncio casado. Roda com os direitos de quem chama: sem as áreas de vendas e de tráfego, vem vazio.';

revoke execute on function public.pedidos_com_origem(date, date) from public, anon;
grant execute on function public.pedidos_com_origem(date, date) to authenticated, service_role;

-- A origem de UM pedido, para a gaveta: o que casou e todas as chegadas do
-- visitante nos trinta dias antes. `security definer` porque quem abre a
-- gaveta (vendedor, suporte, fábrica) não tem a área de tráfego, e já vê o
-- canal e a campanha no histórico. Não devolve valor nem dado de cliente.
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
    ), '[]'::jsonb)
  ) end;
$$;

comment on function public.origem_do_pedido(bigint) is
  'A origem de um pedido para a gaveta: o anúncio casado e as chegadas do visitante. Só para quem já vê pedido em alguma tela.';

revoke execute on function public.origem_do_pedido(bigint) from public, anon;
grant execute on function public.origem_do_pedido(bigint) to authenticated, service_role;
