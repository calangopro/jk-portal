-- 0075: a venda por fora entra na fila da fábrica.
--
-- De onde veio: a fila da fábrica (0067) só lia pedido da Tray, e perto de um
-- quarto do faturamento é venda fechada por fora (Pix direto no WhatsApp). Essa
-- venda era passada para a produção colando nome, CPF, endereço, numeração e
-- gravação num grupo de WhatsApp de sete pessoas.
--
-- O QUE MUDA:
--
-- 1. `vendas_producao`: o que a fábrica precisa de uma venda por fora. As peças
--    ficam no MESMO formato dos itens do pedido da Tray (nome, quantidade, o
--    texto com numeração e gravação, e o código do produto), para o cartão da
--    fábrica ser um só. Quem grava é `enviar_venda_para_a_fabrica()`.
--
-- 2. A fábrica passa a identificar o trabalho por uma REFERÊNCIA em texto: o
--    número do pedido da loja ("11389") ou "v" mais o código da venda por fora.
--    `fabrica_pedidos` e `fabrica_movimentos` ganham a coluna `venda`, e cada
--    linha é de um pedido OU de uma venda, nunca dos dois.
--
-- 3. `fila_da_fabrica()` junta as duas origens. A venda por fora chega com o
--    primeiro nome de quem vendeu (é a quem a fábrica pergunta) e, quando não é
--    retirada em loja, com o endereço de entrega.
--
-- SOBRE O ENDEREÇO: o projeto não grava endereço nem documento dos pedidos da
-- loja. Aqui o endereço entra porque sem ele a fábrica não despacha, e hoje ele
-- trafega em texto aberto num grupo. Fica nesta tabela só, lido pela fábrica
-- dentro da fila e por quem vê a venda. CPF e CNPJ continuam de fora.

create table public.vendas_producao (
  venda      uuid primary key references public.vendas_avulsas (id) on delete cascade,
  pecas      jsonb not null check (jsonb_typeof(pecas) = 'array' and jsonb_array_length(pecas) between 1 and 8),
  entrega    text not null check (char_length(entrega) between 3 and 120),
  endereco   text check (char_length(endereco) <= 300),
  cidade     text check (char_length(cidade) <= 80),
  uf         text check (uf ~ '^[A-Z]{2}$'),
  criado_por uuid references public.profiles (id) on delete set null,
  criado_em  timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table public.vendas_producao is
  'O que a fábrica precisa de uma venda por fora: peças, entrega e endereço. Gravação só por enviar_venda_para_a_fabrica().';

create index vendas_producao_quem_idx on public.vendas_producao (criado_por);

alter table public.vendas_producao enable row level security;

-- Vê a produção quem vê a venda: a subconsulta passa pela regra de `vendas_avulsas`
-- (o vendedor vê as próprias, quem tem a área de vendas vê todas).
create policy vendas_producao_select on public.vendas_producao
  for select to authenticated
  using (exists (select 1 from public.vendas_avulsas v where v.id = venda));

revoke all on public.vendas_producao from anon;

-- ------------------------------------------------- a fábrica por referência

alter table public.fabrica_pedidos drop constraint fabrica_pedidos_pkey;
alter table public.fabrica_pedidos alter column pedido drop not null;
alter table public.fabrica_pedidos add column id bigint generated always as identity primary key;
alter table public.fabrica_pedidos add column venda uuid references public.vendas_avulsas (id) on delete cascade;
alter table public.fabrica_pedidos add constraint fabrica_pedidos_pedido_key unique (pedido);
alter table public.fabrica_pedidos add constraint fabrica_pedidos_venda_key unique (venda);
alter table public.fabrica_pedidos add constraint fabrica_pedidos_um_dos_dois check ((pedido is null) <> (venda is null));

alter table public.fabrica_movimentos alter column pedido drop not null;
alter table public.fabrica_movimentos add column venda uuid references public.vendas_avulsas (id) on delete cascade;
alter table public.fabrica_movimentos add constraint fabrica_movimentos_um_dos_dois check ((pedido is null) <> (venda is null));
create index fabrica_movimentos_venda_idx on public.fabrica_movimentos (venda, em desc);

-- ------------------------------------------------- mandar a venda para a fábrica

/**
 * Manda uma venda por fora para a fábrica, ou corrige o que foi mandado.
 *
 * Só quem vendeu, quem lançou ou quem vê todas as vendas. Depois que a fábrica
 * pega a venda (sai de "a produzir"), a correção é recusada: a mudança passa a
 * ser combinada com a fábrica, e não feita por baixo.
 *
 * As peças são regravadas só com os campos conhecidos: o que mais vier é
 * descartado.
 */
create or replace function public.enviar_venda_para_a_fabrica(
  p_venda uuid,
  p_pecas jsonb,
  p_entrega text,
  p_endereco text default null,
  p_cidade text default null,
  p_uf text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu    uuid := (select auth.uid());
  v_pecas jsonb;
begin
  if v_eu is null or not public.tem_acesso('lancar_venda') then
    return jsonb_build_object('ok', false, 'motivo', 'sem_acesso');
  end if;
  if not exists (
    select 1 from public.vendas_avulsas v
    where v.id = p_venda and v.estornada_em is null
      and (v.vendedor_id = v_eu or v.lancada_por = v_eu or public.tem_acesso('vendas'))
  ) then
    return jsonb_build_object('ok', false, 'motivo', 'venda');
  end if;
  if exists (select 1 from public.fabrica_pedidos f where f.venda = p_venda and f.etapa <> 'a_produzir') then
    return jsonb_build_object('ok', false, 'motivo', 'ja_na_bancada');
  end if;
  if p_pecas is null or jsonb_typeof(p_pecas) <> 'array' or jsonb_array_length(p_pecas) not between 1 and 8 then
    return jsonb_build_object('ok', false, 'motivo', 'pecas');
  end if;
  if char_length(coalesce(btrim(p_entrega), '')) not between 3 and 120
     or char_length(coalesce(p_endereco, '')) > 300 or char_length(coalesce(p_cidade, '')) > 80
     or (nullif(btrim(coalesce(p_uf, '')), '') is not null and upper(btrim(p_uf)) !~ '^[A-Z]{2}$') then
    return jsonb_build_object('ok', false, 'motivo', 'entrega');
  end if;

  select jsonb_agg(jsonb_build_object(
    'nome', left(btrim(i->>'nome'), 200),
    'quantidade', greatest(least(coalesce(nullif(i->>'quantidade', '')::integer, 1), 20), 1),
    'referencia', nullif(left(btrim(coalesce(i->>'referencia', '')), 60), ''),
    'info', nullif(left(coalesce(i->>'info', ''), 1500), ''),
    'produto_tray_id', nullif(left(btrim(coalesce(i->>'produto_tray_id', '')), 20), '')
  ))
  into v_pecas
  from jsonb_array_elements(p_pecas) i
  where char_length(btrim(coalesce(i->>'nome', ''))) > 0 and coalesce(i->>'quantidade', '1') ~ '^[0-9]{1,2}$';

  if v_pecas is null or jsonb_array_length(v_pecas) <> jsonb_array_length(p_pecas) then
    return jsonb_build_object('ok', false, 'motivo', 'pecas');
  end if;

  insert into public.vendas_producao as p (venda, pecas, entrega, endereco, cidade, uf, criado_por)
  values (p_venda, v_pecas, btrim(p_entrega), nullif(btrim(p_endereco), ''), nullif(btrim(p_cidade), ''), nullif(upper(btrim(coalesce(p_uf, ''))), ''), v_eu)
  on conflict (venda) do update set
    pecas = excluded.pecas, entrega = excluded.entrega, endereco = excluded.endereco,
    cidade = excluded.cidade, uf = excluded.uf, atualizado_em = now();

  return jsonb_build_object('ok', true);
end
$$;

revoke execute on function public.enviar_venda_para_a_fabrica(uuid, jsonb, text, text, text, text) from public, anon;
grant execute on function public.enviar_venda_para_a_fabrica(uuid, jsonb, text, text, text, text) to authenticated;

/**
 * Em que etapa da fábrica está cada venda pedida. Só devolve venda que a pessoa
 * pode ver (a própria, ou todas para quem tem a área de vendas). Venda que não
 * foi para a fábrica não aparece na resposta.
 */
create or replace function public.etapa_das_vendas(p_ids uuid[])
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(v.id, jsonb_build_object(
    'etapa', coalesce(f.etapa, 'a_produzir'),
    'entrega', p.entrega,
    'rastreio', f.rastreio
  )), '{}'::jsonb)
  from public.vendas_producao p
  join public.vendas_avulsas v on v.id = p.venda
  left join public.fabrica_pedidos f on f.venda = v.id
  where v.id = any(p_ids)
    and v.estornada_em is null
    and (v.vendedor_id = (select auth.uid()) or public.tem_acesso('vendas'))
$$;

revoke execute on function public.etapa_das_vendas(uuid[]) from public, anon;
grant execute on function public.etapa_das_vendas(uuid[]) to authenticated;

-- ------------------------------------------------------------------ a fila

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
      end as etapa
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
      coalesce(f.etapa, 'a_produzir') as etapa
    from public.vendas_producao vp
    join public.vendas_avulsas v on v.id = vp.venda
    left join public.fabrica_pedidos f on f.venda = v.id
    cross join dias d
    where (select sim from pode)
      and v.estornada_em is null
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
        'pecas', pecas
      ) order by feito_em)
      from pronto
    ), '[]'::jsonb)
  )
$$;

-- ------------------------------------------------------------------ mover

/**
 * Move um trabalho da fábrica de etapa, pela referência: o número do pedido da
 * loja ou "v" mais o código da venda por fora. É a porta única de escrita.
 *
 * `p_rastreio` e `p_nota` nulos não mexem no que já está gravado; texto vazio
 * apaga.
 */
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
      where vp.venda = v_venda and v.estornada_em is null
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

revoke execute on function public.mover_na_fabrica(text, text, text, text) from public, anon;
grant execute on function public.mover_na_fabrica(text, text, text, text) to authenticated;

/**
 * Move vários trabalhos para a mesma etapa. O que não pode entrar (pedido não
 * pago, venda estornada, referência que não existe) volta em `fora`, em vez de
 * derrubar a leva inteira.
 */
create or replace function public.mover_varios_na_fabrica(p_refs text[], p_etapa text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ref     text;
  v_movidos integer := 0;
  v_fora    text[] := '{}';
begin
  if not public.tem_acesso('fabrica') then
    raise exception 'Seu acesso não inclui a fábrica.' using errcode = '42501';
  end if;
  if p_etapa is null or p_etapa not in ('a_produzir', 'em_producao', 'pronto', 'enviado') then
    raise exception 'Etapa desconhecida.' using errcode = '22023';
  end if;
  if coalesce(array_length(p_refs, 1), 0) = 0 or array_length(p_refs, 1) > 200 then
    raise exception 'Escolha de 1 a 200 pedidos por vez.' using errcode = '22023';
  end if;

  for v_ref in select distinct x from unnest(p_refs) as t(x) where x is not null loop
    begin
      perform public.mover_na_fabrica(v_ref, p_etapa);
      v_movidos := v_movidos + 1;
    exception when sqlstate '22023' then
      v_fora := v_fora || v_ref;
    end;
  end loop;

  return jsonb_build_object('ok', true, 'movidos', v_movidos, 'fora', to_jsonb(v_fora));
end
$$;

revoke execute on function public.mover_varios_na_fabrica(text[], text) from public, anon;
grant execute on function public.mover_varios_na_fabrica(text[], text) to authenticated;

-- As duas portas antigas, por número de pedido, viram atalho das novas. Ficam
-- para o código que está no ar no instante desta migration não quebrar.
create or replace function public.mover_pedido_da_fabrica(
  p_pedido bigint,
  p_etapa text,
  p_rastreio text default null,
  p_nota text default null
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.mover_na_fabrica(p_pedido::text, p_etapa, p_rastreio, p_nota)
$$;

create or replace function public.mover_pedidos_da_fabrica(p_pedidos bigint[], p_etapa text)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.mover_varios_na_fabrica((select array_agg(x::text) from unnest(p_pedidos) as t(x)), p_etapa)
$$;
