-- Kommo, fase 5 (cartão 49): o painel avisa a Kommo.
--
-- É a primeira vez que o painel ESCREVE na Kommo, e criar ou mover negócio pode
-- disparar o Salesbot da etapa e mandar WhatsApp para cliente de verdade. Por
-- isso tudo aqui segue a regra das automações das redes (0086):
--
--   - são quatro automações fixas e todas nascem DESLIGADAS;
--   - funil e etapa são escolhidos pela diretoria na tela, nunca no código;
--   - ligar é só de administrador, dono e GM, e fica gravado quem ligou, que
--     passa a ser o AUTOR de cada escrita (sem autor ativo, nada é gravado);
--   - salvar a configuração de uma ligada DESLIGA: o que foi aprovado era a
--     configuração anterior;
--   - só vale evento acontecido DEPOIS de ligar (ligar não dispara o passado);
--   - uma escrita por evento (a chave única de `kommo_escritas`), e a que
--     falhou não é tentada de novo sozinha;
--   - teto por hora, conferido com a linha da automação travada.
--
-- Quem escreve na Kommo é `src/lib/kommo/escrever.ts`, o único caminho, no
-- molde de `src/lib/loja/alterar.ts`: reserva aqui, lê na Kommo, confere,
-- grava, lê de novo e termina aqui com o antes, o pedido, o depois e a
-- resposta, inclusive a recusa. Nada aqui chama a Kommo, e nada grava nas
-- tabelas `kommo_*` do espelho.
--
-- As quatro:
--   recuperacao  pedido criado e não pago (a regra da fila de recuperação)
--                cria negócio no funil escolhido (o ECOMM | RECUPERAÇÃO);
--   pos_venda    pedido pago, enviado e entregue move o negócio do cliente
--                para a etapa escolhida de cada marco, só para a frente, e só
--                negócio que já existe;
--   sac          caso passado para o suporte cria negócio no funil escolhido
--                (o ECOMM | SAC), sem trocar responsável de outro funil;
--   tarefas      oportunidade da ficha do cliente vira tarefa para o
--                responsável do negócio aberto do cliente; sem negócio, nada.

-- ---------------------------------------------------------------------------
-- As automações
-- ---------------------------------------------------------------------------
create table if not exists public.kommo_automacoes (
  id               text primary key check (id in ('recuperacao', 'pos_venda', 'sac', 'tarefas')),
  ativa            boolean not null default false,
  funil_id         bigint,
  etapa_id         bigint,
  -- pos_venda: {"pago": etapa, "enviado": etapa, "entregue": etapa}, todas do funil_id.
  etapas           jsonb not null default '{}'::jsonb,
  -- Dono do negócio criado (recuperacao, sac). Nulo: a Kommo decide (o usuário da chave).
  responsavel_id   bigint,
  espera_min       integer not null default 60 check (espera_min between 0 and 1440),
  limite_por_hora  integer not null default 10 check (limite_por_hora between 1 and 60),
  ativada_por      uuid references public.profiles (id) on delete set null,
  ativada_em       timestamptz,
  editada_por      uuid references public.profiles (id) on delete set null,
  editada_em       timestamptz,
  constraint kommo_automacoes_ligada_tem_autor check (not ativa or (ativada_por is not null and ativada_em is not null))
);

insert into public.kommo_automacoes (id, espera_min) values
  ('recuperacao', 60), ('pos_venda', 0), ('sac', 0), ('tarefas', 0)
on conflict (id) do nothing;

alter table public.kommo_automacoes enable row level security;
revoke all on public.kommo_automacoes from anon, authenticated;

-- ---------------------------------------------------------------------------
-- O registro de cada escrita
-- ---------------------------------------------------------------------------
create table if not exists public.kommo_escritas (
  id            bigserial primary key,
  -- Um evento, uma escrita: 'recuperacao:pedido:11735', 'pos_venda:11735:enviado',
  -- 'sac:caso:12', 'tarefa:p11735:aniversario:2026-12-03'.
  chave         text not null unique,
  automacao     text not null references public.kommo_automacoes (id),
  acao          text not null check (acao in ('criar_negocio', 'mover_negocio', 'criar_tarefa')),
  -- enviando: reservada, a Kommo ainda não respondeu (se ficar assim, a rodada morreu no meio);
  -- desistiu: o painel leu a Kommo e não gravou (o negócio mudou, já existia, fechou).
  estado        text not null default 'enviando' check (estado in ('enviando', 'ok', 'recusada', 'erro', 'desistiu')),
  feita_por     uuid not null references public.profiles (id),
  cliente       text,
  referencia    text,
  rotulo        text,
  negocio_id    bigint,
  antes         jsonb,
  pedido        jsonb,
  depois        jsonb,
  http          integer,
  erro          text,
  criado_em     timestamptz not null default now(),
  terminado_em  timestamptz
);

create index if not exists kommo_escritas_automacao_idx on public.kommo_escritas (automacao, criado_em desc);
create index if not exists kommo_escritas_cliente_idx on public.kommo_escritas (automacao, cliente, criado_em desc) where cliente is not null;
create index if not exists kommo_escritas_criado_idx on public.kommo_escritas (criado_em desc);
create index if not exists kommo_escritas_feita_por_idx on public.kommo_escritas (feita_por);

alter table public.kommo_escritas enable row level security;
revoke all on public.kommo_escritas from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Conferência da configuração (a trava; a tela tem a mesma conta em
-- `conferirConfig`, `src/lib/kommo/automacoes-regra.ts`, só para a mensagem).
-- Devolve o problema em código, ou null.
-- ---------------------------------------------------------------------------
create or replace function public.kommo_automacao_problema(p_id text, p_funil bigint, p_etapa bigint, p_etapas jsonb, p_responsavel bigint)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_marco text;
  v_etapa bigint;
  v_ordem integer;
  v_ultima integer := -1;
begin
  if p_responsavel is not null and not exists (select 1 from public.kommo_usuarios u where u.id = p_responsavel and u.ativo) then
    return 'responsavel';
  end if;
  if p_id = 'tarefas' then
    -- Funil opcional: com ele, a tarefa só vai para negócio aberto naquele funil.
    if p_funil is not null and not exists (select 1 from public.kommo_funis f where f.id = p_funil and not f.arquivado) then
      return 'funil';
    end if;
    return null;
  end if;
  if p_funil is null or not exists (select 1 from public.kommo_funis f where f.id = p_funil and not f.arquivado) then
    return 'funil';
  end if;
  if p_id in ('recuperacao', 'sac') then
    if p_etapa is null or not exists (
      select 1 from public.kommo_etapas e where e.funil_id = p_funil and e.id = p_etapa and e.tipo in ('entrada', 'aberta')
    ) then
      return 'etapa';
    end if;
    return null;
  end if;
  -- pos_venda: pelo menos um marco, cada um numa etapa aberta do funil, na ordem pago, enviado, entregue.
  if p_etapas is null or jsonb_typeof(p_etapas) <> 'object' or not (p_etapas ?| array['pago', 'enviado', 'entregue']) then
    return 'etapas';
  end if;
  foreach v_marco in array array['pago', 'enviado', 'entregue'] loop
    continue when not (p_etapas ? v_marco) or jsonb_typeof(p_etapas -> v_marco) = 'null';
    if jsonb_typeof(p_etapas -> v_marco) <> 'number' then return 'etapas'; end if;
    v_etapa := (p_etapas ->> v_marco)::bigint;
    select e.ordem into v_ordem from public.kommo_etapas e where e.funil_id = p_funil and e.id = v_etapa and e.tipo in ('entrada', 'aberta');
    if v_ordem is null then return 'etapas'; end if;
    if v_ordem <= v_ultima then return 'ordem'; end if;
    v_ultima := v_ordem;
  end loop;
  if v_ultima < 0 then return 'etapas'; end if;
  return null;
end
$$;

-- ---------------------------------------------------------------------------
-- A tela (só diretoria)
-- ---------------------------------------------------------------------------
create or replace function public.kommo_automacoes_lista()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when not coalesce(public.is_admin(), false) then null else jsonb_build_object(
    'tem_chave', exists (select 1 from public.integration_tokens t where t.provider = 'kommo'),
    'automacoes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id,
        'ativa', a.ativa,
        'funil_id', a.funil_id,
        'etapa_id', a.etapa_id,
        'etapas', a.etapas,
        'responsavel_id', a.responsavel_id,
        'espera_min', a.espera_min,
        'limite_por_hora', a.limite_por_hora,
        'ativada_em', a.ativada_em,
        'ativada_por', (select coalesce(nullif(p.full_name, ''), split_part(p.email, '@', 1)) from public.profiles p where p.id = a.ativada_por),
        'editada_em', a.editada_em,
        'editada_por', (select coalesce(nullif(p.full_name, ''), split_part(p.email, '@', 1)) from public.profiles p where p.id = a.editada_por),
        'problema', public.kommo_automacao_problema(a.id, a.funil_id, a.etapa_id, a.etapas, a.responsavel_id),
        'feitas_30d', (select count(*) from public.kommo_escritas e where e.automacao = a.id and e.estado = 'ok' and e.criado_em > now() - interval '30 days'),
        'falhas_30d', (select count(*) from public.kommo_escritas e where e.automacao = a.id and e.estado in ('recusada', 'erro', 'enviando') and e.criado_em > now() - interval '30 days')
      ) order by array_position(array['recuperacao', 'pos_venda', 'sac', 'tarefas'], a.id))
      from public.kommo_automacoes a
    ), '[]'::jsonb),
    'funis', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', f.id,
        'nome', f.nome,
        'etapas', coalesce((
          select jsonb_agg(jsonb_build_object('id', e.id, 'nome', e.nome, 'ordem', e.ordem, 'tipo', e.tipo) order by e.ordem, e.id)
          from public.kommo_etapas e where e.funil_id = f.id
        ), '[]'::jsonb)
      ) order by f.ordem, f.id)
      from public.kommo_funis f where not f.arquivado
    ), '[]'::jsonb),
    'usuarios', coalesce((
      select jsonb_agg(jsonb_build_object('id', u.id, 'nome', u.nome) order by u.nome)
      from public.kommo_usuarios u where u.ativo
    ), '[]'::jsonb),
    'escritas', coalesce((
      select jsonb_agg(x order by (x ->> 'id')::bigint desc)
      from (
        select jsonb_build_object(
          'id', e.id,
          'automacao', e.automacao,
          'acao', e.acao,
          'estado', e.estado,
          'referencia', e.referencia,
          'rotulo', e.rotulo,
          'negocio_id', e.negocio_id,
          'http', e.http,
          'erro', e.erro,
          'antes', e.antes,
          'depois', e.depois,
          'criado_em', e.criado_em,
          'terminado_em', e.terminado_em,
          'feita_por', (select coalesce(nullif(p.full_name, ''), split_part(p.email, '@', 1)) from public.profiles p where p.id = e.feita_por)
        ) as x
        from public.kommo_escritas e
        order by e.id desc
        limit 150
      ) t
    ), '[]'::jsonb)
  ) end;
$$;

create or replace function public.kommo_automacao_salvar(p_id text, p_config jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu uuid := auth.uid();
  v_era boolean;
  v_funil bigint;
  v_etapa bigint;
  v_etapas jsonb;
  v_resp bigint;
  v_espera integer;
  v_limite integer;
  v_problema text;
begin
  if not coalesce(public.is_admin(), false) or v_eu is null then
    return jsonb_build_object('ok', false, 'erro', 'sem_acesso');
  end if;
  select a.ativa into v_era from public.kommo_automacoes a where a.id = p_id for update;
  if not found then return jsonb_build_object('ok', false, 'erro', 'nao_encontrada'); end if;

  begin
    v_funil := nullif(p_config ->> 'funil_id', '')::bigint;
    v_etapa := nullif(p_config ->> 'etapa_id', '')::bigint;
    v_resp := nullif(p_config ->> 'responsavel_id', '')::bigint;
    v_espera := coalesce(nullif(p_config ->> 'espera_min', '')::integer, 0);
    v_limite := coalesce(nullif(p_config ->> 'limite_por_hora', '')::integer, 10);
  exception when others then
    return jsonb_build_object('ok', false, 'erro', 'dados');
  end;
  v_etapas := case when p_id = 'pos_venda' then coalesce(p_config -> 'etapas', '{}'::jsonb) else '{}'::jsonb end;
  if p_id <> 'recuperacao' and p_id <> 'sac' then v_etapa := null; end if;
  if p_id not in ('recuperacao', 'sac') then v_resp := null; end if;
  if v_espera < 0 or v_espera > 1440 then return jsonb_build_object('ok', false, 'erro', 'espera'); end if;
  if v_limite < 1 or v_limite > 60 then return jsonb_build_object('ok', false, 'erro', 'limite'); end if;

  v_problema := public.kommo_automacao_problema(p_id, v_funil, v_etapa, v_etapas, v_resp);
  -- Salva mesmo incompleta (para a diretoria montar aos poucos); só não liga.
  update public.kommo_automacoes a
  set funil_id = v_funil, etapa_id = v_etapa, etapas = v_etapas, responsavel_id = v_resp,
      espera_min = v_espera, limite_por_hora = v_limite,
      ativa = false, ativada_por = null, ativada_em = null,
      editada_por = v_eu, editada_em = now()
  where a.id = p_id;
  return jsonb_build_object('ok', true, 'desligou', coalesce(v_era, false), 'problema', v_problema);
end
$$;

create or replace function public.kommo_automacao_ligar(p_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu uuid := auth.uid();
  v_a public.kommo_automacoes;
  v_problema text;
begin
  if not coalesce(public.is_admin(), false) or v_eu is null then
    return jsonb_build_object('ok', false, 'erro', 'sem_acesso');
  end if;
  select * into v_a from public.kommo_automacoes a where a.id = p_id for update;
  if not found then return jsonb_build_object('ok', false, 'erro', 'nao_encontrada'); end if;
  if not exists (select 1 from public.integration_tokens t where t.provider = 'kommo') then
    return jsonb_build_object('ok', false, 'erro', 'sem_chave');
  end if;
  v_problema := public.kommo_automacao_problema(v_a.id, v_a.funil_id, v_a.etapa_id, v_a.etapas, v_a.responsavel_id);
  if v_problema is not null then return jsonb_build_object('ok', false, 'erro', v_problema); end if;
  update public.kommo_automacoes a set ativa = true, ativada_por = v_eu, ativada_em = now() where a.id = p_id;
  return jsonb_build_object('ok', true);
end
$$;

-- Desligar nunca deve esperar: a diretoria desliga, e a rodada também desliga
-- sozinha quando o autor perde o acesso (ver `kommo_escrita_reservar`).
create or replace function public.kommo_automacao_desligar(p_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not coalesce(public.is_admin(), false) then
    return jsonb_build_object('ok', false, 'erro', 'sem_acesso');
  end if;
  update public.kommo_automacoes a set ativa = false where a.id = p_id;
  if not found then return jsonb_build_object('ok', false, 'erro', 'nao_encontrada'); end if;
  return jsonb_build_object('ok', true);
end
$$;

-- ---------------------------------------------------------------------------
-- A rodada (só a chave de serviço)
-- ---------------------------------------------------------------------------

-- O negócio ABERTO mais recente do cliente, pelo telefone (formato do painel)
-- ou pelo e-mail, opcionalmente só num funil. Lê o espelho; quem escreve
-- confere de novo na Kommo antes de gravar.
create or replace function public.kommo_avisos_negocio_do_cliente(p_telefone text, p_email text, p_funil bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('id', n.id, 'funil_id', n.funil_id, 'etapa_id', n.etapa_id, 'responsavel_id', n.responsavel_id,
                            'ordem', (select e.ordem from public.kommo_etapas e where e.funil_id = n.funil_id and e.id = n.etapa_id))
  from public.kommo_negocios n
  where not n.apagado and n.etapa_id not in (142, 143)
    and (p_funil is null or n.funil_id = p_funil)
    and (p_telefone is not null or p_email is not null)
    and exists (
      select 1 from public.kommo_contatos k
      where not k.apagado
        and (k.id = n.contato_id or k.id = any (coalesce(n.contatos, '{}'::bigint[])))
        and ((p_telefone is not null and (k.telefone = p_telefone or p_telefone = any (coalesce(k.telefones, '{}'::text[]))))
          or (p_email is not null and lower(k.email) = lower(p_email)))
    )
  order by n.atualizado_na_kommo desc nulls last, n.id desc
  limit 1;
$$;

create or replace function public.kommo_avisos_candidatos()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with ativas as (select * from public.kommo_automacoes a where a.ativa),
  rec as (select * from ativas where id = 'recuperacao'),
  pos as (select * from ativas where id = 'pos_venda'),
  sac as (select * from ativas where id = 'sac'),
  -- A regra da fila de recuperação (0058): pedido cancelado ou esperando
  -- pagamento, por cliente, sem pedido pago desde duas horas antes da primeira
  -- tentativa, sem caso pago por fora ou descartado, sem venda por fora.
  janela as (
    select p.*, coalesce(p.cliente_telefone, p.cliente_email, p.cliente_codigo) as cliente
    from public.tray_pedidos p
    where exists (select 1 from rec)
      and p.dia > (now() at time zone 'America/Sao_Paulo')::date - 14
  ),
  por_cliente as (
    select cliente, min(feito_em) as primeira, max(feito_em) as ultima, count(*) as tentativas, max(total) as maior_valor,
           (array_agg(pedido order by feito_em desc))[1] as pedido_ref, max(cliente_telefone) as telefone, array_agg(pedido) as pedidos
    from janela
    where situacao in ('cancelado', 'aguardando') and cliente is not null
    group by cliente
  ),
  recuperacao as (
    select jsonb_build_object(
      'cliente', c.cliente,
      'pedido', c.pedido_ref,
      'tentativas', c.tentativas,
      'valor', c.maior_valor,
      'primeira', c.primeira,
      'nome', r.cliente_nome,
      'telefone', r.cliente_telefone,
      'email', r.cliente_email,
      'aguardando', r.situacao = 'aguardando',
      'itens', (select string_agg(i.nome, ' + ') from jsonb_to_recordset(coalesce(r.itens, '[]'::jsonb)) as i(nome text, preco numeric) where coalesce(i.preco, 0) > 0)
    ) as x
    from por_cliente c
    join public.tray_pedidos r on r.pedido = c.pedido_ref
    cross join rec
    where c.primeira >= rec.ativada_em
      and c.ultima <= now() - make_interval(mins => rec.espera_min)
      and not exists (
        select 1 from public.tray_pedidos q
        where coalesce(q.cliente_telefone, q.cliente_email, q.cliente_codigo) = c.cliente
          and q.situacao = 'pago' and q.feito_em >= c.primeira - interval '2 hours'
      )
      and not exists (
        select 1 from public.recuperacao_casos s
        where s.pedido = any (c.pedidos) and s.estado in ('pago_por_fora', 'descartado')
      )
      and not exists (
        select 1 from public.vendas_avulsas v
        where v.estornada_em is null
          and (v.pedido_recuperado = any (c.pedidos)
               or (c.telefone is not null and v.cliente_telefone = c.telefone and v.feita_em >= c.primeira - interval '2 hours'))
      )
      -- Um negócio de recuperação por cliente a cada 30 dias, venha de qual pedido vier.
      and not exists (
        select 1 from public.kommo_escritas e
        where e.automacao = 'recuperacao' and e.cliente = c.cliente and e.criado_em > now() - interval '30 days'
      )
    order by c.ultima
    limit 50
  ),
  pos_venda as (
    select jsonb_build_object(
      'pedido', p.pedido,
      'cliente', coalesce(p.cliente_telefone, p.cliente_email, p.cliente_codigo),
      'nome', p.cliente_nome,
      'situacao', p.situacao,
      'status', p.status,
      'negocio', coalesce(
        -- O negócio que a própria recuperação criou para este cliente, se ainda estiver aberto no funil.
        (select jsonb_build_object('id', n.id, 'funil_id', n.funil_id, 'etapa_id', n.etapa_id, 'responsavel_id', n.responsavel_id,
                                   'ordem', (select e2.ordem from public.kommo_etapas e2 where e2.funil_id = n.funil_id and e2.id = n.etapa_id))
         from public.kommo_escritas w
         join public.kommo_negocios n on n.id = w.negocio_id
         where w.automacao = 'recuperacao' and w.estado = 'ok'
           and w.cliente = coalesce(p.cliente_telefone, p.cliente_email, p.cliente_codigo)
           and not n.apagado and n.etapa_id not in (142, 143) and n.funil_id = pos.funil_id
         order by w.id desc limit 1),
        public.kommo_avisos_negocio_do_cliente(p.cliente_telefone, p.cliente_email, pos.funil_id)
      )
    ) as x
    from public.tray_pedidos p
    cross join pos
    where p.situacao = 'pago'
      and coalesce(p.status_mudou_em, p.feito_em) >= pos.ativada_em
      and p.dia > (now() at time zone 'America/Sao_Paulo')::date - 60
    order by coalesce(p.status_mudou_em, p.feito_em)
    limit 300
  ),
  casos as (
    select jsonb_build_object(
      'caso', c.id,
      'assunto', c.assunto,
      'urgente', c.urgente,
      'pedido', c.pedido,
      'nome', coalesce(c.cliente_nome, p.cliente_nome),
      'telefone', coalesce(c.cliente_telefone, p.cliente_telefone),
      'email', p.cliente_email,
      'no_sac', public.kommo_avisos_negocio_do_cliente(coalesce(c.cliente_telefone, p.cliente_telefone), p.cliente_email, sac.funil_id)
    ) as x
    from public.suporte_casos c
    left join public.tray_pedidos p on p.pedido = c.pedido
    cross join sac
    where c.aberto_em >= sac.ativada_em
      and c.aberto_em <= now() - make_interval(mins => sac.espera_min)
      and c.estado in ('na_fila', 'com_suporte')
      and not exists (select 1 from public.kommo_escritas e where e.chave = 'sac:caso:' || c.id)
    order by c.aberto_em
    limit 50
  )
  select jsonb_build_object(
    'automacoes', coalesce((select jsonb_agg(jsonb_build_object(
        'id', a.id, 'funil_id', a.funil_id, 'etapa_id', a.etapa_id, 'etapas', a.etapas, 'responsavel_id', a.responsavel_id,
        'espera_min', a.espera_min, 'limite_por_hora', a.limite_por_hora, 'ativada_em', a.ativada_em)) from ativas a), '[]'::jsonb),
    'etapas', coalesce((select jsonb_agg(jsonb_build_object('funil_id', e.funil_id, 'id', e.id, 'ordem', e.ordem))
                        from public.kommo_etapas e where e.funil_id in (select funil_id from ativas where funil_id is not null)), '[]'::jsonb),
    'recuperacao', coalesce((select jsonb_agg(x) from recuperacao), '[]'::jsonb),
    'pos_venda', coalesce((select jsonb_agg(x) from pos_venda), '[]'::jsonb),
    'sac', coalesce((select jsonb_agg(x) from casos), '[]'::jsonb)
  );
$$;

-- O negócio aberto de cada telefone (para as tarefas), num funil ou em qualquer um.
create or replace function public.kommo_avisos_negocios_por_telefone(p_telefones text[], p_funil bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(t, n) filter (where n is not null), '{}'::jsonb)
  from (
    select t, public.kommo_avisos_negocio_do_cliente(t, null, p_funil) as n
    from unnest(coalesce(p_telefones, '{}'::text[])) as t
    where t ~ '^55[0-9]{10,11}$'
    limit 500
  ) x;
$$;

-- As oportunidades da ficha do cliente, lidas COMO a pessoa que ligou as
-- tarefas (a função delas confere a área da sessão). Desligada: nulo.
create or replace function public.kommo_avisos_base_de_oportunidades(p_de date, p_ate date, p_marcos integer[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quem uuid;
  v_antes jsonb;
  v_r jsonb;
begin
  select a.ativada_por into v_quem from public.kommo_automacoes a where a.id = 'tarefas' and a.ativa;
  if v_quem is null then return null; end if;
  v_antes := public.kommo_vendas_entrar_como(v_quem);
  v_r := public.base_de_oportunidades(p_de, p_ate, p_marcos);
  perform public.kommo_vendas_sair(v_antes);
  return v_r;
end
$$;

-- Das chaves pedidas, as que já têm escrita (qualquer estado).
create or replace function public.kommo_escritas_feitas(p_chaves text[])
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(e.chave), '{}'::text[]) from public.kommo_escritas e where e.chave = any (coalesce(p_chaves, '{}'::text[]));
$$;

-- Reserva a escrita de um evento ANTES de chamar a Kommo. Devolve o autor.
create or replace function public.kommo_escrita_reservar(
  p_chave text, p_automacao text, p_acao text, p_cliente text, p_referencia text, p_rotulo text, p_negocio bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a public.kommo_automacoes;
  v_na_hora integer;
  v_id bigint;
begin
  if coalesce(btrim(p_chave), '') = '' or p_acao not in ('criar_negocio', 'mover_negocio', 'criar_tarefa') then
    return jsonb_build_object('ok', false, 'motivo', 'dados');
  end if;
  select * into v_a from public.kommo_automacoes a where a.id = p_automacao for update;
  if not found or not v_a.ativa then
    return jsonb_build_object('ok', false, 'motivo', 'desligada');
  end if;
  -- O autor precisa continuar sendo diretoria ativa. Se deixou de ser, a
  -- automação desliga: ninguém escreve na Kommo em nome de quem saiu.
  if not exists (
    select 1 from public.profiles p
    where p.id = v_a.ativada_por and p.is_active and p.role::text in ('admin', 'dono', 'gm')
  ) then
    update public.kommo_automacoes a set ativa = false where a.id = p_automacao;
    return jsonb_build_object('ok', false, 'motivo', 'sem_autor');
  end if;
  if exists (select 1 from public.kommo_escritas e where e.chave = p_chave) then
    return jsonb_build_object('ok', false, 'motivo', 'ja');
  end if;
  select count(*) into v_na_hora from public.kommo_escritas e where e.automacao = p_automacao and e.criado_em > now() - interval '1 hour';
  if v_na_hora >= v_a.limite_por_hora then
    return jsonb_build_object('ok', false, 'motivo', 'teto');
  end if;
  insert into public.kommo_escritas (chave, automacao, acao, feita_por, cliente, referencia, rotulo, negocio_id)
  values (p_chave, p_automacao, p_acao, v_a.ativada_por, nullif(p_cliente, ''), left(p_referencia, 120), left(p_rotulo, 300), p_negocio)
  on conflict (chave) do nothing
  returning id into v_id;
  if v_id is null then return jsonb_build_object('ok', false, 'motivo', 'ja'); end if;
  return jsonb_build_object('ok', true, 'id', v_id, 'feita_por', v_a.ativada_por);
end
$$;

create or replace function public.kommo_escrita_terminar(
  p_id bigint, p_estado text, p_negocio bigint, p_antes jsonb, p_pedido jsonb, p_depois jsonb, p_http integer, p_erro text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_estado not in ('ok', 'recusada', 'erro', 'desistiu') then
    return jsonb_build_object('ok', false, 'motivo', 'estado');
  end if;
  update public.kommo_escritas e
  set estado = p_estado, negocio_id = coalesce(p_negocio, e.negocio_id), antes = p_antes, pedido = p_pedido, depois = p_depois,
      http = p_http, erro = left(p_erro, 600), terminado_em = now()
  where e.id = p_id and e.estado = 'enviando';
  return jsonb_build_object('ok', found);
end
$$;

revoke execute on function public.kommo_automacao_problema(text, bigint, bigint, jsonb, bigint) from public, anon, authenticated;
revoke execute on function public.kommo_avisos_negocio_do_cliente(text, text, bigint),
  public.kommo_avisos_candidatos(), public.kommo_avisos_negocios_por_telefone(text[], bigint),
  public.kommo_avisos_base_de_oportunidades(date, date, integer[]), public.kommo_escritas_feitas(text[]),
  public.kommo_escrita_reservar(text, text, text, text, text, text, bigint),
  public.kommo_escrita_terminar(bigint, text, bigint, jsonb, jsonb, jsonb, integer, text)
  from public, anon, authenticated;
grant execute on function public.kommo_avisos_candidatos(), public.kommo_avisos_negocios_por_telefone(text[], bigint),
  public.kommo_avisos_base_de_oportunidades(date, date, integer[]), public.kommo_escritas_feitas(text[]),
  public.kommo_escrita_reservar(text, text, text, text, text, text, bigint),
  public.kommo_escrita_terminar(bigint, text, bigint, jsonb, jsonb, jsonb, integer, text)
  to service_role;

revoke execute on function public.kommo_automacoes_lista(), public.kommo_automacao_salvar(text, jsonb),
  public.kommo_automacao_ligar(text), public.kommo_automacao_desligar(text) from public, anon;
grant execute on function public.kommo_automacoes_lista(), public.kommo_automacao_salvar(text, jsonb),
  public.kommo_automacao_ligar(text), public.kommo_automacao_desligar(text) to authenticated;
