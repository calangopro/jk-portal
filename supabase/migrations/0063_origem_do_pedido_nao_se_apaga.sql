-- A origem do pedido não se apaga: quem não sabe a origem não troca a de quem sabe.
--
-- POR QUE
--
-- Os pedidos da Tray vão passar a entrar por duas portas: a exportação do
-- painel (CSV), que traz a coluna "UTM Source", e a API, que NÃO traz origem
-- nenhuma (conferido no pedido completo da loja de testes em 13/11/2026). A
-- função gravava `utm_source = excluded.utm_source`, então uma leitura pela API
-- trocaria por nulo a origem que a exportação tinha lido, e a tela de vendas e
-- a de tráfego perderiam de onde veio cada venda.
--
-- COMO
--
-- Só essa linha muda: vale a origem que chegou e, se não chegou nenhuma, a que
-- já estava. A origem de um pedido não muda depois de criado, então isso não
-- esconde correção nenhuma da exportação. O resto da função é o da 0052, igual.

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
      utm_source       = coalesce(excluded.utm_source, t.utm_source),
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
