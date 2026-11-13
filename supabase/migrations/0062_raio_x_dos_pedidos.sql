-- Raio X dos pedidos: onde a venda se perde DEPOIS que o pedido é criado.
--
-- POR QUE
--
-- A tela de vendas diz quanto entrou. Falta dizer onde vaza: em que faixa de
-- valor o pedido deixa de ser pago, qual meio de pagamento perde mais, e quanto
-- do que parece pedido novo é a mesma pessoa tentando de novo depois de o
-- cartão recusar. A análise de 09/11/2026 achou os três à mão (pedido acima de
-- R$ 1.500 quase nunca pago, boleto nunca pago, 114 pedidos repetidos). Esta
-- função refaz a conta para qualquer intervalo, para a tela de gargalos.
--
-- COMO
--
-- Tudo sai de `tray_pedidos`. Roda com os direitos de quem chama: sem a área de
-- vendas, a base vem vazia e os totais saem zerados.
--
-- "Tentativa repetida" é o pedido feito pelo MESMO cliente a menos de 72 horas
-- do pedido anterior dele. Cliente é o telefone; sem telefone, o e-mail; sem os
-- dois, o código da Tray (a mesma regra da fila de recuperação).
--
-- A origem volta crua (`utm_source`): quem agrupa por canal é o código, com a
-- mesma função que a tela de vendas usa, para as duas telas nunca discordarem.

create function public.raio_x_dos_pedidos(p_de date, p_ate date)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with base as (
    select
      p.pedido, p.feito_em, p.total, p.situacao,
      coalesce(p.pagamento_tipo, '') as tipo,
      coalesce(p.utm_source, '') as origem,
      coalesce(p.cliente_telefone, p.cliente_email, p.cliente_codigo) as cliente
    from public.tray_pedidos p
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

revoke execute on function public.raio_x_dos_pedidos(date, date) from public, anon;
grant execute on function public.raio_x_dos_pedidos(date, date) to authenticated, service_role;
