-- Resumo de vendas da loja para a tela /admin/vendas.
--
-- POR QUE
--
-- A tela precisa de total por situação, por dia, por hora, por origem, por
-- forma de pagamento, dos produtos mais vendidos e dos últimos pedidos, tudo
-- para um intervalo de dias. O Supabase entrega no máximo 1.000 linhas por
-- pedido, e um mês da loja já passa de 400 pedidos criados, então a soma é
-- feita aqui e a tela recebe um objeto só.
--
-- COMO
--
-- A função roda com os direitos de quem chama (sem security definer), então a
-- RLS de `tray_pedidos` vale: só administrador recebe número. Para qualquer
-- outra pessoa a base vem vazia e os totais saem zerados.
--
-- "Pago" é a situação que entra em faturamento. Origem, hora e produtos somam
-- só pedido pago; a forma de pagamento traz também os criados e os cancelados,
-- porque é ali que se vê qual meio de pagamento mais perde venda.

create function public.resumo_de_vendas(p_de date, p_ate date)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with base as (
    select *
    from public.tray_pedidos
    where dia between p_de and p_ate
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
          'origem', coalesce(utm_source, ''),
          'pagos', count(*) filter (where situacao = 'pago'),
          'valor', coalesce(sum(total) filter (where situacao = 'pago'), 0),
          'criados', count(*)
        ) as linha
        from base
        group by coalesce(utm_source, '')
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
          'origem', coalesce(utm_source, ''),
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

revoke execute on function public.resumo_de_vendas(date, date) from public, anon;
grant execute on function public.resumo_de_vendas(date, date) to authenticated, service_role;
