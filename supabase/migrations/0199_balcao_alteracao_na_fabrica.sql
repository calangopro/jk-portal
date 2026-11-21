-- 0199: a loja pede alteração à fábrica (cartão 71).
--
-- Depois de mandar o pedido para a fábrica, peças e entrega não mudam pelo
-- balcão: a mudança vira PEDIDO DE ALTERAÇÃO, que deixa o cartão vermelho na
-- fila e no quadro até a fábrica dar ciência (0192). A função da 0192 pede a
-- área `lancar_venda`, que a conta da loja não tem (ela abriria telas com os
-- clientes do site). Esta função faz o mesmo para o pedido do balcão,
-- conferindo a loja, e `balcao_montar` passa a devolver as alterações com o
-- "a fábrica viu".
--
-- E UM FURO FECHADO: na 0198, quem não tem loja no perfil vê todas as lojas
-- (é a gerência geral e a diretoria). Uma conta de nível `loja` criada e ainda
-- sem loja escolhida caía nessa regra e enxergaria todas. Agora conta de loja
-- sem loja não vê nem mexe em nada, até a diretoria escolher a loja dela.

create or replace function public.balcao_pode(p_loja text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce(public.tem_acesso('balcao'), false)
     and case
       when public.minha_loja() is not null then public.minha_loja() = p_loja
       else not exists (select 1 from public.profiles x where x.id = (select auth.uid()) and x.role::text = 'loja')
     end
$$;

create or replace function public.balcao_pedir_alteracao(p_pedido uuid, p_texto text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_loja  text;
  v_fid   bigint;
  v_texto text := btrim(coalesce(p_texto, ''));
begin
  select p.loja, f.id into v_loja, v_fid
  from public.loja_pedidos p
  left join public.fabrica_avulsos a on a.loja_pedido = p.id
  left join public.fabrica_pedidos f on f.avulso = a.id
  where p.id = p_pedido;
  if v_loja is null or not public.balcao_pode(v_loja) then
    raise exception 'Pedido não encontrado.' using errcode = '42501';
  end if;
  if v_fid is null then
    raise exception 'O pedido ainda não foi para a fábrica: é só editar.' using errcode = '22023';
  end if;
  if char_length(v_texto) not between 3 and 500 or v_texto ~ '[—–]' then
    raise exception 'Escreva a alteração em até 500 letras, sem travessão.' using errcode = '22023';
  end if;
  insert into public.fabrica_alteracoes (fabrica_id, texto, pedido_por) values (v_fid, v_texto, (select auth.uid()));
  return public.balcao_montar(p_pedido);
end
$$;

create or replace function public.balcao_montar(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  select jsonb_build_object(
    'id', p.id, 'numero', p.numero, 'loja', p.loja,
    'vendedor', p.vendedor, 'vendedor_nome', v.nome,
    'cliente_nome', p.cliente_nome, 'cliente_telefone', p.cliente_telefone, 'cliente_email', p.cliente_email,
    'motivo', p.motivo, 'data_especial', p.data_especial,
    'pecas', p.pecas, 'formulario', p.formulario,
    'entrega', p.entrega, 'entrega_texto', p.entrega_texto, 'endereco', p.endereco, 'cidade', p.cidade, 'uf', p.uf,
    'prazo', p.prazo, 'total', p.total, 'observacao', p.observacao, 'numero_papel', p.numero_papel,
    'fotos', to_jsonb(p.fotos), 'transcricao', p.transcricao,
    'pago', coalesce(pg.pago, 0),
    'fabrica_em', p.fabrica_em, 'recebido_em', p.recebido_em, 'entregue_em', p.entregue_em,
    'cancelado_em', p.cancelado_em, 'cancelado_motivo', p.cancelado_motivo,
    'criado_em', p.criado_em, 'atualizado_em', p.atualizado_em,
    'criado_por_nome', (select nullif(split_part(coalesce(x.full_name, ''), ' ', 1), '') from public.profiles x where x.id = p.criado_por),
    'os', f.os, 'etapa', f.etapa, 'etapa_nome', e.nome, 'etapa_papel', e.papel, 'etapa_em', f.etapa_em, 'rastreio', f.rastreio,
    'ref', case when a.id is null then null else 'a' || a.id::text end,
    'pagamentos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id, 'valor', g.valor, 'forma', g.forma, 'parcelas', g.parcelas, 'pago_em', g.pago_em,
        'comprovante', g.comprovante, 'criado_em', g.criado_em,
        'estornado_em', g.estornado_em, 'estornado_motivo', g.estornado_motivo
      ) order by g.criado_em)
      from public.loja_pagamentos g where g.pedido = p.id
    ), '[]'::jsonb),
    'alteracoes', coalesce((
      select jsonb_agg(jsonb_build_object('id', al.id, 'texto', al.texto, 'pedido_em', al.pedido_em, 'ciente_em', al.ciente_em) order by al.pedido_em)
      from public.fabrica_alteracoes al where al.fabrica_id = f.id
    ), '[]'::jsonb),
    'anexos', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'caminho', x.caminho, 'tipo', x.tipo, 'nome', x.nome, 'criado_em', x.criado_em) order by x.criado_em)
      from public.loja_anexos x where x.pedido = p.id and x.tirado_em is null
    ), '[]'::jsonb)
  )
  from public.loja_pedidos p
  join public.loja_vendedores v on v.id = p.vendedor
  left join lateral (select sum(g.valor) as pago from public.loja_pagamentos g where g.pedido = p.id and g.estornado_em is null) pg on true
  left join public.fabrica_avulsos a on a.loja_pedido = p.id
  left join public.fabrica_pedidos f on f.avulso = a.id
  left join public.fabrica_etapas e on e.chave = f.etapa
  where p.id = p_id
$$;

revoke execute on function public.balcao_montar(uuid) from public, anon, authenticated;
revoke execute on function public.balcao_pedir_alteracao(uuid, text) from public, anon;
grant execute on function public.balcao_pedir_alteracao(uuid, text) to authenticated, service_role;
