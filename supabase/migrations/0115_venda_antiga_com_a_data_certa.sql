-- Venda por fora antiga entra com a data dela, e o estorno vale pelo dia em
-- que a venda foi LANÇADA.
--
-- Em 16/11/2026 o dono pediu aos vendedores para registrarem as vendas antigas
-- deles. A função de registrar (0058) só aceitava até 31 dias para trás, e o
-- que passava disso era gravado COM A DATA DE HOJE, em silêncio: uma venda de
-- agosto entraria no faturamento, na meta e no ranking de novembro. Nenhuma
-- venda chegou a ser gravada assim (a tabela estava vazia).
--
-- O que muda:
--   1. O dia da venda vale até 365 dias para trás. Fora disso, ou no futuro, a
--      venda é RECUSADA com motivo `dia`, em vez de mudar de data sozinha.
--      O número mora também em `DIAS_PARA_TRAS` (`src/lib/vendas/por-fora.ts`):
--      mudou um, muda o outro.
--   2. As travas de duplicidade olham mais longe, porque quem lança venda
--      antiga lembra do dia mais ou menos: outra venda por fora com o mesmo
--      telefone e valor em até 7 dias (era 1), e pedido PAGO da loja com o
--      mesmo telefone e valor em até 10 dias (eram 2). Continuam sendo aviso:
--      quem lança pode insistir, e a venda entra marcada para conferir.
--   3. `ja_na_loja` devolve o número do pedido, para a tela oferecer marcar o
--      pedido como venda da pessoa em vez de lançar o dinheiro de novo.
--   4. Venda de mais de dois dias atrás SEM telefone também vira aviso
--      (`sem_telefone`): sem telefone não há como conferir se ela já entrou
--      pela loja.
--   5. O vendedor estorna a própria venda LANÇADA hoje ou ontem, seja qual for
--      o dia da venda. Pela regra antiga (o dia da venda), quem lançasse por
--      engano uma venda de agosto não conseguia desfazer.
--   6. Estornar a venda de OUTRA pessoa passa a pedir as duas áreas, ver todas
--      as vendas e lançar venda (gerência e diretoria), como marcar quem vendeu
--      um pedido. Só com a área de vendas bastava, e o nível de tráfego, que a
--      tem para comparar gasto com venda, conseguia estornar pela API uma venda
--      que a tela nem mostra para ele.
--
-- A assinatura das duas funções não muda, então as permissões continuam as
-- mesmas. Permissão em plpgsql sempre dentro de `coalesce(..., false)`.

create or replace function public.registrar_venda_avulsa(
  p_valor numeric,
  p_forma text,
  p_canal text,
  p_cliente_nome text default null,
  p_telefone text default null,
  p_produto text default null,
  p_observacao text default null,
  p_dia date default null,
  p_vendedor uuid default null,
  p_pedido_recuperado bigint default null,
  p_forcar boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu       uuid := (select auth.uid());
  v_hoje     date := (now() at time zone 'America/Sao_Paulo')::date;
  v_dia      date;
  v_vendedor uuid;
  v_conferir text;
  v_texto    text;
  v_pedido   bigint;
  v_id       uuid;
begin
  if v_eu is null or not coalesce(public.tem_acesso('lancar_venda'), false) then
    return jsonb_build_object('ok', false, 'motivo', 'sem_acesso');
  end if;
  if p_valor is null or p_valor <= 0 then
    return jsonb_build_object('ok', false, 'motivo', 'valor');
  end if;

  -- Só quem vê todas as vendas lança em nome de outra pessoa.
  v_vendedor := case when p_vendedor is not null and coalesce(public.tem_acesso('vendas'), false) then p_vendedor else v_eu end;

  -- O dia da venda: hoje quando não vem, e até 365 dias para trás. Fora disso a venda não entra.
  v_dia := coalesce(p_dia, v_hoje);
  if v_dia > v_hoje or v_dia < v_hoje - 365 then
    return jsonb_build_object('ok', false, 'motivo', 'dia', 'desde', to_char(v_hoje - 365, 'YYYY-MM-DD'));
  end if;

  if p_telefone is null then
    if v_dia < v_hoje - 2 then
      if not p_forcar then return jsonb_build_object('ok', false, 'motivo', 'sem_telefone'); end if;
      v_conferir := 'Venda antiga sem telefone: não deu para conferir com a loja';
    end if;
  else
    select 'venda de ' || coalesce(split_part(p.full_name, ' ', 1), 'outra pessoa') || ' em ' || to_char(v.dia, 'DD/MM')
      into v_texto
    from public.vendas_avulsas v
    left join public.profiles p on p.id = v.vendedor_id
    where v.estornada_em is null and v.cliente_telefone = p_telefone and v.valor = p_valor
      and v.dia between v_dia - 7 and v_dia + 7
    order by abs(v.dia - v_dia)
    limit 1;
    if found then
      if not p_forcar then return jsonb_build_object('ok', false, 'motivo', 'repetida', 'parecida_com', v_texto); end if;
      v_conferir := 'Parecida com ' || v_texto;
    else
      select 'pedido ' || t.pedido || ' da loja, de ' || to_char(t.dia, 'DD/MM'), t.pedido
        into v_texto, v_pedido
      from public.tray_pedidos t
      where t.situacao = 'pago' and t.cliente_telefone = p_telefone and abs(t.total - p_valor) < 0.01
        and t.dia between v_dia - 10 and v_dia + 10
      order by abs(t.dia - v_dia)
      limit 1;
      if found then
        if not p_forcar then
          return jsonb_build_object('ok', false, 'motivo', 'ja_na_loja', 'parecida_com', v_texto, 'pedido', v_pedido);
        end if;
        v_conferir := 'Parecida com o ' || v_texto;
      end if;
    end if;
  end if;

  insert into public.vendas_avulsas (
    dia, vendedor_id, valor, forma, canal, cliente_nome, cliente_telefone, produto,
    pedido_recuperado, observacao, conferir, lancada_por
  ) values (
    v_dia, v_vendedor, round(p_valor, 2), p_forma, p_canal, nullif(btrim(p_cliente_nome), ''), p_telefone,
    nullif(btrim(p_produto), ''), p_pedido_recuperado, nullif(btrim(p_observacao), ''), v_conferir, v_eu
  )
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'conferir', v_conferir);
end;
$$;

-- O vendedor estorna a própria venda LANÇADA hoje ou ontem. Depois disso, só quem vê todas e lança venda.
create or replace function public.estornar_venda_avulsa(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu   uuid := (select auth.uid());
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if v_eu is null then
    return false;
  end if;
  update public.vendas_avulsas v
  set estornada_em = now(), estornada_por = v_eu
  where v.id = p_id and v.estornada_em is null
    and (
      coalesce(public.tem_acesso('vendas') and public.tem_acesso('lancar_venda'), false)
      or (
        coalesce(public.tem_acesso('lancar_venda'), false)
        and v.vendedor_id = v_eu
        and (v.criada_em at time zone 'America/Sao_Paulo')::date >= v_hoje - 1
      )
    );
  return found;
end;
$$;
