-- Origem do pedido anotada pela própria loja, e a venda paga por anúncio.
--
-- POR QUE
--
-- A Tray guarda só a "UTM Source" do pedido, e só na exportação: a API não
-- traz origem nenhuma (0063), e campanha e anúncio ela nunca guardou. Nos
-- últimos trinta dias, 109 de 208 pedidos pagos tinham origem. Sem saber qual
-- anúncio trouxe a venda PAGA, a tela de campanhas julga pelo número da
-- plataforma, que conta pedido criado e venda de quem só viu o anúncio.
--
-- COMO
--
-- Um script na loja e no portal anota cada chegada (as UTMs, o identificador
-- do clique, o site de onde a pessoa veio) e manda ao portal, que marca o
-- visitante com um cookie próprio. São três tabelas:
--
--   origem_toques   cada chegada de um visitante;
--   origem_sessoes  a sessão da Tray de cada visitante (o `data-session` da
--                   loja, que é o mesmo `session_id` que o pedido carrega na
--                   API; conferido em 13/11/2026 na loja de testes);
--   origem_pedidos  o número do pedido visto na página de confirmação, que é
--                   o segundo caminho, para quando a sessão não bastar.
--
-- A atribuição NÃO é tabela, é conta (`origem_dos_pedidos`), como a fila de
-- recuperação: a regra pode mudar e o passado acompanha. Vale a última chegada
-- que não seja acesso direto, até trinta dias antes do pedido.
--
-- Os códigos de campanha, conjunto e anúncio não dependem de convenção de
-- etiqueta: `ids` guarda todo número comprido que veio nas UTMs, e a conta
-- procura cada um em `anuncios_itens`. Achou o anúncio, sobe sozinha para o
-- conjunto e a campanha dele.
--
-- Ninguém de fora lê nem grava nestas tabelas: quem grava é a rota do portal,
-- com a service_role. Não se guarda IP, navegador, nome, telefone nem e-mail.

create table public.origem_toques (
  id         bigint generated always as identity primary key,
  visitante  uuid not null,
  em         timestamptz not null default now(),
  canal      text not null check (char_length(canal) <= 30),
  source     text check (char_length(source) <= 120),
  medium     text check (char_length(medium) <= 120),
  campaign   text check (char_length(campaign) <= 200),
  content    text check (char_length(content) <= 200),
  term       text check (char_length(term) <= 200),
  ids        text[] not null default '{}' check (cardinality(ids) <= 8),
  clique     text check (char_length(clique) <= 20),
  clique_id  text check (char_length(clique_id) <= 400),
  referencia text check (char_length(referencia) <= 120),
  entrada    text check (char_length(entrada) <= 300),
  aparelho   text check (aparelho in ('celular', 'tablet', 'computador')),
  sessao     text check (char_length(sessao) <= 64)
);

comment on table public.origem_toques is
  'Cada chegada de um visitante à loja ou ao portal, anotada pelo coletor (/api/origem). Sem dado pessoal.';
comment on column public.origem_toques.ids is
  'Números compridos achados nas UTMs. A conta procura cada um em anuncios_itens para saber se é campanha, conjunto ou anúncio.';

create index origem_toques_visitante_idx on public.origem_toques (visitante, em desc);
create index origem_toques_em_idx on public.origem_toques (em);

create table public.origem_sessoes (
  sessao    text primary key check (char_length(sessao) between 20 and 64),
  visitante uuid not null,
  vista_em  timestamptz not null default now()
);

comment on table public.origem_sessoes is
  'A sessão da Tray (data-session da loja, session_id do pedido na API) de cada visitante.';

create index origem_sessoes_visitante_idx on public.origem_sessoes (visitante);

create table public.origem_pedidos (
  pedido    bigint primary key check (pedido > 0),
  visitante uuid not null,
  sessao    text check (char_length(sessao) <= 64),
  em        timestamptz not null default now()
);

comment on table public.origem_pedidos is
  'O número do pedido que a página de confirmação mostrou ao visitante. Só o primeiro registro de cada pedido vale.';

create index origem_pedidos_visitante_idx on public.origem_pedidos (visitante);

alter table public.origem_toques enable row level security;
alter table public.origem_sessoes enable row level security;
alter table public.origem_pedidos enable row level security;

create policy origem_toques_select on public.origem_toques
  for select to authenticated using ((select public.tem_acesso('trafego')));
create policy origem_sessoes_select on public.origem_sessoes
  for select to authenticated using ((select public.tem_acesso('trafego')));
create policy origem_pedidos_select on public.origem_pedidos
  for select to authenticated using ((select public.tem_acesso('trafego')));

revoke all on public.origem_toques, public.origem_sessoes, public.origem_pedidos from anon;

-- A sessão que o pedido carrega na API. A exportação não traz, então fica nula até a API ler o pedido.
alter table public.tray_pedidos add column sessao text check (char_length(sessao) <= 64);
create index tray_pedidos_sessao_idx on public.tray_pedidos (sessao) where sessao is not null;

-- A conta procura código de anúncio por `item_id`, e a chave da tabela começa pelo dia.
create index anuncios_itens_item_idx on public.anuncios_itens (item_id);

-- A mesma função da 0063, agora aceitando a sessão. Quem não sabe a sessão não apaga a de quem sabe.
create or replace function public.importar_pedidos_tray(p_pedidos jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_lidos   integer;
  v_novos   integer;
  v_mudaram integer;
begin
  with dados as (
    select *
    from jsonb_to_recordset(p_pedidos) as x(
      pedido bigint, feito_em timestamptz, dia date, status text, situacao text,
      cliente_codigo text, cliente_nome text, cliente_email text, cliente_telefone text,
      subtotal numeric, frete_tipo text, frete_valor numeric, desconto numeric, cupom text,
      total numeric, pagamento_tipo text, pagamento_em date, forma_paga text, valor_pago numeric,
      canal text, parceiro text, utm_source text, cidade text, uf text,
      envio_em date, envio_codigo text, itens jsonb, sessao text
    )
  ),
  antes as (
    select d.pedido, d.status as novo, t.status as antigo, (t.pedido is null) as inedito
    from dados d
    left join public.tray_pedidos t on t.pedido = d.pedido
  ),
  gravados as (
    insert into public.tray_pedidos as t (
      pedido, feito_em, dia, status, situacao,
      cliente_codigo, cliente_nome, cliente_email, cliente_telefone,
      subtotal, frete_tipo, frete_valor, desconto, cupom,
      total, pagamento_tipo, pagamento_em, forma_paga, valor_pago,
      canal, parceiro, utm_source, cidade, uf,
      envio_em, envio_codigo, itens, sessao
    )
    select
      pedido, feito_em, dia, status, situacao,
      cliente_codigo, cliente_nome, cliente_email, cliente_telefone,
      subtotal, frete_tipo, frete_valor, desconto, cupom,
      total, pagamento_tipo, pagamento_em, forma_paga, valor_pago,
      canal, parceiro, utm_source, cidade, uf,
      envio_em, envio_codigo, itens, sessao
    from dados
    on conflict (pedido) do update set
      feito_em         = excluded.feito_em,
      dia              = excluded.dia,
      status           = excluded.status,
      situacao         = excluded.situacao,
      cliente_codigo   = excluded.cliente_codigo,
      cliente_nome     = excluded.cliente_nome,
      cliente_email    = excluded.cliente_email,
      cliente_telefone = excluded.cliente_telefone,
      subtotal         = excluded.subtotal,
      frete_tipo       = excluded.frete_tipo,
      frete_valor      = excluded.frete_valor,
      desconto         = excluded.desconto,
      cupom            = excluded.cupom,
      total            = excluded.total,
      pagamento_tipo   = excluded.pagamento_tipo,
      pagamento_em     = excluded.pagamento_em,
      forma_paga       = excluded.forma_paga,
      valor_pago       = excluded.valor_pago,
      canal            = excluded.canal,
      parceiro         = excluded.parceiro,
      utm_source       = coalesce(excluded.utm_source, t.utm_source),
      cidade           = excluded.cidade,
      uf               = excluded.uf,
      envio_em         = excluded.envio_em,
      envio_codigo     = excluded.envio_codigo,
      itens            = coalesce(excluded.itens, t.itens),
      sessao           = coalesce(excluded.sessao, t.sessao),
      status_anterior  = case when t.status is distinct from excluded.status
                              then t.status else t.status_anterior end,
      status_mudou_em  = case when t.status is distinct from excluded.status
                              then now() else t.status_mudou_em end,
      atualizado_em    = now()
    returning 1
  )
  select
    count(*),
    count(*) filter (where inedito),
    count(*) filter (where not inedito and antigo is distinct from novo)
  into v_lidos, v_novos, v_mudaram
  from antes;

  return jsonb_build_object('lidos', v_lidos, 'novos', v_novos, 'mudaram', v_mudaram);
end;
$$;

revoke execute on function public.importar_pedidos_tray(jsonb) from public, anon, authenticated;
grant execute on function public.importar_pedidos_tray(jsonb) to service_role;

-- A origem de cada pedido do período, e a soma por canal e por item de anúncio.
-- Roda com os direitos de quem chama: sem as áreas de vendas e de tráfego, vem vazio.
create function public.origem_dos_pedidos(p_de date, p_ate date)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with ped as (
    select
      p.pedido, p.feito_em, p.situacao, p.total, p.sessao,
      -- A sessão vem antes: ninguém adivinha uma sessão, e número de pedido é sequencial.
      coalesce(os.visitante, op.visitante) as visitante
    from public.tray_pedidos p
    left join public.origem_sessoes os on os.sessao = p.sessao
    left join public.origem_pedidos op
      on op.pedido = p.pedido
     and op.em between p.feito_em - interval '15 minutes' and p.feito_em + interval '3 days'
    where p.dia between p_de and p_ate
  ),
  com_toque as (
    select ped.*, u.canal as canal_do_toque, u.ids, (pr.id is not null) as visto
    from ped
    left join lateral (
      select t.canal, t.ids
      from public.origem_toques t
      where t.visitante = ped.visitante
        and t.em between ped.feito_em - interval '30 days' and ped.feito_em + interval '15 minutes'
        and t.canal <> 'direto'
      order by t.em desc
      limit 1
    ) u on true
    left join lateral (
      select t.id
      from public.origem_toques t
      where t.visitante = ped.visitante
        and t.em between ped.feito_em - interval '30 days' and ped.feito_em + interval '15 minutes'
      limit 1
    ) pr on true
  ),
  resolvido as (
    select
      c.pedido, c.situacao, c.total, c.sessao, c.visitante,
      case
        when c.canal_do_toque is not null then c.canal_do_toque
        when c.visto then 'direto'
      end as canal,
      i.plataforma,
      case when i.nivel = 'campanha' then i.item_id else i.campanha_id end as campanha_id,
      case when i.nivel = 'conjunto' then i.item_id when i.nivel = 'anuncio' then i.conjunto_id end as conjunto_id,
      case when i.nivel = 'anuncio' then i.item_id end as anuncio_id
    from com_toque c
    left join lateral (
      select a.plataforma, a.nivel, a.item_id, a.campanha_id, a.conjunto_id
      from public.anuncios_itens a
      where cardinality(c.ids) > 0 and a.item_id = any (c.ids)
      order by case a.nivel when 'anuncio' then 1 when 'conjunto' then 2 else 3 end, a.dia desc
      limit 1
    ) i on true
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
        'valor_pago', coalesce(sum(total) filter (where situacao = 'pago'), 0),
        'valor_pago_com_origem', coalesce(sum(total) filter (where situacao = 'pago' and canal is not null), 0),
        'valor_pago_com_anuncio', coalesce(sum(total) filter (where situacao = 'pago' and campanha_id is not null), 0)
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

revoke execute on function public.origem_dos_pedidos(date, date) from public, anon;
grant execute on function public.origem_dos_pedidos(date, date) to authenticated, service_role;

-- Como o coletor está: quanto chegou, por canal, e quando foi a última chegada.
create function public.saude_do_coletor()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'ultima_chegada', (select max(em) from public.origem_toques),
    'ultima_sessao', (select max(vista_em) from public.origem_sessoes),
    'chegadas_24h', (select count(*) from public.origem_toques where em > now() - interval '24 hours'),
    'chegadas_7d', (select count(*) from public.origem_toques where em > now() - interval '7 days'),
    'visitantes_7d', (select count(distinct visitante) from public.origem_toques where em > now() - interval '7 days'),
    'com_codigo_de_anuncio_7d', (
      select count(*) from public.origem_toques t
      where t.em > now() - interval '7 days'
        and exists (select 1 from public.anuncios_itens a where a.item_id = any (t.ids))
    ),
    'sessoes_7d', (select count(*) from public.origem_sessoes where vista_em > now() - interval '7 days'),
    'pedidos_vistos_7d', (select count(*) from public.origem_pedidos where em > now() - interval '7 days'),
    'por_canal_7d', coalesce((
      select jsonb_agg(jsonb_build_object('canal', canal, 'chegadas', n) order by n desc)
      from (
        select canal, count(*) as n
        from public.origem_toques
        where em > now() - interval '7 days'
        group by canal
      ) c
    ), '[]'::jsonb)
  );
$$;

revoke execute on function public.saude_do_coletor() from public, anon;
grant execute on function public.saude_do_coletor() to authenticated, service_role;
