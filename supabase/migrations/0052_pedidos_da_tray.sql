-- Pedidos da loja Tray, lidos da exportação do painel.
--
-- POR QUE
--
-- A JK não tinha onde ver venda sem pedir relatório no WhatsApp. A API da Tray
-- ainda não foi liberada, então os pedidos chegam pela exportação do próprio
-- painel (dois arquivos: pedidos e produtos vendidos), importada pelo comando
-- `npm run vendas:importar`. O passo a passo está em
-- `docs/tray-exportar-pedidos.md`. Quando a API chegar, ela passa a alimentar
-- esta mesma tabela.
--
-- COMO
--
-- Pedido criado não é venda: de maio a novembro de 2026, 43% dos pedidos
-- criados foram cancelados depois. Por isso cada linha guarda o status da Tray
-- e a `situacao` (pago, aguardando, cancelado), e cada importação traz os
-- últimos trinta dias inteiros, para o status de ontem ser corrigido hoje.
-- Quando o status muda, o anterior e a hora da troca ficam na linha.
--
-- Os itens moram na coluna `itens` (jsonb), trocados de uma vez a cada
-- importação, e a view `tray_itens_vendidos` abre um item por linha. Importação
-- sem o arquivo de itens não apaga os itens que já estavam gravados.
--
-- CPF, CNPJ e endereço ficam de fora: nenhuma conta do painel precisa deles.
-- Nome, e-mail e telefone ficam, porque é o que liga o pedido ao atendimento.
--
-- Só administrador lê (é faturamento da empresa). Quem grava é a função
-- abaixo, chamada com a chave de serviço.

create table public.tray_pedidos (
  pedido           bigint primary key check (pedido > 0),
  feito_em         timestamptz not null,
  dia              date not null,
  status           text not null,
  situacao         text not null check (situacao in ('pago', 'aguardando', 'cancelado')),
  cliente_codigo   text,
  cliente_nome     text,
  cliente_email    text,
  cliente_telefone text check (cliente_telefone ~ '^55[0-9]{10,11}$'),
  subtotal         numeric(12, 2),
  frete_tipo       text,
  frete_valor      numeric(12, 2),
  desconto         numeric(12, 2),
  cupom            text,
  total            numeric(12, 2) not null,
  pagamento_tipo   text,
  pagamento_em     date,
  forma_paga       text,
  valor_pago       numeric(12, 2),
  canal            text,
  parceiro         text,
  utm_source       text,
  cidade           text,
  uf               text,
  envio_em         date,
  envio_codigo     text,
  itens            jsonb,
  status_anterior  text,
  status_mudou_em  timestamptz,
  visto_em         timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);

comment on table public.tray_pedidos is
  'Pedidos da loja Tray. Só situacao = pago entra em faturamento.';
comment on column public.tray_pedidos.dia is
  'Dia de São Paulo em que o pedido foi feito. É o dia que os relatórios somam.';
comment on column public.tray_pedidos.parceiro is
  'Catálogo de origem na Tray (1516 Facebook e Instagram, 1517 Google Shopping). Não é vendedor.';
comment on column public.tray_pedidos.visto_em is
  'Primeira importação em que o pedido apareceu.';

create index tray_pedidos_dia_idx on public.tray_pedidos (dia desc, situacao);
create index tray_pedidos_telefone_idx on public.tray_pedidos (cliente_telefone)
  where cliente_telefone is not null;
create index tray_pedidos_email_idx on public.tray_pedidos (cliente_email)
  where cliente_email is not null;

alter table public.tray_pedidos enable row level security;

create policy tray_pedidos_admin_select on public.tray_pedidos
  for select to authenticated using ((select public.is_admin()));

revoke all on public.tray_pedidos from anon;

-- Um item por linha, para somar por produto. security_invoker ligado: a view
-- herda a RLS da tabela, e quem não é administrador não vê nada.
create view public.tray_itens_vendidos
with (security_invoker = true) as
select
  p.pedido,
  p.dia,
  p.feito_em,
  p.situacao,
  i.produto_tray_id,
  i.nome,
  i.referencia,
  i.quantidade,
  i.preco,
  i.custo,
  i.info
from public.tray_pedidos p
cross join lateral jsonb_to_recordset(coalesce(p.itens, '[]'::jsonb)) as i(
  produto_tray_id text,
  nome            text,
  referencia      text,
  quantidade      numeric,
  preco           numeric,
  custo           numeric,
  info            text
);

revoke all on public.tray_itens_vendidos from anon;

-- Grava um lote de pedidos e devolve quantos eram novos e quantos mudaram de
-- status. Tudo numa instrução só: a leitura do "antes" e a gravação enxergam o
-- mesmo retrato do banco, então a contagem não erra com duas rodadas juntas.
create function public.importar_pedidos_tray(p_pedidos jsonb)
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
      envio_em date, envio_codigo text, itens jsonb
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
      envio_em, envio_codigo, itens
    )
    select
      pedido, feito_em, dia, status, situacao,
      cliente_codigo, cliente_nome, cliente_email, cliente_telefone,
      subtotal, frete_tipo, frete_valor, desconto, cupom,
      total, pagamento_tipo, pagamento_em, forma_paga, valor_pago,
      canal, parceiro, utm_source, cidade, uf,
      envio_em, envio_codigo, itens
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
      utm_source       = excluded.utm_source,
      cidade           = excluded.cidade,
      uf               = excluded.uf,
      envio_em         = excluded.envio_em,
      envio_codigo     = excluded.envio_codigo,
      itens            = coalesce(excluded.itens, t.itens),
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
