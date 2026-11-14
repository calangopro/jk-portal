-- 0068: a fila da fábrica ganha a foto da peça e o movimento em leva.
--
-- DUAS MUDANÇAS, pedidas por quem usa a fila:
--
-- 1. Cada peça do pedido passa a vir com a foto principal do produto na loja.
--    O item do pedido guarda o código do produto na Tray (`produto_tray_id`),
--    que é o `tray_id` do catálogo: em 14/11/2026, os 290 itens pagos dos
--    últimos trinta dias casaram, 277 com foto. Na bancada, a foto tira a
--    dúvida que o nome comprido da peça deixa.
--
-- 2. Mover VÁRIOS pedidos de uma vez. A fila nasceu com 63 pedidos em "a
--    produzir", e parte deles já tinha saído sem a Tray saber. Abrir pedido por
--    pedido para dar baixa não é trabalho que alguém faça. A função nova chama
--    a de um pedido só para cada um, então quem moveu e o histórico de
--    movimentos saem iguais.
--
-- Pular etapa (de "a produzir" direto para "enviado") não pede migration: a
-- função de mover sempre aceitou qualquer etapa de destino. Era a tela que só
-- oferecia a seguinte.

-- ------------------------------------------------------------------ a fila

create or replace function public.fila_da_fabrica(p_dias integer default 15)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with pode as (select public.tem_acesso('fabrica') as sim),
  janela as (
    select
      p.pedido, p.dia, p.feito_em, p.status, p.cliente_nome, p.cidade, p.uf, p.frete_tipo, p.envio_codigo, p.itens,
      f.etapa as etapa_da_fabrica, f.etapa_em, f.rastreio, f.nota, f.atualizado_por,
      case
        when f.etapa = 'enviado' or upper(coalesce(p.status, '')) in ('ENVIADO', 'FINALIZADO', 'PROBLEMAS NA ENTREGA') then 'enviado'
        else coalesce(f.etapa, 'a_produzir')
      end as etapa
    from public.tray_pedidos p
    left join public.fabrica_pedidos f on f.pedido = p.pedido
    where (select sim from pode)
      and p.situacao = 'pago'
      and (
        p.dia > (now() at time zone 'America/Sao_Paulo')::date - greatest(least(p_dias, 120), 1)
        or (f.etapa is not null and f.etapa <> 'enviado')
      )
  ),
  -- O pedido que entrou só por ter linha antiga e que a Tray já deu como
  -- enviado não precisa aparecer: saiu da produção.
  visiveis as (
    select * from janela j
    where j.etapa <> 'enviado'
       or j.dia > (now() at time zone 'America/Sao_Paulo')::date - greatest(least(p_dias, 120), 1)
  ),
  pronto as (
    select
      v.*,
      (select coalesce(jsonb_agg(jsonb_build_object(
          'nome', i->>'nome',
          'quantidade', i->>'quantidade',
          'referencia', i->>'referencia',
          'info', i->>'info',
          'produto', i->>'produto_tray_id',
          'foto', (select pr.main_image_url from public.products pr where pr.tray_id = i->>'produto_tray_id')
        )), '[]'::jsonb)
       from jsonb_array_elements(case when jsonb_typeof(v.itens) = 'array' then v.itens else '[]'::jsonb end) i) as pecas,
      (select pr.full_name from public.profiles pr where pr.id = v.atualizado_por) as movido_por
    from visiveis v
  )
  select jsonb_build_object(
    'dias', greatest(least(p_dias, 120), 1),
    'pedidos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'pedido', pedido,
        'dia', dia,
        'feito_em', feito_em,
        'status_da_loja', status,
        'etapa', etapa,
        'etapa_em', etapa_em,
        'movido_por', movido_por,
        'cliente', cliente_nome,
        'cidade', cidade,
        'uf', uf,
        'entrega', frete_tipo,
        'rastreio', coalesce(nullif(rastreio, ''), nullif(envio_codigo, '')),
        'nota', nota,
        'pecas', pecas
      ) order by feito_em)
      from pronto
    ), '[]'::jsonb)
  )
$$;


-- ------------------------------------------------------------- mover em leva

/**
 * Move vários pedidos para a mesma etapa. Não mexe em rastreio nem em anotação.
 * Pedido que não está pago fica de fora e volta na lista `fora`, em vez de
 * derrubar a leva inteira.
 */
create or replace function public.mover_pedidos_da_fabrica(p_pedidos bigint[], p_etapa text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pedido bigint;
  v_movidos integer := 0;
  v_fora bigint[] := '{}';
begin
  if not public.tem_acesso('fabrica') then
    raise exception 'Seu acesso não inclui a fábrica.' using errcode = '42501';
  end if;
  if p_etapa is null or p_etapa not in ('a_produzir', 'em_producao', 'pronto', 'enviado') then
    raise exception 'Etapa desconhecida.' using errcode = '22023';
  end if;
  if coalesce(array_length(p_pedidos, 1), 0) = 0 or array_length(p_pedidos, 1) > 200 then
    raise exception 'Escolha de 1 a 200 pedidos por vez.' using errcode = '22023';
  end if;

  for v_pedido in select distinct x from unnest(p_pedidos) as t(x) where x is not null loop
    if exists (select 1 from public.tray_pedidos p where p.pedido = v_pedido and p.situacao = 'pago') then
      perform public.mover_pedido_da_fabrica(v_pedido, p_etapa);
      v_movidos := v_movidos + 1;
    else
      v_fora := v_fora || v_pedido;
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'movidos', v_movidos, 'fora', to_jsonb(v_fora));
end
$$;

revoke execute on function public.mover_pedidos_da_fabrica(bigint[], text) from public, anon;
grant execute on function public.mover_pedidos_da_fabrica(bigint[], text) to authenticated;
