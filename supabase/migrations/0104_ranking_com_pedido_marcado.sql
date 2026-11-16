-- 0104: o ranking de Vendedores passa a contar o pedido da loja marcado.
--
-- De onde veio: com o histórico do pedido no ar (0103), o vendedor marca
-- "Fui eu que vendi" no pedido pago pelo site, e o dono do projeto pediu, em
-- 16/11/2026, que o ranking passasse a contar essa venda.
--
-- COMO FOI DESENHADO:
--
-- 1. Função NOVA, e não mudança em `resumo_por_fora`. Aquela alimenta a meta
--    do mês, a tela de vendas e a conta de custos como "o que entrou POR
--    FORA da loja"; somar ali o pedido pago na loja contaria o mesmo dinheiro
--    duas vezes no faturamento. O ranking é outra pergunta: quanto cada
--    pessoa vendeu, por qualquer caminho.
--
-- 2. Por fora é a MESMA conta de `resumo_por_fora` (venda não estornada, pelo
--    dia da venda). Na loja é o pedido PAGO, pelo dia do pedido (a mesma régua
--    do faturamento), cuja marcação mais recente em `pedidos_vendedor` é da
--    pessoa.
--
-- 3. Sem contar em dobro: pedido que já tem venda por fora ligada a ele
--    (`vendas_avulsas.pedido_recuperado`, não estornada) não entra na parte
--    da loja. O dinheiro dele já está na venda por fora.
--
-- 4. A função diz também quantos pedidos pagos do período ainda estão SEM
--    vendedor marcado, para o número ser lido como "o que foi marcado", e não
--    como "tudo o que a pessoa vendeu".
--
-- 5. Só quem tem a área `vendas` (a mesma da tela). `security definer`, com a
--    área conferida em `coalesce(..., false)`.

create or replace function public.ranking_de_vendedores(p_de date, p_ate date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not coalesce(public.tem_acesso('vendas'), false) then
    return null;
  end if;
  return (
    with fora as (
      select v.vendedor_id, count(*) as vendas, sum(v.valor) as valor,
             count(*) filter (where v.canal = 'recuperacao' or v.pedido_recuperado is not null) as recuperadas,
             coalesce(sum(v.valor) filter (where v.canal = 'recuperacao' or v.pedido_recuperado is not null), 0) as valor_recuperado
      from public.vendas_avulsas v
      where v.dia between p_de and p_ate and v.estornada_em is null
      group by v.vendedor_id
    ),
    pagos as (
      select t.pedido, t.total,
             (select pv.vendedor from public.pedidos_vendedor pv where pv.pedido = t.pedido order by pv.id desc limit 1) as vendedor,
             exists (select 1 from public.vendas_avulsas v where v.pedido_recuperado = t.pedido and v.estornada_em is null) as tem_por_fora
      from public.tray_pedidos t
      where t.dia between p_de and p_ate and t.situacao = 'pago'
    ),
    loja as (
      select p.vendedor as vendedor_id, count(*) as pedidos, sum(p.total) as valor
      from pagos p
      where p.vendedor is not null and not p.tem_por_fora
      group by p.vendedor
    ),
    juntos as (
      select coalesce(f.vendedor_id, l.vendedor_id) as vendedor_id,
             coalesce(f.vendas, 0) as fora_vendas, coalesce(f.valor, 0) as fora_valor,
             coalesce(f.recuperadas, 0) as recuperadas, coalesce(f.valor_recuperado, 0) as valor_recuperado,
             coalesce(l.pedidos, 0) as loja_pedidos, coalesce(l.valor, 0) as loja_valor
      from fora f
      full join loja l on l.vendedor_id = f.vendedor_id
    )
    select jsonb_build_object(
      'por_vendedor', coalesce((
        select jsonb_agg(jsonb_build_object(
          'vendedor_id', j.vendedor_id,
          'vendedor', coalesce(split_part(pr.full_name, ' ', 1), 'Sem nome'),
          'fora_vendas', j.fora_vendas,
          'fora_valor', j.fora_valor,
          'recuperadas', j.recuperadas,
          'valor_recuperado', j.valor_recuperado,
          'loja_pedidos', j.loja_pedidos,
          'loja_valor', j.loja_valor,
          'vendas', j.fora_vendas + j.loja_pedidos,
          'valor', j.fora_valor + j.loja_valor
        ) order by j.fora_valor + j.loja_valor desc)
        from juntos j
        left join public.profiles pr on pr.id = j.vendedor_id
      ), '[]'::jsonb),
      'loja', (select jsonb_build_object('pedidos', count(*), 'valor', coalesce(sum(total), 0)) from pagos where vendedor is not null and not tem_por_fora),
      'sem_vendedor', (select jsonb_build_object('pedidos', count(*), 'valor', coalesce(sum(total), 0)) from pagos where vendedor is null and not tem_por_fora)
    )
  );
end
$$;

revoke execute on function public.ranking_de_vendedores(date, date) from public, anon;
grant execute on function public.ranking_de_vendedores(date, date) to authenticated;
