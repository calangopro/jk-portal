-- A origem que a loja anota entra nas contas de vendas, quando a etiqueta da Tray falta.
--
-- POR QUE
--
-- Vendas, Visão geral, Tráfego e Gargalos somam a venda por origem olhando
-- `tray_pedidos.utm_source`, a etiqueta que a Tray guarda e que SÓ a exportação
-- do painel da loja traz. A exportação roda no Mac do Filipe, pelo Chrome, e
-- para (ficou parada de 15 a 16/11/2026). Desde 16/11 o pedido entra pela API,
-- que não tem origem: sem a exportação, todo pedido novo caía em "Sem etiqueta".
--
-- A origem já é anotada sozinha desde 13/11/2026: o coletor (0064) guarda cada
-- chegada à loja, e o pedido se liga à chegada pela sessão da Tray, que a API
-- traz em todo pedido. Faltava as contas olharem para lá.
--
-- COMO
--
-- `canal_anotado_dos_pedidos` devolve, para cada pedido do período, o canal da
-- última chegada que não seja acesso direto, até trinta dias antes do pedido
-- (ou `direto`, quando todas as chegadas foram diretas). É a MESMA regra de
-- `origem_dos_pedidos` (0064): a sessão primeiro, depois o número visto na
-- página de confirmação. Mudou uma, muda a outra.
--
-- As duas contas passam a usar `coalesce(etiqueta da Tray, '@' || canal)`. A
-- etiqueta da Tray continua mandando quando existe, então pedido antigo não
-- muda de lugar. A marca `@` avisa o código de que aquilo já é um canal, e não
-- uma etiqueta crua para classificar (`canalDaOrigem`, em `vendas/origem.ts`).
--
-- A função é `security definer` porque as tabelas do coletor só abrem para a
-- área de tráfego, e a conta de vendas também serve a quem só tem a área de
-- vendas. Ela devolve um canal por pedido e mais nada, e confere a área por
-- dentro: sem vendas nem tráfego, volta vazia. As subconsultas são escalares de
-- propósito: junção que devolvesse duas linhas para um pedido dobraria o
-- faturamento na conta que usa esta função.

create or replace function public.canal_anotado_dos_pedidos(p_de date, p_ate date)
returns table (pedido bigint, canal text)
language sql
stable
security definer
set search_path = ''
as $$
  with pode as (
    select coalesce((select public.tem_acesso('vendas')), false)
        or coalesce((select public.tem_acesso('trafego')), false)
        or coalesce((select auth.role()) = 'service_role', false) as sim
  ),
  ped as (
    select
      p.pedido, p.feito_em,
      coalesce(
        (select os.visitante from public.origem_sessoes os where os.sessao = p.sessao),
        (select op.visitante from public.origem_pedidos op
          where op.pedido = p.pedido
            and op.em between p.feito_em - interval '15 minutes' and p.feito_em + interval '3 days')
      ) as visitante
    from public.tray_pedidos p, pode
    where pode.sim and p.dia between p_de and p_ate
  )
  select
    ped.pedido,
    coalesce(
      (select t.canal from public.origem_toques t
        where t.visitante = ped.visitante
          and t.em between ped.feito_em - interval '30 days' and ped.feito_em + interval '15 minutes'
          and t.canal <> 'direto'
        order by t.em desc
        limit 1),
      (select 'direto' from public.origem_toques t
        where t.visitante = ped.visitante
          and t.em between ped.feito_em - interval '30 days' and ped.feito_em + interval '15 minutes'
        limit 1)
    ) as canal
  from ped
  where ped.visitante is not null;
$$;

comment on function public.canal_anotado_dos_pedidos(date, date) is
  'O canal da chegada anotada pelo coletor para cada pedido do período (a mesma regra de origem_dos_pedidos). Só para as áreas de vendas e de tráfego.';

revoke execute on function public.canal_anotado_dos_pedidos(date, date) from public, anon;
grant execute on function public.canal_anotado_dos_pedidos(date, date) to authenticated, service_role;

-- A conta da tela de vendas (0053), igual, com a origem saindo das duas fontes.
create or replace function public.resumo_de_vendas(p_de date, p_ate date)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with base as (
    select t.*, coalesce(nullif(t.utm_source, ''), '@' || c.canal, '') as origem_final
    from public.tray_pedidos t
    left join public.canal_anotado_dos_pedidos(p_de, p_ate) c on c.pedido = t.pedido
    where t.dia between p_de and p_ate
  ),
  pagos as (
    select * from base where situacao = 'pago'
  )
  select jsonb_build_object(
    'totais', (
      select jsonb_build_object(
        'pagos', count(*) filter (where situacao = 'pago'),
        'valor_pago', coalesce(sum(total) filter (where situacao = 'pago'), 0),
        'aguardando', count(*) filter (where situacao = 'aguardando'),
        'valor_aguardando', coalesce(sum(total) filter (where situacao = 'aguardando'), 0),
        'cancelados', count(*) filter (where situacao = 'cancelado'),
        'valor_cancelado', coalesce(sum(total) filter (where situacao = 'cancelado'), 0),
        'frete', coalesce(sum(frete_valor) filter (where situacao = 'pago'), 0),
        'desconto', coalesce(sum(desconto) filter (where situacao = 'pago'), 0),
        'clientes', count(distinct coalesce(cliente_telefone, cliente_email, cliente_codigo))
                      filter (where situacao = 'pago'),
        'com_itens', count(*) filter (where situacao = 'pago' and itens is not null)
      )
      from base
    ),
    'por_dia', coalesce((
      select jsonb_agg(linha order by linha->>'dia')
      from (
        select jsonb_build_object(
          'dia', dia,
          'pagos', count(*) filter (where situacao = 'pago'),
          'valor_pago', coalesce(sum(total) filter (where situacao = 'pago'), 0),
          'aguardando', count(*) filter (where situacao = 'aguardando'),
          'valor_aguardando', coalesce(sum(total) filter (where situacao = 'aguardando'), 0),
          'cancelados', count(*) filter (where situacao = 'cancelado'),
          'valor_cancelado', coalesce(sum(total) filter (where situacao = 'cancelado'), 0)
        ) as linha
        from base
        group by dia
      ) d
    ), '[]'::jsonb),
    'por_hora', coalesce((
      select jsonb_agg(linha order by (linha->>'hora')::int)
      from (
        select jsonb_build_object('hora', hora, 'pagos', count(*), 'valor', sum(total)) as linha
        from (
          select extract(hour from feito_em at time zone 'America/Sao_Paulo')::int as hora, total
          from pagos
        ) x
        group by hora
      ) h
    ), '[]'::jsonb),
    'por_origem', coalesce((
      select jsonb_agg(linha)
      from (
        select jsonb_build_object(
          'origem', origem_final,
          'pagos', count(*) filter (where situacao = 'pago'),
          'valor', coalesce(sum(total) filter (where situacao = 'pago'), 0),
          'criados', count(*)
        ) as linha
        from base
        group by origem_final
      ) o
    ), '[]'::jsonb),
    'por_pagamento', coalesce((
      select jsonb_agg(linha order by (linha->>'valor')::numeric desc)
      from (
        select jsonb_build_object(
          'tipo', coalesce(pagamento_tipo, 'Sem informação'),
          'pagos', count(*) filter (where situacao = 'pago'),
          'valor', coalesce(sum(total) filter (where situacao = 'pago'), 0),
          'criados', count(*),
          'cancelados', count(*) filter (where situacao = 'cancelado')
        ) as linha
        from base
        group by coalesce(pagamento_tipo, 'Sem informação')
      ) f
    ), '[]'::jsonb),
    'produtos', coalesce((
      select jsonb_agg(linha order by (linha->>'valor')::numeric desc, (linha->>'quantidade')::numeric desc)
      from (
        select jsonb_build_object(
          'produto_tray_id', i.produto_tray_id,
          'nome', max(i.nome),
          'quantidade', sum(i.quantidade),
          'valor', sum(coalesce(i.preco, 0) * i.quantidade),
          'pedidos', count(distinct p.pedido),
          'url', max(pr.url),
          'imagem', max(pr.main_image_url)
        ) as linha
        from pagos p
        cross join lateral jsonb_to_recordset(coalesce(p.itens, '[]'::jsonb)) as i(
          produto_tray_id text, nome text, quantidade numeric, preco numeric
        )
        left join public.products pr on pr.tray_id = i.produto_tray_id
        group by i.produto_tray_id
        order by sum(coalesce(i.preco, 0) * i.quantidade) desc, sum(i.quantidade) desc
        limit 20
      ) t
    ), '[]'::jsonb),
    'pedidos', coalesce((
      select jsonb_agg(linha order by (linha->>'feito_em') desc)
      from (
        select jsonb_build_object(
          'pedido', pedido,
          'feito_em', feito_em,
          'cliente', cliente_nome,
          'cidade', cidade,
          'uf', uf,
          'total', total,
          'status', status,
          'situacao', situacao,
          'origem', origem_final,
          'pagamento', pagamento_tipo,
          'itens', (
            select string_agg(i.nome, ' + ')
            from jsonb_to_recordset(coalesce(itens, '[]'::jsonb)) as i(nome text)
          )
        ) as linha
        from base
        order by feito_em desc
        limit 40
      ) u
    ), '[]'::jsonb)
  );
$$;

-- O raio X dos pedidos (0062), igual, com a origem saindo das duas fontes.
create or replace function public.raio_x_dos_pedidos(p_de date, p_ate date)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with base as (
    select
      p.pedido, p.feito_em, p.total, p.situacao,
      coalesce(p.pagamento_tipo, '') as tipo,
      coalesce(nullif(p.utm_source, ''), '@' || c.canal, '') as origem,
      coalesce(p.cliente_telefone, p.cliente_email, p.cliente_codigo) as cliente
    from public.tray_pedidos p
    left join public.canal_anotado_dos_pedidos(p_de, p_ate) c on c.pedido = p.pedido
    where p.dia between p_de and p_ate
  ),
  ordenados as (
    select cliente, feito_em, lag(feito_em) over (partition by cliente order by feito_em) as anterior
    from base
    where cliente is not null
  )
  select jsonb_build_object(
    'totais', (
      select jsonb_build_object(
        'pedidos', count(*),
        'pagos', count(*) filter (where situacao = 'pago'),
        'cancelados', count(*) filter (where situacao = 'cancelado'),
        'aguardando', count(*) filter (where situacao = 'aguardando'),
        'valor_pago', coalesce(sum(total) filter (where situacao = 'pago'), 0),
        'valor_cancelado', coalesce(sum(total) filter (where situacao = 'cancelado'), 0),
        'clientes', count(distinct cliente),
        'clientes_que_pagaram', count(distinct cliente) filter (where situacao = 'pago')
      )
      from base
    ),
    'faixas', coalesce((
      select jsonb_agg(to_jsonb(f) order by f.faixa)
      from (
        select
          case when total < 300 then 1 when total < 500 then 2 when total < 800 then 3 when total < 1500 then 4 else 5 end as faixa,
          count(*) as pedidos,
          count(*) filter (where situacao = 'pago') as pagos,
          count(*) filter (where situacao = 'cancelado') as cancelados,
          coalesce(sum(total) filter (where situacao = 'pago'), 0) as valor_pago,
          coalesce(sum(total) filter (where situacao = 'cancelado'), 0) as valor_cancelado
        from base
        group by 1
      ) f
    ), '[]'::jsonb),
    'meios', coalesce((
      select jsonb_agg(to_jsonb(m))
      from (
        select
          tipo,
          count(*) as pedidos,
          count(*) filter (where situacao = 'pago') as pagos,
          count(*) filter (where situacao = 'cancelado') as cancelados,
          coalesce(sum(total) filter (where situacao = 'cancelado'), 0) as valor_cancelado
        from base
        group by tipo
      ) m
    ), '[]'::jsonb),
    'repetidos', (
      select jsonb_build_object('pedidos_a_mais', count(*), 'clientes', count(distinct cliente))
      from ordenados
      where anterior is not null and feito_em - anterior <= interval '72 hours'
    ),
    'por_origem', coalesce((
      select jsonb_agg(to_jsonb(o))
      from (
        select
          origem,
          count(*) as criados,
          count(*) filter (where situacao = 'pago') as pagos,
          count(*) filter (where situacao = 'cancelado') as cancelados,
          coalesce(sum(total) filter (where situacao = 'pago'), 0) as valor_pago,
          coalesce(sum(total) filter (where situacao = 'cancelado'), 0) as valor_cancelado
        from base
        group by origem
      ) o
    ), '[]'::jsonb)
  );
$$;
