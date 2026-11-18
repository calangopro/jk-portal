-- 0105: o vendedor acha o pedido do site que vendeu e marca como dele.
--
-- De onde veio: o dono do projeto, em 17/11/2026: "meu vendedor não consegue
-- achar as vendas que ele fez no site pra colocar que é dele. Deveria existir
-- algum buscador, filtro. Painel do vendedor deveria ser útil pra ele,
-- visualmente bom." O vendedor tem `lancar_venda`, e não `vendas`: não vê a
-- tela de pedidos da loja, que é faturamento. Para marcar um pedido como dele
-- (0103) precisava saber o número de antemão.
--
-- COMO FOI DESENHADO:
--
-- 1. `pedidos_do_site` é a lista para ACHAR e marcar: busca por número,
--    nome do cliente, telefone e peça; filtro por período e por "sem
--    vendedor", "meus" e "todos". Abre para quem tem `lancar_venda`, a mesma
--    área que já vê a ficha do cliente e o nome dele na busca do /pedido.
--
-- 2. A RÉGUA DO VALOR: a lista NÃO mostra o valor do pedido dos outros nem
--    do pedido sem vendedor. Uma lista de todos os pedidos pagos com o valor
--    de cada um deixaria somar o faturamento da loja, que só a área `vendas`
--    vê. O valor aparece no pedido que já é da própria pessoa (marcado como
--    dela, ou com venda por fora dela ligada a ele), como ela já vê o valor
--    das próprias vendas por fora. A gaveta do histórico passa a seguir a
--    mesma régua (`historico_do_pedido`, refeita abaixo). Custo e preço de
--    peça nunca saem.
--
-- 3. Quem vendeu, na lista, é o vendedor EFETIVO: a marcação mais recente em
--    `pedidos_vendedor` e, sem ela, quem lançou a venda por fora ligada ao
--    pedido. É a mesma leitura do ranking (0104), que conta o pedido com venda
--    por fora pela venda por fora, e não de novo pela loja.
--
-- 4. `pedido_marcar_vendedor_em_leva` marca vários pedidos de uma vez, pela
--    MESMA porta de um (`pedido_marcar_vendedor`): as mesmas travas, o mesmo
--    histórico, um pedido por vez. Quem lança venda antiga não precisa abrir
--    pedido por pedido.
--
-- 5. `meu_mes_de_vendas` é o número do Início do vendedor: o que ELE vendeu
--    no mês (por fora mais pedido do site marcado, pela regra do ranking), o
--    mês passado, a posição dele no ranking (só a posição, sem o número dos
--    outros) e quantos pedidos do site dos últimos 30 dias estão sem vendedor.
--
-- 6. Tudo `security definer`, com a área conferida em `coalesce(..., false)`.


-- ------------------------------------------------------- a lista para achar

create or replace function public.pedidos_do_site(
  p_busca text default null,
  p_filtro text default 'sem_vendedor',
  p_de date default null,
  p_ate date default null,
  p_situacao text default 'pago'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_eu uuid := (select auth.uid());
  v_ve_valor boolean := coalesce(public.tem_acesso('vendas'), false);
  v_atribui boolean := coalesce(public.tem_acesso('vendas') and public.tem_acesso('lancar_venda'), false);
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_de date := coalesce(p_de, v_hoje - 30);
  v_ate date := coalesce(p_ate, v_hoje);
  v_busca text := btrim(coalesce(p_busca, ''));
  v_digitos text := regexp_replace(btrim(coalesce(p_busca, '')), '\D', '', 'g');
  v_palavras text[];
  v_tipo text;
begin
  if not coalesce(public.tem_acesso('lancar_venda'), false) then
    return null;
  end if;
  if p_filtro is null or p_filtro not in ('sem_vendedor', 'meus', 'todos') then
    p_filtro := 'sem_vendedor';
  end if;
  -- O que foi digitado: número de pedido (até 7 dígitos), telefone (8 ou mais) ou texto.
  if v_busca = '' then
    v_tipo := 'nada';
  elsif v_busca ~ '^#?\s*[0-9]{1,7}$' then
    v_tipo := 'pedido';
  elsif v_busca ~ '^[0-9()+.\s-]+$' and char_length(v_digitos) >= 8 then
    v_tipo := 'telefone';
  else
    v_tipo := 'texto';
    v_palavras := array(
      select extensions.unaccent('extensions.unaccent'::regdictionary, lower(p))
      from regexp_split_to_table(v_busca, '\s+') p
      where char_length(p) >= 2
      limit 6);
  end if;

  return (
    with base as (
      select t.pedido, t.dia, t.feito_em, t.situacao, t.cliente_nome, t.cidade, t.uf, t.total, t.itens, t.cliente_telefone,
             (select pv.vendedor from public.pedidos_vendedor pv where pv.pedido = t.pedido order by pv.id desc limit 1) as marcado,
             (select v.vendedor_id from public.vendas_avulsas v where v.pedido_recuperado = t.pedido and v.estornada_em is null order by v.feita_em limit 1) as por_fora
      from public.tray_pedidos t
      where (v_tipo = 'pedido' or t.dia between v_de and v_ate)
        and (p_situacao = 'todos' or t.situacao = 'pago')
        and case v_tipo
          when 'pedido' then t.pedido::text like regexp_replace(v_busca, '\D', '', 'g') || '%'
          when 'telefone' then regexp_replace(coalesce(t.cliente_telefone, ''), '\D', '', 'g') like '%' || right(v_digitos, 11) || '%'
          when 'texto' then (
            select bool_and(alvo.texto like '%' || w || '%')
            from unnest(v_palavras) w,
                 (select extensions.unaccent('extensions.unaccent'::regdictionary, lower(
                    coalesce(t.cliente_nome, '') || ' ' || coalesce(t.cidade, '') || ' ' ||
                    coalesce((select string_agg(i->>'nome', ' ') from jsonb_array_elements(case when jsonb_typeof(t.itens) = 'array' then t.itens else '[]'::jsonb end) i), '')
                  )) as texto) alvo
          ) is not false
          else true end
    ),
    com_vendedor as (
      select b.*, coalesce(b.marcado, b.por_fora) as vendedor, (b.marcado is null and b.por_fora is not null) as so_por_fora
      from base b
    ),
    filtrado as (
      select c.*, count(*) over () as encontrados
      from com_vendedor c
      where case p_filtro
        when 'sem_vendedor' then c.vendedor is null
        when 'meus' then c.vendedor = v_eu
        else true end
      order by c.feito_em desc nulls last, c.pedido desc
      limit 120
    )
    select jsonb_build_object(
      'eu', v_eu,
      'de', v_de,
      'ate', v_ate,
      'busca', v_tipo,
      'encontrados', coalesce((select max(encontrados) from filtrado), 0),
      'pode', jsonb_build_object('atribuir', v_atribui, 've_valor', v_ve_valor),
      'vendedores', case when v_atribui then coalesce((
        select jsonb_agg(jsonb_build_object('id', pr.id, 'nome', coalesce(pr.full_name, 'Sem nome')) order by pr.full_name)
        from public.profiles pr where pr.is_active and public.pedido_pode_vender(pr.id)), '[]'::jsonb) end,
      'pedidos', coalesce((
        select jsonb_agg(jsonb_build_object(
          'numero', f.pedido,
          'dia', f.dia,
          'feito_em', f.feito_em,
          'situacao', f.situacao,
          'cliente', f.cliente_nome,
          'cidade', f.cidade,
          'uf', f.uf,
          'pecas', coalesce((
            select jsonb_agg(x.nome) from (
              select i->>'nome' as nome
              from jsonb_array_elements(case when jsonb_typeof(f.itens) = 'array' then f.itens else '[]'::jsonb end) i
              limit 3) x), '[]'::jsonb),
          'n_pecas', case when jsonb_typeof(f.itens) = 'array' then jsonb_array_length(f.itens) else 0 end,
          'vendedor', case when f.vendedor is not null then jsonb_build_object('id', f.vendedor, 'nome', public.chat_nome(f.vendedor)) end,
          'so_por_fora', f.so_por_fora,
          'meu', f.vendedor = v_eu,
          -- A régua do valor: só o pedido que é da própria pessoa, ou para quem vê o faturamento.
          'total', case when v_ve_valor or f.vendedor = v_eu then f.total end
        ) order by f.feito_em desc nulls last, f.pedido desc)
        from filtrado f), '[]'::jsonb)
    )
  );
end
$$;

-- ---------------------------------------------------------- marcar em leva

create or replace function public.pedido_marcar_vendedor_em_leva(p_numeros bigint[], p_vendedor uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n bigint;
  v_r jsonb;
  v_ok integer := 0;
  v_recusados jsonb := '[]'::jsonb;
begin
  if not coalesce(public.tem_acesso('lancar_venda'), false) then
    return jsonb_build_object('ok', false, 'erro', 'O seu acesso não marca vendedor em pedido.');
  end if;
  if p_numeros is null or cardinality(p_numeros) = 0 then
    return jsonb_build_object('ok', false, 'erro', 'Escolha os pedidos.');
  end if;
  if cardinality(p_numeros) > 200 then
    return jsonb_build_object('ok', false, 'erro', 'Dá para marcar até 200 pedidos de uma vez.');
  end if;
  -- Um por vez, pela MESMA porta de um pedido só: as mesmas travas e o mesmo histórico.
  foreach v_n in array (select array_agg(distinct x order by x) from unnest(p_numeros) x) loop
    v_r := public.pedido_marcar_vendedor(v_n, p_vendedor);
    if (v_r ->> 'ok') = 'true' then
      v_ok := v_ok + 1;
    else
      v_recusados := v_recusados || jsonb_build_object('numero', v_n, 'erro', v_r ->> 'erro');
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'marcados', v_ok, 'recusados', v_recusados);
end
$$;

-- ------------------------------------------------------------- o meu mês

create or replace function public.meu_mes_de_vendas()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_eu uuid := (select auth.uid());
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_ini date := date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date;
  v_ant_ini date := (date_trunc('month', (now() at time zone 'America/Sao_Paulo')) - interval '1 month')::date;
  v_ant_fim date := date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date - 1;
begin
  if not coalesce(public.tem_acesso('lancar_venda'), false) then
    return null;
  end if;
  return (
    with fora as (
      select v.vendedor_id, v.dia, v.valor
      from public.vendas_avulsas v
      where v.estornada_em is null and v.dia between v_ant_ini and v_hoje
    ),
    loja as (
      -- A regra do ranking (0104): pedido pago, marcado, sem venda por fora ligada.
      select x.vendedor as vendedor_id, x.dia, x.total as valor
      from (
        select t.dia, t.total,
               (select pv.vendedor from public.pedidos_vendedor pv where pv.pedido = t.pedido order by pv.id desc limit 1) as vendedor,
               exists (select 1 from public.vendas_avulsas v where v.pedido_recuperado = t.pedido and v.estornada_em is null) as tem_por_fora
        from public.tray_pedidos t
        where t.situacao = 'pago' and t.dia between v_ant_ini and v_hoje
      ) x
      where x.vendedor is not null and not x.tem_por_fora
    ),
    do_mes as (
      select vendedor_id, sum(valor) as valor from (
        select vendedor_id, valor from fora where dia >= v_ini
        union all
        select vendedor_id, valor from loja where dia >= v_ini
      ) u group by vendedor_id
    ),
    eu as (select coalesce((select valor from do_mes where vendedor_id = v_eu), 0) as valor)
    select jsonb_build_object(
      'mes', v_ini,
      'fora_vendas', (select count(*) from fora where vendedor_id = v_eu and dia >= v_ini),
      'fora_valor', (select coalesce(sum(valor), 0) from fora where vendedor_id = v_eu and dia >= v_ini),
      'loja_pedidos', (select count(*) from loja where vendedor_id = v_eu and dia >= v_ini),
      'loja_valor', (select coalesce(sum(valor), 0) from loja where vendedor_id = v_eu and dia >= v_ini),
      'mes_passado', (
        select coalesce(sum(valor), 0) from (
          select valor from fora where vendedor_id = v_eu and dia between v_ant_ini and v_ant_fim
          union all
          select valor from loja where vendedor_id = v_eu and dia between v_ant_ini and v_ant_fim) p),
      -- Só a posição, sem o número de ninguém.
      'posicao', case when (select valor from eu) > 0 then (select count(*) + 1 from do_mes d where d.valor > (select valor from eu)) end,
      'no_ranking', (select count(*) from do_mes where valor > 0),
      'sem_vendedor_30d', (
        select count(*) from public.tray_pedidos t
        where t.situacao = 'pago' and t.dia > v_hoje - 30
          and not exists (select 1 from public.pedidos_vendedor pv where pv.pedido = t.pedido)
          and not exists (select 1 from public.vendas_avulsas v where v.pedido_recuperado = t.pedido and v.estornada_em is null))
    )
  );
end
$$;

-- ------------------------------------------- a gaveta segue a mesma régua
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
  v_meu boolean := false;
begin
  if not v_ve then
    return null;
  end if;
  select * into t from public.tray_pedidos where pedido = p_numero;
  if not found then
    return jsonb_build_object('encontrado', false, 'numero', p_numero);
  end if;

  select f.etapa, nullif(btrim(f.rastreio), '') into v_etapa, v_rastreio from public.fabrica_pedidos f where f.pedido = t.pedido limit 1;

  -- O pedido é da própria pessoa (marcado como dela, ou com venda por fora dela ligada): ela vê o valor, como vê o das próprias vendas por fora (0105).
  v_meu := coalesce(
    (select pv.vendedor = v_quem from public.pedidos_vendedor pv where pv.pedido = t.pedido order by pv.id desc limit 1), false)
    or exists (select 1 from public.vendas_avulsas v where v.pedido_recuperado = t.pedido and v.estornada_em is null and v.vendedor_id = v_quem);

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
    'total', case when v_ve_valor or v_meu then t.total end,
    'pagamento', case when v_ve_valor or v_meu then t.pagamento_tipo end,
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
               'valor', case when v_ve_valor or v_meu then r.valor_fora end, 'quem', public.chat_nome(r.atualizado_por))
        from public.recuperacao_casos r where r.pedido = t.pedido
        -- A venda por fora ligada ao pedido.
        union all
        select v.feita_em, 3, jsonb_build_object('tipo', 'venda_fora', 'em', v.feita_em, 'quem', public.chat_nome(v.vendedor_id), 'forma', v.forma,
               'valor', case when v_ve_valor or v_meu then v.valor end)
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

revoke execute on function public.pedidos_do_site(text, text, date, date, text) from public, anon;
revoke execute on function public.pedido_marcar_vendedor_em_leva(bigint[], uuid) from public, anon;
revoke execute on function public.meu_mes_de_vendas() from public, anon;
grant execute on function public.pedidos_do_site(text, text, date, date, text) to authenticated;
grant execute on function public.pedido_marcar_vendedor_em_leva(bigint[], uuid) to authenticated;
grant execute on function public.meu_mes_de_vendas() to authenticated;
