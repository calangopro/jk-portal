-- 0185: a linha do tempo do cliente na ficha, com a Kommo (cartões 54 e 31).
--
-- SÓ LEITURA. Uma função nova, `linha_do_tempo_do_cliente(ref)`, que junta o
-- que a ficha (`ficha_do_cliente`, 0069) ainda não junta:
--
-- - por pedido do cliente (os 30 mais novos), os acontecimentos de
--   `historico_do_pedido` (0103 e 0105) e, nos três pagos mais novos, as
--   chegadas e o anúncio de `origem_do_pedido` (0112 e 0113). A função CHAMA
--   as duas, não copia a regra: o que cada uma mostra (valor só para a área
--   `vendas` ou para o dono da venda, telefone nunca) continua decidido nelas;
-- - a fábrica e o suporte das vendas por fora, que não têm pedido da loja e
--   por isso não passam por `historico_do_pedido`;
-- - a Kommo: os negócios do cliente, achados pelo telefone e pelo e-mail dos
--   contatos do espelho (e pelo campo "Pedido Tray" que casa com um pedido
--   dele), e os eventos desses negócios em `kommo_eventos`, sem mensagem nem
--   nota (a tabela nem guarda texto).
--
-- Quem lê: a mesma área da ficha, `lancar_venda`. Fábrica, tráfego e a chave
-- anônima recebem nulo. O valor do negócio na Kommo sai só para a área
-- `vendas` ou para quem é o responsável dele pelo `kommo_mapa`, a régua de
-- 0105. Telefone e e-mail não saem daqui.
--
-- "Aberto" e "esperando resposta" são a MESMA conta de `kommo_meus_negocios`
-- (0179): etapa fora de 142 e 143 e fase fora de ganho, perdido e pós-venda;
-- cliente esperando quando a última mensagem dele é mais nova que a da loja.
-- Mudou lá, muda aqui.

create or replace function public.linha_do_tempo_do_cliente(p_ref text)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_eu uuid := (select auth.uid());
  v_ve_valor boolean := coalesce(public.tem_acesso('vendas'), false);
  v_chave text;
  v_pedidos bigint[];
  v_vendas uuid[];
  v_telefones text[];
  v_emails text[];
  v_contatos bigint[];
  v_negocios bigint[];
  v_com_origem bigint[];
begin
  if v_eu is null or not coalesce(public.tem_acesso('lancar_venda'), false) then
    return null;
  end if;

  v_chave := public.cliente_da_ref(p_ref);
  if v_chave is null then
    return jsonb_build_object('ok', false);
  end if;

  -- Os pedidos do cliente, a mesma chave da ficha. Os 30 mais novos bastam para a linha do tempo.
  select coalesce(array_agg(x.pedido order by x.feito_em desc), '{}')
    into v_pedidos
    from (
      select t.pedido, t.feito_em
        from public.tray_pedidos t
       where coalesce(t.cliente_telefone, t.cliente_email, t.cliente_codigo) = v_chave
       order by t.feito_em desc
       limit 30
    ) x;

  select coalesce(array_agg(t.pedido), '{}')
    into v_com_origem
    from (
      select t.pedido from public.tray_pedidos t
       where t.pedido = any (v_pedidos) and t.situacao = 'pago'
       order by t.feito_em desc
       limit 3
    ) t;

  select coalesce(array_agg(v.id), '{}')
    into v_vendas
    from public.vendas_avulsas v
   where v.cliente_telefone = v_chave or v.pedido_recuperado = any (v_pedidos);

  -- Telefone e e-mail do cliente, para achar o contato na Kommo.
  select coalesce(array_agg(distinct f), '{}') into v_telefones
    from (
      select v_chave as f where v_chave ~ '^55[0-9]{10,11}$'
      union
      select t.cliente_telefone from public.tray_pedidos t
       where coalesce(t.cliente_telefone, t.cliente_email, t.cliente_codigo) = v_chave and t.cliente_telefone ~ '^55[0-9]{10,11}$'
    ) s;
  select coalesce(array_agg(distinct lower(e)), '{}') into v_emails
    from (
      select v_chave as e where v_chave like '%@%'
      union
      select t.cliente_email from public.tray_pedidos t
       where coalesce(t.cliente_telefone, t.cliente_email, t.cliente_codigo) = v_chave and t.cliente_email like '%@%'
    ) s;

  select coalesce(array_agg(distinct c.id), '{}') into v_contatos
    from public.kommo_contatos c
   where not c.apagado
     and (c.telefone = any (v_telefones)
          or c.telefones && v_telefones
          or (c.email is not null and lower(c.email) = any (v_emails)));

  select coalesce(array_agg(distinct n.id), '{}') into v_negocios
    from public.kommo_negocios n
   where n.contato_id = any (v_contatos)
      or (n.pedido_tray is not null and n.pedido_tray = any (select p::text from unnest(v_pedidos) p));

  return jsonb_build_object(
    'ok', true,
    'kommo', jsonb_build_object(
      'lido_em', (select e.ultima_leitura_em from public.kommo_estado e where e.id = 1),
      'contatos', cardinality(v_contatos),
      'negocios', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', n.id,
          'nome', n.nome,
          'funil', f.nome,
          'etapa', e.nome,
          'fase', x.fase,
          'aberto', not n.apagado and n.etapa_id not in (142, 143) and coalesce(x.fase, '') not in ('ganho', 'perdido', 'pos_venda'),
          'ganho', n.etapa_id = 142 or x.fase = 'ganho',
          'perdido', n.etapa_id = 143 or x.fase = 'perdido',
          'apagado', n.apagado,
          'etapa_desde', n.etapa_desde,
          'criado_em', n.criado_em,
          'fechado_em', n.fechado_em,
          'esperando_desde', case when coalesce(n.ultima_msg_cliente_em > coalesce(n.ultima_msg_loja_em, '-infinity'::timestamptz), false)
                                  then n.ultima_msg_cliente_em end,
          'responsavel', u.nome,
          'pessoa', case when m.profile_id is not null then public.chat_nome(m.profile_id) end,
          'meu', m.profile_id = v_eu,
          'valor', case when v_ve_valor or m.profile_id = v_eu then n.valor end,
          'pedido_tray', n.pedido_tray,
          'link', 'https://kathleengfz.kommo.com/leads/detail/' || n.id
        ) order by n.criado_em desc nulls last)
        from public.kommo_negocios n
        left join public.kommo_funis f on f.id = n.funil_id
        left join public.kommo_etapas e on e.funil_id = n.funil_id and e.id = n.etapa_id
        left join public.fases_da_kommo x on x.funil_id = n.funil_id and x.etapa_id = n.etapa_id
        left join public.kommo_usuarios u on u.id = n.responsavel_id
        left join public.kommo_mapa m on m.usuario_id = n.responsavel_id
        where n.id = any (v_negocios)
      ), '[]'::jsonb),
      -- Os eventos dos negócios e dos contatos. Mensagem e nota ficam de fora: só dizem
      -- "houve conversa", e encheriam a linha do tempo.
      'eventos', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', k.id,
          'tipo', k.tipo,
          'em', k.criado_em,
          'negocio', case when k.entidade = 'lead' then k.entidade_id end,
          'quem', case when k.autor_id is null then null else coalesce(public.chat_nome(am.profile_id), au.nome) end,
          'robo', k.autor_id is null,
          'etapa_de', (select jsonb_build_object('funil', ff.nome, 'etapa', ee.nome)
                         from public.kommo_etapas ee left join public.kommo_funis ff on ff.id = ee.funil_id
                        where k.tipo = 'lead_status_changed'
                          and ee.id = (k.antes->0->'lead_status'->>'id')::bigint
                          and ee.funil_id = (k.antes->0->'lead_status'->>'pipeline_id')::bigint),
          'etapa_para', (select jsonb_build_object('funil', ff.nome, 'etapa', ee.nome)
                           from public.kommo_etapas ee left join public.kommo_funis ff on ff.id = ee.funil_id
                          where k.tipo = 'lead_status_changed'
                            and ee.id = (k.depois->0->'lead_status'->>'id')::bigint
                            and ee.funil_id = (k.depois->0->'lead_status'->>'pipeline_id')::bigint),
          'responsavel_para', (select coalesce(public.chat_nome(mm.profile_id), uu.nome)
                                 from public.kommo_usuarios uu left join public.kommo_mapa mm on mm.usuario_id = uu.id
                                where k.tipo = 'entity_responsible_changed'
                                  and uu.id = (k.depois->0->'responsible_user'->>'id')::bigint)
        ) order by k.criado_em desc)
        from (
          select ke.*
            from public.kommo_eventos ke
           where ke.tipo in ('lead_added', 'lead_deleted', 'lead_restored', 'lead_status_changed', 'entity_responsible_changed')
             and ((ke.entidade = 'lead' and ke.entidade_id = any (v_negocios))
                  or (ke.entidade = 'contact' and ke.entidade_id = any (v_contatos)))
           order by ke.criado_em desc
           limit 200
        ) k
        left join public.kommo_usuarios au on au.id = k.autor_id
        left join public.kommo_mapa am on am.usuario_id = k.autor_id
      ), '[]'::jsonb)
    ),
    -- Por pedido: o histórico e a origem, cada um pela própria função e com a régua dela.
    'pedidos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'pedido', p.pedido,
        'eventos', coalesce(public.historico_do_pedido(p.pedido)->'eventos', '[]'::jsonb),
        -- `origem_do_pedido` refaz a conta do dia inteiro (perto de meio segundo por pedido):
        -- só os três pedidos PAGOS mais novos, que é onde "qual anúncio vendeu" importa.
        -- Os outros ficam com a chegada que `historico_do_pedido` já traz.
        'origem', case when p.pedido = any (v_com_origem) then public.origem_do_pedido(p.pedido) end
      ) order by p.ordem)
      from unnest(v_pedidos) with ordinality as p(pedido, ordem)
    ), '[]'::jsonb),
    -- A venda por fora sem pedido da loja: fábrica e suporte ligados a ela.
    'vendas', jsonb_build_object(
      'fabrica', coalesce((
        select jsonb_agg(jsonb_build_object('tipo', 'fabrica', 'em', fm.em, 'de', fm.de, 'para', fm.para,
                                            'quem', public.chat_nome(fm.por), 'venda', fm.venda) order by fm.em desc)
        from public.fabrica_movimentos fm where fm.venda = any (v_vendas)
      ), '[]'::jsonb),
      'suporte', coalesce((
        select jsonb_agg(jsonb_build_object('tipo', 'suporte', 'em', sm.em, 'caso', sc.id, 'assunto', sc.assunto, 'de', sm.de,
                                            'para', sm.para, 'nota', sm.nota, 'quem', public.chat_nome(sm.quem)) order by sm.em desc)
        from public.suporte_movimentos sm
        join public.suporte_casos sc on sc.id = sm.caso
        where (sc.pedido is null or not sc.pedido = any (v_pedidos))
          and (sc.venda = any (v_vendas) or (sc.pedido is null and sc.cliente_telefone = v_chave))
      ), '[]'::jsonb)
    )
  );
end
$function$;

revoke all on function public.linha_do_tempo_do_cliente(text) from public, anon;
grant execute on function public.linha_do_tempo_do_cliente(text) to authenticated;
