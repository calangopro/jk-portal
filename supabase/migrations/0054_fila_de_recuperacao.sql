-- Fila de recuperação: quem tentou comprar na loja e não pagou.
--
-- POR QUE
--
-- De 14/10 a 12/11/2026, 73 clientes criaram pedido na loja, não pagaram e não
-- voltaram, somando R$ 87 mil: mais que os R$ 82,7 mil vendidos no período, e
-- com ticket três vezes maior (cartão recusado em compra alta). Esses pedidos
-- não entravam em fila nenhuma: o funil de recuperação da Kommo só recebe
-- carrinho abandonado.
--
-- COMO
--
-- A fila não é uma tabela, é uma CONTA sobre `tray_pedidos`, refeita a cada
-- leitura: junta por cliente os pedidos cancelados ou esperando pagamento da
-- janela e confere se a mesma pessoa pagou algum pedido depois. Assim ninguém
-- precisa "baixar" um caso quando o cliente volta sozinho: ele sai da fila na
-- importação seguinte.
--
-- Cliente é o telefone; sem telefone, o e-mail; sem os dois, o código da Tray.
-- "Pagou depois" vale a partir de duas horas ANTES da primeira tentativa,
-- porque é comum a pessoa fechar no cartão e o Pix aberto minutos antes ser
-- cancelado sozinho.
--
-- O que é decisão de gente mora em `recuperacao_casos`, preso ao pedido de
-- referência: em contato, pagou por fora da loja (com o valor, que é o único
-- registro desse Pix) ou descartado. Voltar para a fila é gravar 'a_recuperar'.
--
-- Só administrador lê e grava. As funções rodam com os direitos de quem chama.

create table public.recuperacao_casos (
  pedido         bigint primary key references public.tray_pedidos (pedido),
  estado         text not null check (estado in ('a_recuperar', 'em_contato', 'pago_por_fora', 'descartado')),
  nota           text check (char_length(nota) <= 300),
  valor_fora     numeric(12, 2) check (valor_fora > 0),
  atualizado_por uuid references public.profiles (id) on delete set null,
  atualizado_em  timestamptz not null default now(),
  constraint recuperacao_por_fora_com_valor check (estado <> 'pago_por_fora' or valor_fora is not null)
);

comment on table public.recuperacao_casos is
  'O que a equipe decidiu sobre um pedido não pago. A fila em si é calculada por fila_de_recuperacao().';

create index recuperacao_casos_atualizado_por_idx on public.recuperacao_casos (atualizado_por);

alter table public.recuperacao_casos enable row level security;

create policy recuperacao_casos_admin_select on public.recuperacao_casos
  for select to authenticated using ((select public.is_admin()));
create policy recuperacao_casos_admin_insert on public.recuperacao_casos
  for insert to authenticated with check ((select public.is_admin()));
create policy recuperacao_casos_admin_update on public.recuperacao_casos
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

revoke all on public.recuperacao_casos from anon;

create function public.fila_de_recuperacao(p_dias integer default 14)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with janela as (
    select p.*, coalesce(p.cliente_telefone, p.cliente_email, p.cliente_codigo) as cliente
    from public.tray_pedidos p
    where p.dia > (now() at time zone 'America/Sao_Paulo')::date - greatest(least(p_dias, 90), 1)
  ),
  por_cliente as (
    select
      cliente,
      count(*) as tentativas,
      min(feito_em) as primeira,
      max(feito_em) as ultima,
      max(total) as maior_valor,
      (array_agg(pedido order by feito_em desc))[1] as pedido_ref,
      array_agg(pedido) as pedidos
    from janela
    where situacao in ('cancelado', 'aguardando') and cliente is not null
    group by cliente
  ),
  casos as (
    select
      c.pedido_ref as pedido,
      c.tentativas,
      c.primeira,
      c.ultima,
      c.maior_valor,
      r.cliente_nome as cliente,
      r.cliente_telefone as telefone,
      r.cliente_email as email,
      r.cidade,
      r.uf,
      r.status,
      (r.situacao = 'aguardando') as aguardando,
      r.pagamento_tipo as pagamento,
      coalesce(r.utm_source, '') as origem,
      (
        select string_agg(i.nome, ' + ')
        from jsonb_to_recordset(coalesce(r.itens, '[]'::jsonb)) as i(nome text, preco numeric)
        where coalesce(i.preco, 0) > 0
      ) as itens,
      pg.pedido as pago_pedido,
      pg.total as pago_valor,
      pg.feito_em as pago_em,
      e.nota,
      e.valor_fora,
      e.atualizado_em as estado_em,
      case
        when pg.pedido is not null then 'recuperado'
        when e.estado in ('em_contato', 'pago_por_fora', 'descartado') then e.estado
        else 'a_recuperar'
      end as fase
    from por_cliente c
    join public.tray_pedidos r on r.pedido = c.pedido_ref
    left join lateral (
      select q.pedido, q.total, q.feito_em
      from public.tray_pedidos q
      where coalesce(q.cliente_telefone, q.cliente_email, q.cliente_codigo) = c.cliente
        and q.situacao = 'pago'
        and q.feito_em >= c.primeira - interval '2 hours'
      order by q.feito_em
      limit 1
    ) pg on true
    left join lateral (
      select s.estado, s.nota, s.valor_fora, s.atualizado_em
      from public.recuperacao_casos s
      where s.pedido = any (c.pedidos)
      order by s.atualizado_em desc
      limit 1
    ) e on true
  ),
  com_valor as (
    select
      casos.*,
      case fase
        when 'recuperado' then pago_valor
        when 'pago_por_fora' then valor_fora
        else maior_valor
      end as valor
    from casos
  )
  select jsonb_build_object(
    'dias', greatest(least(p_dias, 90), 1),
    'resumo', coalesce((
      select jsonb_object_agg(fase, jsonb_build_object('clientes', clientes, 'valor', valor))
      from (
        select fase, count(*) as clientes, coalesce(sum(valor), 0) as valor
        from com_valor
        group by fase
      ) t
    ), '{}'::jsonb),
    'casos', coalesce((
      select jsonb_agg(to_jsonb(l) order by l.valor desc, l.ultima desc)
      from (select * from com_valor order by valor desc limit 400) l
    ), '[]'::jsonb)
  );
$$;

revoke execute on function public.fila_de_recuperacao(integer) from public, anon;
grant execute on function public.fila_de_recuperacao(integer) to authenticated, service_role;
