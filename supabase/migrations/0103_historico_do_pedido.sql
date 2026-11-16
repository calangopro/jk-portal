-- 0103: o histórico do pedido, montado sozinho.
--
-- De onde veio: o dono do projeto, em 16/11/2026, com o suporte no ar:
-- "precisamos que tudo seja vinculado ao pedido, ter uma espécie de log do
-- pedido, do que está acontecendo com ele, histórico, quem atendeu, quem
-- direcionou, quem vendeu, por onde vendeu. Pra não ficar manual. Puxa tudo
-- dele com um clique."
--
-- COMO FOI DESENHADO:
--
-- 1. O histórico é CONTA, não tabela. Quase tudo o que aconteceu com um
--    pedido já está gravado, cada coisa no seu lugar: a loja (criado, pago,
--    status, envio), a origem anotada pela própria loja (por onde chegou), a
--    fábrica (cada mudança de etapa, com quem), a recuperação, a venda por
--    fora ligada ao pedido, o suporte (quem passou, quem assumiu, quem fechou)
--    e o chat (toda mensagem que marcou o pedido com /pedido). A função
--    `historico_do_pedido` junta tudo na hora. Ninguém escreve log à mão, e
--    o histórico nunca discorda das telas de onde ele vem.
--
-- 2. A única coisa NOVA a guardar é QUEM VENDEU. A Tray não grava vendedor,
--    e o pedido pago pelo site não tem como saber. O vendedor marca com um
--    toque ("Fui eu que vendi"); quem tem a área de vendas (gerente e
--    diretoria) pode marcar outra pessoa ou trocar. Cada marcação é uma linha
--    nova em `pedidos_vendedor` (vale a mais recente), então trocar de
--    vendedor fica no histórico, com quem trocou. A venda por fora ligada ao
--    pedido (`vendas_avulsas.pedido_recuperado`) também diz quem vendeu, sem
--    ninguém marcar nada.
--
-- 3. Quem vê: quem já vê pedido em alguma tela (áreas `lancar_venda`,
--    `fabrica`, `vendas`, `recuperacao` e `suporte`). O resto (conteúdo,
--    redes) recebe nulo. Dentro do histórico, a mesma régua da prévia do
--    pedido no chat: telefone para quem fala com cliente (todos menos a
--    fábrica), valor em dinheiro só para a área `vendas`. Custo nunca sai.
--
-- 4. RLS ligada sem policy na tabela nova; tudo por função `security
--    definer`, com a área conferida em `coalesce(..., false)`.

create table public.pedidos_vendedor (
  id bigint generated always as identity primary key,
  pedido bigint not null,
  vendedor uuid not null references public.profiles (id),
  por uuid not null references public.profiles (id),
  em timestamptz not null default now()
);
create index pedidos_vendedor_do_pedido on public.pedidos_vendedor (pedido, id desc);

alter table public.pedidos_vendedor enable row level security;
revoke all on public.pedidos_vendedor from anon, authenticated;

/** Quem pode receber a venda de um pedido: pessoa ativa cujo nível passa caso e registra venda (`lancar_venda`). */
create or replace function public.pedido_pode_vender(p uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles pr
    join public.acessos_por_papel a on a.papel = pr.role::text and a.area = 'lancar_venda' and a.liberado
    where pr.id = p and pr.is_active
  );
$$;

-- ------------------------------------------------------------ o histórico

create or replace function public.historico_do_pedido(p_numero bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_quem uuid := (select auth.uid());
  v_ve boolean := coalesce(public.tem_acesso('lancar_venda') or public.tem_acesso('fabrica') or public.tem_acesso('vendas')
                          or public.tem_acesso('recuperacao') or public.tem_acesso('suporte'), false);
  v_ve_telefone boolean := coalesce(public.tem_acesso('lancar_venda') or public.tem_acesso('vendas')
                                    or public.tem_acesso('recuperacao') or public.tem_acesso('suporte'), false);
  v_ve_valor boolean := coalesce(public.tem_acesso('vendas'), false);
  v_marca boolean := coalesce(public.tem_acesso('lancar_venda'), false);
  v_atribui boolean := coalesce(public.tem_acesso('vendas') and public.tem_acesso('lancar_venda'), false);
  t public.tray_pedidos;
  v_etapa text;
  v_rastreio text;
  v_visitante uuid;
  v_chegou_em timestamptz;
  v_canal text;
  v_ids text[];
  v_plataforma text;
  v_campanha text;
begin
  if not v_ve then
    return null;
  end if;
  select * into t from public.tray_pedidos where pedido = p_numero;
  if not found then
    return jsonb_build_object('encontrado', false, 'numero', p_numero);
  end if;

  select f.etapa, nullif(btrim(f.rastreio), '') into v_etapa, v_rastreio from public.fabrica_pedidos f where f.pedido = t.pedido limit 1;

  -- Por onde chegou: a mesma conta de `origem_dos_pedidos` (0064), para um pedido só. A sessão vem antes do número.
  select coalesce(
    (select os.visitante from public.origem_sessoes os where os.sessao = t.sessao),
    (select op.visitante from public.origem_pedidos op
      where op.pedido = t.pedido and op.em between t.feito_em - interval '15 minutes' and t.feito_em + interval '3 days'
      order by op.em limit 1)
  ) into v_visitante;
  if v_visitante is not null then
    select o.em, o.canal, o.ids into v_chegou_em, v_canal, v_ids
    from public.origem_toques o
    where o.visitante = v_visitante
      and o.em between t.feito_em - interval '30 days' and t.feito_em + interval '15 minutes'
      and o.canal <> 'direto'
    order by o.em desc
    limit 1;
    if v_ids is not null and cardinality(v_ids) > 0 then
      select a.plataforma, coalesce(c.nome, a.nome) into v_plataforma, v_campanha
      from public.anuncios_itens a
      left join lateral (
        select x.nome from public.anuncios_itens x
        where x.plataforma = a.plataforma and x.nivel = 'campanha' and x.item_id = case when a.nivel = 'campanha' then a.item_id else a.campanha_id end
        order by x.dia desc limit 1
      ) c on true
      where a.item_id = any (v_ids)
      order by case a.nivel when 'anuncio' then 1 when 'conjunto' then 2 else 3 end, a.dia desc
      limit 1;
    end if;
  end if;

  return jsonb_build_object(
    'encontrado', true,
    'numero', t.pedido,
    'dia', t.dia,
    'feito_em', t.feito_em,
    'situacao', t.situacao,
    'status', t.status,
    'etapa', public.chat_etapa_do_pedido(t.situacao, t.status, v_etapa),
    'entrega', t.frete_tipo,
    'cidade', t.cidade,
    'uf', t.uf,
    'rastreio', coalesce(v_rastreio, nullif(btrim(t.envio_codigo), '')),
    'total', case when v_ve_valor then t.total end,
    'pagamento', case when v_ve_valor then t.pagamento_tipo end,
    'cliente', jsonb_build_object(
      'nome', t.cliente_nome,
      'telefone', case when v_ve_telefone then public.suporte_telefone(t.cliente_telefone) end,
      'ref', 'p' || t.pedido
    ),
    'pecas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'nome', i->>'nome',
        'quantidade', i->>'quantidade',
        'foto', (select pr.main_image_url from public.products pr where pr.tray_id = i->>'produto_tray_id')))
      from jsonb_array_elements(case when jsonb_typeof(t.itens) = 'array' then t.itens else '[]'::jsonb end) i), '[]'::jsonb),
    'origem', jsonb_build_object(
      'utm_source', t.utm_source,
      'parceiro', t.parceiro,
      'canal_anotado', v_canal,
      'chegou_em', v_chegou_em,
      'plataforma', v_plataforma,
      'campanha', v_campanha
    ),
    'vendedor', (
      select jsonb_build_object('id', pv.vendedor, 'nome', public.chat_nome(pv.vendedor), 'por_nome', public.chat_nome(pv.por), 'em', pv.em, 'proprio', pv.por = pv.vendedor)
      from public.pedidos_vendedor pv where pv.pedido = t.pedido order by pv.id desc limit 1
    ),
    'vendas_por_fora', coalesce((
      select jsonb_agg(jsonb_build_object('nome', public.chat_nome(v.vendedor_id), 'em', v.feita_em) order by v.feita_em)
      from public.vendas_avulsas v where v.pedido_recuperado = t.pedido and v.estornada_em is null), '[]'::jsonb),
    'pode', jsonb_build_object(
      'marcar', v_marca,
      'atribuir', v_atribui,
      'fabrica', coalesce(public.tem_acesso('fabrica'), false),
      'ficha', coalesce(public.tem_acesso('lancar_venda'), false),
      'suporte', coalesce(public.tem_acesso('lancar_venda'), false)
    ),
    'vendedores', case when v_atribui then coalesce((
      select jsonb_agg(jsonb_build_object('id', pr.id, 'nome', coalesce(pr.full_name, 'Sem nome')) order by pr.full_name)
      from public.profiles pr
      where pr.is_active and public.pedido_pode_vender(pr.id)), '[]'::jsonb) end,
    'eu', v_quem,
    'eventos', coalesce((
      select jsonb_agg(e.j order by e.em desc, e.ordem desc)
      from (
        -- A loja.
        select t.feito_em as em, 1 as ordem, jsonb_build_object('tipo', 'criado', 'em', t.feito_em) as j
        union all
        select (t.pagamento_em + time '23:59') at time zone 'America/Sao_Paulo', 3,
               jsonb_build_object('tipo', 'pago', 'dia', t.pagamento_em)
        where t.pagamento_em is not null and t.situacao = 'pago'
        union all
        select t.status_mudou_em, 4, jsonb_build_object('tipo', 'status', 'em', t.status_mudou_em, 'de', t.status_anterior, 'para', t.status)
        where t.status_mudou_em is not null and t.status_anterior is not null
        union all
        select (t.envio_em + time '23:58') at time zone 'America/Sao_Paulo', 8,
               jsonb_build_object('tipo', 'envio', 'dia', t.envio_em, 'codigo', nullif(btrim(t.envio_codigo), ''))
        where t.envio_em is not null
        -- Por onde chegou.
        union all
        select v_chegou_em, 0, jsonb_build_object('tipo', 'chegada', 'em', v_chegou_em, 'canal', v_canal, 'plataforma', v_plataforma, 'campanha', v_campanha)
        where v_chegou_em is not null
        -- A fábrica: cada mudança de etapa, com quem mudou.
        union all
        select m.em, 5, jsonb_build_object('tipo', 'fabrica', 'em', m.em, 'de', m.de, 'para', m.para, 'quem', public.chat_nome(m.por))
        from public.fabrica_movimentos m where m.pedido = t.pedido
        -- A recuperação: o estado de agora, com quem cuidou.
        union all
        select r.atualizado_em, 2, jsonb_build_object('tipo', 'recuperacao', 'em', r.atualizado_em, 'estado', r.estado, 'nota', r.nota,
               'valor', case when v_ve_valor then r.valor_fora end, 'quem', public.chat_nome(r.atualizado_por))
        from public.recuperacao_casos r where r.pedido = t.pedido
        -- A venda por fora ligada ao pedido.
        union all
        select v.feita_em, 3, jsonb_build_object('tipo', 'venda_fora', 'em', v.feita_em, 'quem', public.chat_nome(v.vendedor_id), 'forma', v.forma,
               'valor', case when v_ve_valor then v.valor end)
        from public.vendas_avulsas v where v.pedido_recuperado = t.pedido and v.estornada_em is null
        -- O suporte: quem passou, quem assumiu, quem fechou.
        union all
        select sm.em, 6, jsonb_build_object('tipo', 'suporte', 'em', sm.em, 'caso', sc.id, 'assunto', sc.assunto, 'de', sm.de, 'para', sm.para,
               'nota', sm.nota, 'quem', public.chat_nome(sm.quem))
        from public.suporte_movimentos sm join public.suporte_casos sc on sc.id = sm.caso where sc.pedido = t.pedido
        -- Quem vendeu, marcado no painel.
        union all
        select pv.em, 7, jsonb_build_object('tipo', 'vendedor', 'em', pv.em, 'quem', public.chat_nome(pv.vendedor), 'por', public.chat_nome(pv.por), 'proprio', pv.por = pv.vendedor)
        from public.pedidos_vendedor pv where pv.pedido = t.pedido
        -- O chat: toda mensagem que marcou o pedido com /pedido. O chat é aberto ao time, então o trecho é o mesmo que está lá.
        union all
        select c.criada_em, 9, jsonb_build_object('tipo', 'chat', 'em', c.criada_em, 'sala', c.sala, 'mensagem', c.id, 'quem', public.chat_nome(c.autor),
               'texto', left(c.texto, 400))
        from public.chat_mensagens c
        where c.apagada_em is null and strpos(c.texto, '⟦o:' || t.pedido || '|') > 0
      ) e
    ), '[]'::jsonb)
  );
end
$$;

-- ---------------------------------------------------------- quem vendeu

/**
 * Marca quem vendeu o pedido. Sem `p_vendedor`, é a própria pessoa ("Fui eu
 * que vendi"). Marcar outra pessoa, ou trocar quem já estava marcado, é de
 * quem tem a área de vendas (gerente e diretoria).
 */
create or replace function public.pedido_marcar_vendedor(p_numero bigint, p_vendedor uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quem uuid := (select auth.uid());
  v_vendedor uuid := coalesce(p_vendedor, (select auth.uid()));
  v_atribui boolean := coalesce(public.tem_acesso('vendas') and public.tem_acesso('lancar_venda'), false);
  v_atual uuid;
begin
  if not coalesce(public.tem_acesso('lancar_venda'), false) then
    return jsonb_build_object('ok', false, 'erro', 'O seu acesso não marca vendedor em pedido.');
  end if;
  if not exists (select 1 from public.tray_pedidos where pedido = p_numero) then
    return jsonb_build_object('ok', false, 'erro', 'Esse pedido não está no painel.');
  end if;
  if v_vendedor <> v_quem and not v_atribui then
    return jsonb_build_object('ok', false, 'erro', 'Só a diretoria e a gerência marcam a venda para outra pessoa.');
  end if;
  if not coalesce(public.pedido_pode_vender(v_vendedor), false) then
    return jsonb_build_object('ok', false, 'erro', 'Essa pessoa não registra venda no painel.');
  end if;
  -- Trava a linha do pedido: duas pessoas marcando ao mesmo tempo não viram duas marcações cruzadas.
  perform 1 from public.tray_pedidos where pedido = p_numero for update;
  select pv.vendedor into v_atual from public.pedidos_vendedor pv where pv.pedido = p_numero order by pv.id desc limit 1;
  if v_atual = v_vendedor then
    return jsonb_build_object('ok', true);
  end if;
  if v_atual is not null and not v_atribui then
    return jsonb_build_object('ok', false, 'erro', format('Esse pedido já está marcado como venda de %s. Quem troca é a gerência ou a diretoria.', coalesce(public.chat_nome(v_atual), 'outra pessoa')));
  end if;
  insert into public.pedidos_vendedor (pedido, vendedor, por) values (p_numero, v_vendedor, v_quem);
  return jsonb_build_object('ok', true);
end
$$;

revoke execute on function public.pedido_pode_vender(uuid) from public, anon, authenticated;
revoke execute on function public.historico_do_pedido(bigint) from public, anon;
revoke execute on function public.pedido_marcar_vendedor(bigint, uuid) from public, anon;
grant execute on function public.historico_do_pedido(bigint) to authenticated;
grant execute on function public.pedido_marcar_vendedor(bigint, uuid) to authenticated;
