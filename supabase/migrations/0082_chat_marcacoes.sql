-- 0082: marcações no chat do time.
--
-- O dono do projeto pediu, com o chat no ar: marcar uma pessoa (@pessoa), um
-- setor inteiro (@setor), um pedido da loja (/pedido, clicável e com prévia) e
-- o andamento da meta do mês (/meta).
--
-- COMO A MARCAÇÃO FICA GUARDADA. Dentro do próprio texto da mensagem, num
-- formato que ninguém digita por acaso:
--
--     ⟦p:<id da pessoa>|Nome⟧       uma pessoa
--     ⟦s:<setor>|Nome do setor⟧     um setor inteiro
--     ⟦o:<número>|Pedido <número>⟧  um pedido da loja
--     ⟦m:<mês>;<%>;<situação>|...⟧  a meta do mês, como estava na hora
--
-- QUEM ESCREVE O QUE ESTÁ DENTRO DA MARCAÇÃO É O BANCO, não o navegador. O
-- navegador manda "marquei esta pessoa" e `chat_normalizar` confere e
-- reescreve: o nome vem do cadastro (ninguém marca um colega com o nome de
-- outro), o pedido precisa existir, e a meta é calculada aqui, na hora, só
-- para quem pode ver a meta. Marcação que não confere vira texto comum.
--
-- O QUE CADA UM VÊ. O chat é lido por todos os níveis, inclusive os que não
-- veem faturamento (vendas, fábrica, conteúdo). Por isso:
--   * a marcação da meta leva só o percentual e a situação (batida, no ritmo,
--     atrás), NUNCA valor em reais. Só quem tem a área `vendas` consegue
--     marcar a meta: é a pessoa autorizada que decide contar ao time.
--   * a prévia do pedido é montada para QUEM OLHA: peças, etapa, entrega e
--     cidade para todos; nome do cliente só para quem já vê cliente em outra
--     tela (fábrica, vendas, recuperação); valor só para quem tem a área
--     `vendas`. Preço de peça e custo nunca saem.
--
-- QUEM FOI MARCADO É AVISADO em qualquer sala: entra no número do menu
-- (`chat_resumo`) e no aviso do sistema (`chat_para_avisar`), pela pessoa ou
-- pelo setor a que ela responde.

create table public.chat_marcas (
  id          bigint generated always as identity primary key,
  mensagem_id bigint not null references public.chat_mensagens (id) on delete cascade,
  pessoa      uuid references public.profiles (id) on delete cascade,
  setor       text check (setor in ('vendas', 'fabrica', 'loja', 'trafego', 'diretoria')),
  -- Cada linha marca uma pessoa OU um setor.
  check ((pessoa is null) <> (setor is null))
);

comment on table public.chat_marcas is
  'Quem cada mensagem do chat marcou: uma pessoa ou um setor inteiro. É por aqui que o marcado é avisado. Pedido e meta marcados moram só no texto.';

create unique index chat_marcas_pessoa_idx on public.chat_marcas (mensagem_id, pessoa) where pessoa is not null;
create unique index chat_marcas_setor_idx on public.chat_marcas (mensagem_id, setor) where setor is not null;
create index chat_marcas_de_quem_idx on public.chat_marcas (pessoa) where pessoa is not null;
create index chat_marcas_de_qual_idx on public.chat_marcas (setor) where setor is not null;

alter table public.chat_marcas enable row level security;
revoke all on public.chat_marcas from anon, authenticated;

-- --------------------------------------------------------------- uso interno

/**
 * O texto sem o formato da marcação, do jeito que se lê: "@Nome", "Pedido
 * 123", "Meta de novembro: 25%". É o que vai no trecho citado de uma resposta
 * e no aviso do sistema.
 */
create function public.chat_texto_limpo(p_texto text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(
    regexp_replace(coalesce(p_texto, ''), '⟦[ps]:[^|⟧]*\|([^⟧]*)⟧', '@\1', 'g'),
    '⟦[om]:[^|⟧]*\|([^⟧]*)⟧', '\1', 'g')
$$;

/**
 * O andamento da meta do mês agora: o percentual e a situação, sem valor em
 * reais. É a MESMA conta de `src/lib/painel/meta.ts` (`andamentoDaMeta`) e da
 * Visão geral: o que entrou é a loja (pedido pago) mais a venda por fora, e o
 * ritmo conta o dia de hoje como dia corrido. Mudou lá, muda aqui.
 * `null` quando o mês não tem meta. Uso interno: quem chama confere o acesso.
 */
create function public.chat_meta_agora()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_mes date := date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date;
  v_meta numeric;
  v_feito numeric;
  v_dia integer := extract(day from (now() at time zone 'America/Sao_Paulo'))::integer;
  v_dias integer := extract(day from (date_trunc('month', (now() at time zone 'America/Sao_Paulo')) + interval '1 month - 1 day'))::integer;
  v_nome_do_mes text;
begin
  select m.valor into v_meta from public.metas m where m.mes = v_mes;
  if v_meta is null or v_meta <= 0 then
    return null;
  end if;
  v_feito :=
    coalesce((select sum(t.total) from public.tray_pedidos t where t.dia between v_mes and v_hoje and t.situacao = 'pago'), 0)
    + coalesce((select sum(v.valor) from public.vendas_avulsas v where v.dia between v_mes and v_hoje and v.estornada_em is null), 0);
  v_nome_do_mes := (array['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'])[extract(month from v_mes)::integer];
  return jsonb_build_object(
    'mes', to_char(v_mes, 'YYYY-MM'),
    'nome_do_mes', v_nome_do_mes,
    'pct', least(floor(100 * v_feito / v_meta)::integer, 999),
    'situacao', case
      when v_feito >= v_meta then 'batida'
      when (v_feito / v_dia) * v_dias >= v_meta then 'no_ritmo'
      else 'atras' end
  );
end
$$;

/**
 * Confere e reescreve as marcações de um texto. Devolve o texto pronto para
 * gravar e quem foi marcado. Uso interno de `chat_enviar`.
 *
 * O que não confere vira texto comum: pessoa que não existe ou está inativa,
 * setor desconhecido, pedido que não existe, meta pedida por quem não pode ver
 * a meta (ou mês sem meta).
 */
create function public.chat_normalizar(p_texto text, out texto text, out pessoas uuid[], out setores text[])
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  m text[];
  v_novo text;
  v_nome text;
  v_meta jsonb;
  v_meta_lida boolean := false;
  v_quantas integer := 0;
begin
  texto := p_texto;
  pessoas := '{}';
  setores := '{}';
  for m in select regexp_matches(p_texto, '(⟦([psom]):([^|⟧]*)\|([^⟧]*)⟧)', 'g') loop
    v_quantas := v_quantas + 1;
    v_novo := null;
    -- Mensagem com marcação demais é abuso ou engano: da trigésima em diante vira texto.
    if v_quantas <= 30 then
      if m[2] = 'p' then
        select coalesce(nullif(btrim(pr.full_name), ''), split_part(pr.email, '@', 1))
          into v_nome
          from public.profiles pr
         where pr.is_active and pr.id::text = lower(m[3]);
        if found then
          v_novo := '⟦p:' || lower(m[3]) || '|' || replace(replace(v_nome, '⟧', ''), '|', ' ') || '⟧';
          if not (lower(m[3])::uuid = any (pessoas)) then
            pessoas := pessoas || lower(m[3])::uuid;
          end if;
        end if;
      elsif m[2] = 's' then
        if m[3] in ('vendas', 'fabrica', 'loja', 'trafego', 'diretoria') then
          v_novo := '⟦s:' || m[3] || '|' || case m[3]
            when 'vendas' then 'Vendas' when 'fabrica' then 'Fábrica' when 'loja' then 'Loja'
            when 'trafego' then 'Tráfego' else 'Diretoria' end || '⟧';
          if not (m[3] = any (setores)) then
            setores := setores || m[3];
          end if;
        end if;
      elsif m[2] = 'o' then
        if m[3] ~ '^[0-9]{1,12}$' and exists (select 1 from public.tray_pedidos t where t.pedido = m[3]::bigint) then
          v_novo := '⟦o:' || m[3] || '|Pedido ' || m[3] || '⟧';
        end if;
      else
        -- A meta: calculada aqui, uma vez por mensagem, e só para quem pode ver a meta.
        if not v_meta_lida then
          v_meta_lida := true;
          if coalesce(public.tem_acesso('vendas'), false) then
            v_meta := public.chat_meta_agora();
          end if;
        end if;
        if v_meta is not null then
          v_novo := '⟦m:' || (v_meta->>'mes') || ';' || (v_meta->>'pct') || ';' || (v_meta->>'situacao')
            || '|Meta de ' || (v_meta->>'nome_do_mes') || ': ' || (v_meta->>'pct') || '%⟧';
        end if;
      end if;
    end if;
    -- Não conferiu: fica o que a pessoa via escrito, sem o formato.
    if v_novo is null then
      v_novo := case when m[2] in ('p', 's') then '@' else '' end || replace(replace(m[4], '⟦', ''), '⟧', '');
    end if;
    texto := replace(texto, m[1], v_novo);
  end loop;
end
$$;

-- ------------------------------------------------------------------ o pedido

/** Em que etapa da fábrica está um pedido da loja. É a mesma regra de `fila_da_fabrica` (0075). `null` para pedido que não foi pago. */
create function public.chat_etapa_do_pedido(p_situacao text, p_status text, p_etapa text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_situacao is distinct from 'pago' then null
    when p_etapa = 'enviado' or upper(coalesce(p_status, '')) in ('ENVIADO', 'FINALIZADO', 'PROBLEMAS NA ENTREGA') then 'enviado'
    else coalesce(p_etapa, 'a_produzir') end
$$;

/**
 * A busca do "/pedido": pelo número, para todo mundo; pelo nome do cliente,
 * só para quem já vê cliente em outra tela (fábrica, vendas, recuperação).
 * Sem busca, os pedidos mais recentes. Não devolve valor.
 */
create function public.chat_buscar_pedidos(p_busca text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_busca text := btrim(coalesce(p_busca, ''));
  v_ve_cliente boolean;
begin
  if not coalesce(public.tem_acesso('time'), false) then
    return '[]'::jsonb;
  end if;
  v_ve_cliente := coalesce(public.tem_acesso('fabrica') or public.tem_acesso('lancar_venda') or public.tem_acesso('vendas') or public.tem_acesso('recuperacao'), false);
  return coalesce((
    select jsonb_agg(x.j order by x.pedido desc)
    from (
      select t.pedido, jsonb_build_object(
        'numero', t.pedido,
        'dia', t.dia,
        'situacao', t.situacao,
        'etapa', public.chat_etapa_do_pedido(t.situacao, t.status, f.etapa),
        'cliente', case when v_ve_cliente then t.cliente_nome end,
        'peca', (select i->>'nome' from jsonb_array_elements(case when jsonb_typeof(t.itens) = 'array' then t.itens else '[]'::jsonb end) i limit 1),
        'pecas', case when jsonb_typeof(t.itens) = 'array' then jsonb_array_length(t.itens) else 0 end
      ) as j
      from public.tray_pedidos t
      left join public.fabrica_pedidos f on f.pedido = t.pedido
      where case
        when v_busca = '' then true
        when v_busca ~ '^#?[0-9]{1,12}$' then t.pedido::text like ltrim(v_busca, '#') || '%'
        when v_ve_cliente and char_length(v_busca) >= 2
          -- A forma com o dicionário por extenso: com o caminho de busca vazio, a forma curta não acha o dicionário.
          then extensions.unaccent('extensions.unaccent'::regdictionary, lower(coalesce(t.cliente_nome, '')))
               like '%' || extensions.unaccent('extensions.unaccent'::regdictionary, lower(replace(replace(v_busca, '%', ''), '_', ''))) || '%'
        else false end
      order by t.pedido desc
      limit 8
    ) x), '[]'::jsonb);
end
$$;

/**
 * A prévia de um pedido marcado no chat, montada para QUEM OLHA. Peças (sem
 * preço), etapa, entrega e cidade para todos; nome do cliente e valor só para
 * quem tem o acesso (ver o topo do arquivo). `pode` diz para onde o clique
 * leva: a fila da fábrica ou a ficha do cliente.
 */
create function public.chat_previa_do_pedido(p_numero bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ve_cliente boolean;
  v_ve_valor boolean;
begin
  if not coalesce(public.tem_acesso('time'), false) then
    return null;
  end if;
  v_ve_cliente := coalesce(public.tem_acesso('fabrica') or public.tem_acesso('lancar_venda') or public.tem_acesso('vendas') or public.tem_acesso('recuperacao'), false);
  v_ve_valor := coalesce(public.tem_acesso('vendas'), false);
  return (
    select jsonb_build_object(
      'numero', t.pedido,
      'dia', t.dia,
      'situacao', t.situacao,
      'status_da_loja', t.status,
      'etapa', public.chat_etapa_do_pedido(t.situacao, t.status, f.etapa),
      'entrega', t.frete_tipo,
      'cidade', t.cidade,
      'uf', t.uf,
      'rastreio', coalesce(nullif(btrim(f.rastreio), ''), nullif(btrim(t.envio_codigo), '')),
      'cliente', case when v_ve_cliente then t.cliente_nome end,
      'total', case when v_ve_valor then t.total end,
      'pecas', coalesce((
        select jsonb_agg(jsonb_build_object(
          'nome', i->>'nome',
          'quantidade', i->>'quantidade',
          'foto', (select pr.main_image_url from public.products pr where pr.tray_id = i->>'produto_tray_id')))
        from jsonb_array_elements(case when jsonb_typeof(t.itens) = 'array' then t.itens else '[]'::jsonb end) i), '[]'::jsonb),
      'pode', jsonb_build_object(
        'fabrica', coalesce(public.tem_acesso('fabrica'), false),
        'ficha', coalesce(public.tem_acesso('lancar_venda'), false))
    )
    from public.tray_pedidos t
    left join public.fabrica_pedidos f on f.pedido = t.pedido
    where t.pedido = p_numero
  );
end
$$;

-- ------------------------------------------------------ as funções que mudam

-- A mensagem citada em cima de uma resposta mostra o texto limpo, sem o formato da marcação.
create or replace function public.chat_mensagem_json(m public.chat_mensagens)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', m.id,
    'sala', m.sala,
    'autor', m.autor,
    'autor_nome', public.chat_nome(m.autor),
    'autor_papel', (select p.role::text from public.profiles p where p.id = m.autor),
    'texto', case when m.apagada_em is null then m.texto else '' end,
    'apagada', m.apagada_em is not null,
    'responde_a', (
      select jsonb_build_object(
        'id', o.id,
        'autor', o.autor,
        'autor_nome', public.chat_nome(o.autor),
        'trecho', case when o.apagada_em is null then left(public.chat_texto_limpo(o.texto), 140) else '' end,
        'apagada', o.apagada_em is not null,
        'imagens', case when o.apagada_em is null then (select count(*) from public.chat_anexos a where a.mensagem_id = o.id) else 0 end)
      from public.chat_mensagens o
      where o.id = m.responde_a),
    'pede', m.pede_resposta,
    'esperando_desde', m.esperando_desde,
    'atendida_em', m.atendida_em,
    'atendida_por_nome', public.chat_nome(m.atendida_por),
    'respostas', (
      select count(*) from public.chat_mensagens r
      where r.responde_a = m.id and r.apagada_em is null and r.autor is distinct from m.autor),
    'na_biblioteca', (select b.id from public.biblioteca_respostas b where b.mensagem_id = m.id),
    'em', m.criada_em,
    'mudou', m.atualizada_em,
    'anexos', case when m.apagada_em is null
      then coalesce((select jsonb_agg(a.id order by a.criado_em, a.id) from public.chat_anexos a where a.mensagem_id = m.id), '[]'::jsonb)
      else '[]'::jsonb end
  )
$$;

/**
 * Manda uma mensagem. Agora confere e reescreve as marcações do texto e guarda
 * quem foi marcado. O resto é igual à 0079: responder ao pedido de OUTRA
 * pessoa marca o pedido como atendido, e erro de imagem desfaz a mensagem.
 */
create or replace function public.chat_enviar(
  p_sala text,
  p_texto text,
  p_responde_a bigint default null,
  p_pede boolean default false,
  p_anexos jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quem uuid := (select auth.uid());
  v_texto text := btrim(coalesce(p_texto, ''));
  v_pede boolean := coalesce(p_pede, false);
  v_tem_imagem boolean := p_anexos is not null and jsonb_typeof(p_anexos) = 'array' and jsonb_array_length(p_anexos) > 0;
  v_id bigint;
  v_erro text;
  v_pessoas uuid[];
  v_setores text[];
  o public.chat_mensagens%rowtype;
  m public.chat_mensagens%rowtype;
begin
  if not coalesce(public.tem_acesso('time'), false) then
    return jsonb_build_object('ok', false, 'erro', 'Seu acesso não inclui o chat do time.');
  end if;
  if p_sala is null or p_sala not in ('geral', 'vendas', 'fabrica', 'loja', 'trafego', 'diretoria') then
    return jsonb_build_object('ok', false, 'erro', 'Sala desconhecida.');
  end if;
  if v_texto = '' and not v_tem_imagem then
    return jsonb_build_object('ok', false, 'erro', 'Escreva a mensagem ou mande uma imagem.');
  end if;
  if char_length(v_texto) > 4000 then
    return jsonb_build_object('ok', false, 'erro', 'A mensagem passou de 4.000 letras.');
  end if;
  if (select count(*) from public.chat_mensagens c where c.autor = v_quem and c.criada_em > now() - interval '1 minute') >= 30 then
    return jsonb_build_object('ok', false, 'erro', 'Muitas mensagens em um minuto. Espere um pouco e mande de novo.');
  end if;
  if p_responde_a is not null then
    select * into o from public.chat_mensagens where id = p_responde_a for update;
    if not found or o.sala <> p_sala or o.apagada_em is not null then
      return jsonb_build_object('ok', false, 'erro', 'A mensagem que você ia responder não está mais nesta sala.');
    end if;
  end if;

  -- As marcações: conferidas e reescritas pelo banco. O texto pode crescer um pouco (o nome entra no lugar do apelido).
  select n.texto, n.pessoas, n.setores into v_texto, v_pessoas, v_setores from public.chat_normalizar(v_texto) n;
  if char_length(v_texto) > 4000 then
    return jsonb_build_object('ok', false, 'erro', 'A mensagem passou de 4.000 letras.');
  end if;
  if btrim(v_texto) = '' and not v_tem_imagem then
    return jsonb_build_object('ok', false, 'erro', 'Escreva a mensagem ou mande uma imagem.');
  end if;

  insert into public.chat_mensagens (sala, autor, texto, responde_a, pede_resposta, esperando_desde)
  values (p_sala, v_quem, v_texto, p_responde_a, v_pede, case when v_pede then now() end)
  returning id into v_id;

  insert into public.chat_marcas (mensagem_id, pessoa) select v_id, p from unnest(v_pessoas) p;
  insert into public.chat_marcas (mensagem_id, setor) select v_id, s from unnest(v_setores) s;

  v_erro := public.chat_prender_anexos(v_id, p_anexos, v_quem);
  if v_erro is not null then
    raise exception '%', v_erro using errcode = 'P0001';
  end if;

  if p_responde_a is not null then
    -- Toca na mensagem respondida mesmo sem mudar o estado: a contagem de respostas dela mudou.
    update public.chat_mensagens set
      atendida_em = case when pede_resposta and atendida_em is null and autor is distinct from v_quem then now() else atendida_em end,
      atendida_por = case when pede_resposta and atendida_em is null and autor is distinct from v_quem then v_quem else atendida_por end,
      atualizada_em = now()
    where id = p_responde_a;
  end if;

  -- Quem escreve na sala leu a sala.
  insert into public.chat_leituras (pessoa, sala, lida_ate) values (v_quem, p_sala, v_id)
  on conflict (pessoa, sala) do update
    set lida_ate = greatest(public.chat_leituras.lida_ate, excluded.lida_ate), atualizada_em = now();

  select * into m from public.chat_mensagens where id = v_id;
  return jsonb_build_object('ok', true, 'mensagem', public.chat_mensagem_json(m));
end
$$;

/**
 * O número do menu. Igual à 0079, mais uma coisa: mensagem que MARCA a pessoa,
 * ou o setor a que ela responde, conta em qualquer sala.
 */
create or replace function public.chat_resumo()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_quem uuid := (select auth.uid());
  v_setores text[];
begin
  if not coalesce(public.tem_acesso('time'), false) then
    return jsonb_build_object('novas', 0, 'pedidos', 0, 'pedidos_do_setor', 0, 'desde', null);
  end if;
  v_setores := public.meus_setores();
  return (
    with salas as (
      select s.sala,
             coalesce(l.lida_ate, 0) as lida_ate,
             (s.sala = 'geral' or s.sala = any (v_setores)) as minha,
             s.sala = any (v_setores) as do_setor
      from unnest(array['geral', 'vendas', 'fabrica', 'loja', 'trafego', 'diretoria']) as s (sala)
      left join public.chat_leituras l on l.pessoa = v_quem and l.sala = s.sala
    ),
    esperando as (
      select c.id, c.esperando_desde, c.id <= s.lida_ate as lido
      from public.chat_mensagens c
      join salas s on s.sala = c.sala and s.do_setor
      where c.pede_resposta and c.atendida_em is null and c.apagada_em is null
        and c.autor is distinct from v_quem
    )
    select jsonb_build_object(
      'novas', (
        select count(*)
        from salas s
        join public.chat_mensagens c on c.sala = s.sala and c.id > s.lida_ate
        where c.apagada_em is null
          and c.autor is distinct from v_quem
          and c.criada_em > now() - interval '7 days'
          and (s.minha
               or exists (select 1 from public.chat_mensagens o where o.id = c.responde_a and o.autor = v_quem)
               or exists (select 1 from public.chat_marcas k where k.mensagem_id = c.id and (k.pessoa = v_quem or k.setor = any (v_setores))))),
      'pedidos', (select count(*) from esperando e where e.lido),
      'pedidos_do_setor', (select count(*) from esperando),
      'desde', (select min(e.esperando_desde) from esperando e)
    )
  );
end
$$;

/**
 * O que avisar a cada pessoa. Igual à 0081, mais a marcação: mensagem que
 * marca a pessoa ou o setor dela avisa em qualquer sala, e o aviso diz isso
 * (`marcou`: "voce", ou o setor marcado). O trecho sai sem o formato.
 */
create or replace function public.chat_para_avisar(p_desde timestamptz default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_quem uuid := (select auth.uid());
  v_setores text[];
  v_desde timestamptz := greatest(coalesce(p_desde, now()) - interval '10 seconds', now() - interval '1 hour');
begin
  if not coalesce(public.tem_acesso('time'), false) then
    return jsonb_build_object('agora', now(), 'mensagens', '[]'::jsonb);
  end if;
  v_setores := public.meus_setores();
  return jsonb_build_object(
    'agora', now(),
    'mensagens', coalesce((
      select jsonb_agg(x.j order by x.id)
      from (
        select c.id, jsonb_build_object(
          'id', c.id,
          'sala', c.sala,
          'autor_nome', public.chat_nome(c.autor),
          'trecho', left(btrim(regexp_replace(public.chat_texto_limpo(c.texto), '\s+', ' ', 'g')), 140),
          'imagens', (select count(*) from public.chat_anexos a where a.mensagem_id = c.id),
          'pede', c.pede_resposta,
          'para_mim', exists (select 1 from public.chat_mensagens o where o.id = c.responde_a and o.autor = v_quem),
          'marcou', coalesce(
            (select 'voce' from public.chat_marcas k where k.mensagem_id = c.id and k.pessoa = v_quem limit 1),
            (select k.setor from public.chat_marcas k where k.mensagem_id = c.id and k.setor = any (v_setores) order by k.setor limit 1)),
          'em', c.criada_em) as j
        from public.chat_mensagens c
        left join public.chat_leituras l on l.pessoa = v_quem and l.sala = c.sala
        where c.criada_em > v_desde
          and c.apagada_em is null
          and c.autor is distinct from v_quem
          and c.id > coalesce(l.lida_ate, 0)
          and (c.sala = 'geral'
               or c.sala = any (v_setores)
               or exists (select 1 from public.chat_mensagens o where o.id = c.responde_a and o.autor = v_quem)
               or exists (select 1 from public.chat_marcas k where k.mensagem_id = c.id and (k.pessoa = v_quem or k.setor = any (v_setores))))
        order by c.id desc
        limit 8
      ) x), '[]'::jsonb)
  );
end
$$;

-- ---------------------------------------------------------------- permissões

revoke execute on function public.chat_texto_limpo(text) from public, anon, authenticated;
revoke execute on function public.chat_meta_agora() from public, anon, authenticated;
revoke execute on function public.chat_normalizar(text) from public, anon, authenticated;
revoke execute on function public.chat_etapa_do_pedido(text, text, text) from public, anon, authenticated;

revoke execute on function public.chat_buscar_pedidos(text) from public, anon;
revoke execute on function public.chat_previa_do_pedido(bigint) from public, anon;
grant execute on function public.chat_buscar_pedidos(text) to authenticated;
grant execute on function public.chat_previa_do_pedido(bigint) to authenticated;
