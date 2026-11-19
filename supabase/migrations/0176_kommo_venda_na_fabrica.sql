-- 0176: venda ganha da Kommo sem pedido vai para a fila da fábrica (cartão 51).
--
-- A fase 3 (0165) transforma a venda ganha num funil de venda em venda por fora
-- (`registrar_venda_avulsa`), mas sem peça, numeração nem gravação: a fábrica
-- não recebia, e alguém precisava passar de novo pelo grupo.
--
-- Agora, depois de a venda por fora entrar, a rodada lê os campos do negócio
-- (Produto, Tipo de Produto, Metal, Numeração, Gravura, Loja...) pela conta
-- pura de `src/lib/kommo/fabrica.ts`, confere com `lerProducao` (a MESMA do
-- formulário de Registrar venda) e manda pela MESMA porta da venda por fora:
-- `enviar_venda_para_a_fabrica`, entrando em nome do vendedor do negócio, como
-- a fase 3 faz. Rodar duas vezes não manda duas vezes: a venda que já tem
-- produção (`vendas_producao`) não é mais candidata.
--
-- Produção incompleta ou ambígua NÃO segue: fica em `fabrica_kommo` com os
-- motivos, aparece em Vendas da Kommo e se completa pelo formulário de
-- Registrar venda, com a venda já escolhida. A rodada relê o negócio a cada
-- passada, então completar os campos na própria Kommo também destrava.
--
-- Se o negócio sair do ganho depois de a fábrica pegar o trabalho, o cartão da
-- fábrica continua lá, com o aviso "desfeito na Kommo".
--
-- Nada aqui escreve na Kommo nem nas tabelas `kommo_*`: só lê.

-- ---------------------------------------------------------------------------
-- O que a rodada leu de cada venda. Uma linha por venda por fora vinda da Kommo.
-- ---------------------------------------------------------------------------
create table if not exists public.fabrica_kommo (
  venda         uuid primary key references public.vendas_avulsas (id) on delete cascade,
  negocio_id    bigint not null,
  estado        text not null check (estado in ('fabrica', 'incompleta', 'fora')),
  motivos       jsonb not null default '[]'::jsonb check (jsonb_typeof(motivos) = 'array'),
  formulario    jsonb,
  lido_em       timestamptz not null default now(),
  na_fabrica_em timestamptz,
  criado_em     timestamptz not null default now()
);
create index if not exists fabrica_kommo_negocio on public.fabrica_kommo (negocio_id);
create index if not exists fabrica_kommo_estado on public.fabrica_kommo (estado) where estado <> 'fabrica';

comment on table public.fabrica_kommo is
  'Venda por fora vinda da Kommo e a leitura da produção (cartão 51). Gravação só por kommo_fabrica_aplicar().';

-- Desde quando vale. As vendas da Kommo registradas antes desta migration já
-- foram passadas à fábrica pelo grupo: mandar de novo duplicaria trabalho.
create table if not exists public.fabrica_kommo_config (
  id    int primary key default 1 check (id = 1),
  desde timestamptz not null
);
insert into public.fabrica_kommo_config (id, desde) values (1, now()) on conflict (id) do nothing;

alter table public.fabrica_kommo enable row level security;
alter table public.fabrica_kommo_config enable row level security;
revoke all on public.fabrica_kommo, public.fabrica_kommo_config from anon, authenticated;

-- ---------------------------------------------------------------------------
-- O que a rodada precisa olhar. Só a chave de serviço.
-- ---------------------------------------------------------------------------
create or replace function public.kommo_fabrica_candidatos(p_limite int default 100)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(c), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'negocio_id', kv.negocio_id,
      'venda_id', kv.venda_id,
      'campos', coalesce(n.campos, '[]'::jsonb),
      'estado', fk.estado
    ) as c
    from public.kommo_vendas kv
    join public.vendas_avulsas v on v.id = kv.venda_id
    left join public.kommo_negocios n on n.id = kv.negocio_id
    left join public.fabrica_kommo fk on fk.venda = kv.venda_id
    where kv.estado = 'registrada'
      and v.estornada_em is null
      and v.criada_em >= (select desde from public.fabrica_kommo_config where id = 1)
      and not exists (select 1 from public.vendas_producao vp where vp.venda = v.id)
      and (fk.venda is null or fk.estado in ('incompleta', 'fora'))
    order by v.criada_em desc
    limit greatest(1, least(p_limite, 300))
  ) x;
$$;

-- ---------------------------------------------------------------------------
-- Grava o que a conta pura leu e, com produção completa, manda para a fábrica
-- pela porta de sempre, em nome do vendedor. Só a chave de serviço.
-- p_leitura: {tipo: fabrica|incompleta|fora, motivos[], formulario{}, producao{pecas, entrega, endereco, cidade, uf}}
-- ---------------------------------------------------------------------------
create or replace function public.kommo_fabrica_aplicar(p_venda uuid, p_leitura jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kv      public.kommo_vendas;
  v_tipo    text := p_leitura ->> 'tipo';
  v_motivos jsonb := case when jsonb_typeof(p_leitura -> 'motivos') = 'array' then p_leitura -> 'motivos' else '[]'::jsonb end;
  v_form    jsonb := p_leitura -> 'formulario';
  v_prod    jsonb := p_leitura -> 'producao';
  v_antes   jsonb;
  v_r       jsonb;
begin
  if v_tipo is null or v_tipo not in ('fabrica', 'incompleta', 'fora') then
    return jsonb_build_object('ok', false, 'erro', 'leitura desconhecida');
  end if;
  -- Trava o vínculo da venda: rotina e webhook ao mesmo tempo não mandam duas vezes.
  select * into v_kv from public.kommo_vendas where venda_id = p_venda and estado = 'registrada' for update;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'a venda não está registrada pela Kommo');
  end if;

  -- Alguém já completou pelo formulário: é da fábrica, e a leitura não mexe mais.
  if exists (select 1 from public.vendas_producao where venda = p_venda) then
    insert into public.fabrica_kommo (venda, negocio_id, estado, motivos, formulario, na_fabrica_em)
    values (p_venda, v_kv.negocio_id, 'fabrica', '[]'::jsonb, null, now())
    on conflict (venda) do update set estado = 'fabrica', motivos = '[]'::jsonb, lido_em = now(),
      na_fabrica_em = coalesce(public.fabrica_kommo.na_fabrica_em, now());
    return jsonb_build_object('ok', true, 'estado', 'fabrica', 'ja', true);
  end if;

  if v_tipo = 'fabrica' then
    v_antes := public.kommo_vendas_entrar_como(v_kv.vendedor);
    begin
      v_r := public.enviar_venda_para_a_fabrica(
        p_venda,
        v_prod -> 'pecas',
        v_prod ->> 'entrega',
        nullif(v_prod ->> 'endereco', ''),
        nullif(v_prod ->> 'cidade', ''),
        nullif(v_prod ->> 'uf', '')
      );
    exception when others then
      v_r := jsonb_build_object('ok', false, 'motivo', sqlerrm);
    end;
    perform public.kommo_vendas_sair(v_antes);

    if coalesce((v_r ->> 'ok')::boolean, false) then
      insert into public.fabrica_kommo (venda, negocio_id, estado, motivos, formulario, na_fabrica_em)
      values (p_venda, v_kv.negocio_id, 'fabrica', '[]'::jsonb, v_form, now())
      on conflict (venda) do update set estado = 'fabrica', motivos = '[]'::jsonb, formulario = excluded.formulario,
        lido_em = now(), na_fabrica_em = now();
      return jsonb_build_object('ok', true, 'estado', 'fabrica');
    end if;
    -- A porta recusou: não segue, e a frase fica para quem for completar.
    v_tipo := 'incompleta';
    v_motivos := jsonb_build_array('O painel recusou a produção (' || coalesce(v_r ->> 'motivo', 'sem motivo') || '): confira e complete pelo formulário');
  end if;

  insert into public.fabrica_kommo (venda, negocio_id, estado, motivos, formulario)
  values (p_venda, v_kv.negocio_id, v_tipo, v_motivos, v_form)
  on conflict (venda) do update set estado = excluded.estado, motivos = excluded.motivos,
    formulario = excluded.formulario, lido_em = now();
  return jsonb_build_object('ok', true, 'estado', v_tipo);
end
$$;

-- ---------------------------------------------------------------------------
-- A tela de Vendas da Kommo: o que não foi para a fábrica. Quem vê é quem pode
-- completar (a mesma regra de `enviar_venda_para_a_fabrica`): quem vendeu,
-- quem lançou, ou quem vê todas as vendas. Sem valor e sem telefone.
-- ---------------------------------------------------------------------------
create or replace function public.kommo_fabrica_lista()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_eu     uuid := (select auth.uid());
  v_vendas boolean := coalesce(public.tem_acesso('vendas'), false);
begin
  if v_eu is null or not coalesce(public.tem_acesso('lancar_venda'), false) then
    return null;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'negocio_id', fk.negocio_id,
      'venda_id', fk.venda,
      'negocio', n.nome,
      'cliente', v.cliente_nome,
      'dia', v.dia,
      'vendedor', public.chat_nome(v.vendedor_id),
      'estado', fk.estado,
      'motivos', fk.motivos,
      'pode_completar', true
    ) order by fk.estado, v.dia desc)
    from public.fabrica_kommo fk
    join public.vendas_avulsas v on v.id = fk.venda
    join public.kommo_vendas kv on kv.venda_id = fk.venda and kv.estado = 'registrada'
    left join public.kommo_negocios n on n.id = fk.negocio_id
    where fk.estado in ('incompleta', 'fora')
      and v.estornada_em is null
      and not exists (select 1 from public.vendas_producao vp where vp.venda = v.id)
      and (v.vendedor_id = v_eu or v.lancada_por = v_eu or v_vendas)
  ), '[]'::jsonb);
end
$$;

-- O formulário de Registrar venda abre com o que a Kommo já disse. Mesma regra de quem vê.
create or replace function public.kommo_fabrica_formulario(p_venda uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_eu uuid := (select auth.uid());
begin
  if v_eu is null or not coalesce(public.tem_acesso('lancar_venda'), false) then
    return null;
  end if;
  return (
    select jsonb_build_object(
      'venda_id', fk.venda,
      'negocio_id', fk.negocio_id,
      'negocio', n.nome,
      'cliente', v.cliente_nome,
      'dia', v.dia,
      'estado', fk.estado,
      'motivos', fk.motivos,
      'formulario', fk.formulario,
      'ja_na_fabrica', exists (select 1 from public.vendas_producao vp where vp.venda = v.id)
    )
    from public.fabrica_kommo fk
    join public.vendas_avulsas v on v.id = fk.venda
    left join public.kommo_negocios n on n.id = fk.negocio_id
    where fk.venda = p_venda
      and v.estornada_em is null
      and (v.vendedor_id = v_eu or v.lancada_por = v_eu or coalesce(public.tem_acesso('vendas'), false))
  );
end
$$;

-- ---------------------------------------------------------------------------
-- A fila da fábrica (0075) com a origem Kommo e o aviso de desfeito. Mudou só
-- `por_fora` e as duas colunas novas: a venda da Kommo estornada continua na
-- fila enquanto a fábrica estiver com ela (fora de "a produzir" e de
-- "enviado"), para o trabalho não sumir calado.
-- ---------------------------------------------------------------------------
create or replace function public.fila_da_fabrica(p_dias integer default 15)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with pode as (select public.tem_acesso('fabrica') as sim),
  dias as (select greatest(least(p_dias, 120), 1) as n, (now() at time zone 'America/Sao_Paulo')::date as hoje),
  da_loja as (
    select
      p.pedido::text as ref, 'loja'::text as origem, p.pedido, p.dia, p.feito_em, p.status as status_da_loja,
      p.cliente_nome as cliente, p.cidade, p.uf, p.frete_tipo as entrega, null::text as endereco, null::text as vendedor,
      p.envio_codigo, p.itens,
      f.etapa_em, f.rastreio, f.nota, f.atualizado_por,
      case
        when f.etapa = 'enviado' or upper(coalesce(p.status, '')) in ('ENVIADO', 'FINALIZADO', 'PROBLEMAS NA ENTREGA') then 'enviado'
        else coalesce(f.etapa, 'a_produzir')
      end as etapa,
      null::bigint as kommo, false as desfeito
    from public.tray_pedidos p
    left join public.fabrica_pedidos f on f.pedido = p.pedido
    cross join dias d
    where (select sim from pode)
      and p.situacao = 'pago'
      and (p.dia > d.hoje - d.n or (f.etapa is not null and f.etapa <> 'enviado'))
  ),
  por_fora as (
    select
      'v' || v.id::text as ref, 'por_fora'::text as origem, null::bigint as pedido, v.dia, v.feita_em as feito_em, null::text as status_da_loja,
      v.cliente_nome as cliente, vp.cidade, vp.uf, vp.entrega, vp.endereco,
      (select nullif(split_part(coalesce(x.full_name, ''), ' ', 1), '') from public.profiles x where x.id = v.vendedor_id) as vendedor,
      null::text as envio_codigo, vp.pecas as itens,
      f.etapa_em, f.rastreio, f.nota, f.atualizado_por,
      coalesce(f.etapa, 'a_produzir') as etapa,
      fk.negocio_id as kommo,
      (fk.venda is not null and (
        v.estornada_em is not null
        or exists (select 1 from public.kommo_vendas kv
                   where kv.venda_id = v.id and (kv.estado = 'desfeita' or kv.motivo in ('desfeito_estorno', 'desfeito_marcado')))
      )) as desfeito
    from public.vendas_producao vp
    join public.vendas_avulsas v on v.id = vp.venda
    left join public.fabrica_pedidos f on f.venda = v.id
    left join public.fabrica_kommo fk on fk.venda = v.id
    cross join dias d
    where (select sim from pode)
      and (v.estornada_em is null
           or (fk.venda is not null and f.etapa is not null and f.etapa not in ('a_produzir', 'enviado')))
      and (v.dia > d.hoje - d.n or (f.etapa is not null and f.etapa <> 'enviado'))
  ),
  janela as (select * from da_loja union all select * from por_fora),
  -- O que entrou só por ter linha antiga e já saiu não precisa aparecer.
  visiveis as (
    select j.* from janela j cross join dias d
    where j.etapa <> 'enviado' or j.dia > d.hoje - d.n
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
    'dias', (select n from dias),
    'pedidos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'ref', ref,
        'origem', origem,
        'pedido', pedido,
        'dia', dia,
        'feito_em', feito_em,
        'status_da_loja', status_da_loja,
        'etapa', etapa,
        'etapa_em', etapa_em,
        'movido_por', movido_por,
        'cliente', cliente,
        'cidade', cidade,
        'uf', uf,
        'entrega', entrega,
        'endereco', endereco,
        'vendedor', vendedor,
        'rastreio', coalesce(nullif(rastreio, ''), nullif(envio_codigo, '')),
        'nota', nota,
        'pecas', pecas,
        'kommo', kommo,
        'desfeito_na_kommo', desfeito
      ) order by feito_em)
      from pronto
    ), '[]'::jsonb)
  )
$$;

-- A porta de mover (0075) passa a aceitar a venda da Kommo desfeita que a
-- fábrica já pegou: sem isso, o cartão com o aviso ficaria preso na fila.
create or replace function public.mover_na_fabrica(
  p_ref text,
  p_etapa text,
  p_rastreio text default null,
  p_nota text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quem   uuid := (select auth.uid());
  v_pedido bigint;
  v_venda  uuid;
  v_de     text;
  v_tem    boolean;
begin
  if not public.tem_acesso('fabrica') then
    raise exception 'Seu acesso não inclui a fábrica.' using errcode = '42501';
  end if;
  if p_etapa is null or p_etapa not in ('a_produzir', 'em_producao', 'pronto', 'enviado') then
    raise exception 'Etapa desconhecida.' using errcode = '22023';
  end if;
  if char_length(coalesce(p_rastreio, '')) > 80 or char_length(coalesce(p_nota, '')) > 500 then
    raise exception 'Texto longo demais.' using errcode = '22023';
  end if;

  if p_ref ~ '^[0-9]{1,12}$' then
    v_pedido := p_ref::bigint;
    if not exists (select 1 from public.tray_pedidos p where p.pedido = v_pedido and p.situacao = 'pago') then
      raise exception 'Só pedido pago entra na fábrica.' using errcode = '22023';
    end if;
  elsif p_ref ~ '^v[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_venda := substr(p_ref, 2)::uuid;
    if not exists (
      select 1 from public.vendas_producao vp join public.vendas_avulsas v on v.id = vp.venda
      where vp.venda = v_venda
        and (v.estornada_em is null
             or (exists (select 1 from public.fabrica_kommo fk where fk.venda = v_venda)
                 and exists (select 1 from public.fabrica_pedidos f where f.venda = v_venda)))
    ) then
      raise exception 'Esta venda não está na fábrica.' using errcode = '22023';
    end if;
  else
    raise exception 'Pedido desconhecido.' using errcode = '22023';
  end if;

  select f.etapa, true into v_de, v_tem
  from public.fabrica_pedidos f
  where (v_pedido is not null and f.pedido = v_pedido) or (v_venda is not null and f.venda = v_venda);

  if coalesce(v_tem, false) then
    update public.fabrica_pedidos f set
      etapa = p_etapa,
      etapa_em = case when f.etapa is distinct from p_etapa then now() else f.etapa_em end,
      rastreio = case when p_rastreio is null then f.rastreio else nullif(btrim(p_rastreio), '') end,
      nota = case when p_nota is null then f.nota else nullif(btrim(p_nota), '') end,
      atualizado_por = v_quem
    where (v_pedido is not null and f.pedido = v_pedido) or (v_venda is not null and f.venda = v_venda);
  else
    insert into public.fabrica_pedidos (pedido, venda, etapa, etapa_em, rastreio, nota, atualizado_por)
    values (v_pedido, v_venda, p_etapa, now(), nullif(btrim(p_rastreio), ''), nullif(btrim(p_nota), ''), v_quem);
  end if;

  if coalesce(v_de, 'a_produzir') is distinct from p_etapa then
    insert into public.fabrica_movimentos (pedido, venda, de, para, por)
    values (v_pedido, v_venda, coalesce(v_de, 'a_produzir'), p_etapa, v_quem);
  end if;

  return jsonb_build_object('ok', true, 'de', coalesce(v_de, 'a_produzir'), 'para', p_etapa);
end
$$;

revoke execute on function public.kommo_fabrica_candidatos(int), public.kommo_fabrica_aplicar(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.kommo_fabrica_candidatos(int), public.kommo_fabrica_aplicar(uuid, jsonb) to service_role;
revoke execute on function public.kommo_fabrica_lista(), public.kommo_fabrica_formulario(uuid) from public, anon;
grant execute on function public.kommo_fabrica_lista(), public.kommo_fabrica_formulario(uuid) to authenticated;
