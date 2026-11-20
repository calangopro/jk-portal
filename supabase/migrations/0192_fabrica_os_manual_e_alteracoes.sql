-- 0192: Fábrica v2, quem vende acompanha e abre OS (cartão 63).
--
-- 1. OS ABERTA À MÃO (`fabrica_avulsos`): troca, refazer, ajuste, upgrade,
--    polimento ou serviço, que não nascem de venda nova na loja. O vendedor ou
--    a fábrica abre por `fabrica_abrir_os`; a OS entra na fila em "Chegou
--    pedido", com código como qualquer outra. A referência é "a" mais o id.
--    As peças vêm no MESMO formato dos itens do pedido da loja e da venda por
--    fora (`info` com uma linha por informação), conferidas por `lerProducao`
--    no servidor antes de chegar aqui. `loja` e `numero_papel` ficam prontas
--    para o pedido das lojas físicas (cartão 66).
--
-- 2. PEDIDO DE ALTERAÇÃO (`fabrica_alteracoes`): o cliente pediu para mudar
--    alguma coisa depois de o pedido ir para a fábrica. Quem vende escreve; o
--    cartão da fábrica fica com o aviso vermelho até alguém da fábrica tocar em
--    "Ciente". É a trava do sistema do Daniel do jeito daqui: o vendedor não
--    muda nada por baixo, ele pede.
--
-- 3. A FILA ABRE PARA QUEM VENDE (`lancar_venda` e `vendas`), só para ler, e
--    diz em `pode_mover` se a pessoa move. Ela já não trazia preço nem custo, e
--    o vendedor já vê cliente nas outras telas. Mover, marcar e dar ciência
--    continuam pedindo a área `fabrica`.

create table public.fabrica_avulsos (
  id               uuid primary key default gen_random_uuid(),
  pedido_origem    bigint references public.tray_pedidos(pedido) on delete set null,
  cliente_nome     text check (char_length(cliente_nome) <= 120),
  cliente_telefone text check (cliente_telefone ~ '^55[0-9]{10,11}$'),
  pecas            jsonb not null default '[]'::jsonb check (jsonb_typeof(pecas) = 'array'),
  entrega          text check (char_length(entrega) <= 200),
  endereco         text check (char_length(endereco) <= 300),
  cidade           text check (char_length(cidade) <= 80),
  uf               text check (uf ~ '^[A-Z]{2}$'),
  relato           text check (char_length(relato) <= 1000),
  loja             text check (char_length(loja) <= 60),
  numero_papel     text check (char_length(numero_papel) <= 30),
  criado_por       uuid references public.profiles(id) on delete set null,
  criado_em        timestamptz not null default now()
);
comment on table public.fabrica_avulsos is 'OS da fábrica aberta à mão: troca, refazer, ajuste, upgrade, polimento, serviço (0192).';
alter table public.fabrica_avulsos enable row level security;

alter table public.fabrica_pedidos add column avulso uuid unique references public.fabrica_avulsos(id) on delete cascade;
alter table public.fabrica_movimentos add column avulso uuid references public.fabrica_avulsos(id) on delete cascade;
alter table public.fabrica_pedidos drop constraint fabrica_pedidos_um_dos_dois;
alter table public.fabrica_pedidos add constraint fabrica_pedidos_uma_origem check (num_nonnulls(pedido, venda, avulso) = 1);
alter table public.fabrica_movimentos drop constraint fabrica_movimentos_um_dos_dois;
alter table public.fabrica_movimentos add constraint fabrica_movimentos_uma_origem check (num_nonnulls(pedido, venda, avulso) = 1);

create table public.fabrica_alteracoes (
  id         bigint generated always as identity primary key,
  fabrica_id bigint not null references public.fabrica_pedidos(id) on delete cascade,
  texto      text not null check (char_length(btrim(texto)) between 3 and 500),
  pedido_por uuid references public.profiles(id) on delete set null,
  pedido_em  timestamptz not null default now(),
  ciente_por uuid references public.profiles(id) on delete set null,
  ciente_em  timestamptz
);
create index fabrica_alteracoes_abertas on public.fabrica_alteracoes (fabrica_id) where ciente_em is null;
alter table public.fabrica_alteracoes enable row level security;

create or replace function public.fabrica_garantir_linha(p_ref text)
returns bigint
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_pedido bigint;
  v_venda  uuid;
  v_avulso uuid;
  v_id     bigint;
begin
  if p_ref ~ '^[0-9]{1,12}$' then
    v_pedido := p_ref::bigint;
    if not exists (select 1 from public.tray_pedidos p where p.pedido = v_pedido and p.situacao = 'pago') then
      raise exception 'Só pedido pago entra na fábrica.' using errcode = '22023';
    end if;
  elsif p_ref ~ '^v[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_venda := substr(p_ref, 2)::uuid;
    -- Venda estornada só continua quando veio da Kommo e a fábrica já tinha começado (0176).
    if not exists (
      select 1 from public.vendas_producao vp join public.vendas_avulsas v on v.id = vp.venda
      where vp.venda = v_venda
        and (v.estornada_em is null
             or (exists (select 1 from public.fabrica_kommo fk where fk.venda = v_venda)
                 and exists (select 1 from public.fabrica_pedidos f where f.venda = v_venda and f.etapa <> 'a_produzir')))
    ) then
      raise exception 'Esta venda não está na fábrica.' using errcode = '22023';
    end if;
  elsif p_ref ~ '^a[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    -- OS aberta à mão (0192): a linha nasce junto com ela.
    v_avulso := substr(p_ref, 2)::uuid;
    select f.id into v_id from public.fabrica_pedidos f where f.avulso = v_avulso;
    if v_id is null then
      raise exception 'Esta OS não está na fábrica.' using errcode = '22023';
    end if;
    return v_id;
  else
    raise exception 'Pedido desconhecido.' using errcode = '22023';
  end if;

  select f.id into v_id from public.fabrica_pedidos f
  where (v_pedido is not null and f.pedido = v_pedido) or (v_venda is not null and f.venda = v_venda);

  if v_id is null then
    insert into public.fabrica_pedidos (pedido, venda, etapa, etapa_em)
    values (v_pedido, v_venda, 'a_produzir', now())
    returning id into v_id;
  end if;
  return v_id;
end
$$;

-- O movimento da OS aberta à mão guarda a origem dela.
create or replace function public.mover_na_fabrica(p_ref text, p_etapa text, p_rastreio text default null, p_nota text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_quem uuid := (select auth.uid());
  v_id   bigint;
  v_de   text;
  v_linha public.fabrica_pedidos;
begin
  if not coalesce(public.tem_acesso('fabrica'), false) then
    raise exception 'Seu acesso não inclui a fábrica.' using errcode = '42501';
  end if;
  if p_etapa is null or not exists (select 1 from public.fabrica_etapas e where e.chave = p_etapa and e.ativa) then
    raise exception 'Etapa desconhecida.' using errcode = '22023';
  end if;
  if char_length(coalesce(p_rastreio, '')) > 80 or char_length(coalesce(p_nota, '')) > 500 then
    raise exception 'Texto longo demais.' using errcode = '22023';
  end if;

  v_id := public.fabrica_garantir_linha(p_ref);
  select f.etapa into v_de from public.fabrica_pedidos f where f.id = v_id;

  update public.fabrica_pedidos f set
    etapa = p_etapa,
    etapa_em = case when f.etapa is distinct from p_etapa then now() else f.etapa_em end,
    rastreio = case when p_rastreio is null then f.rastreio else nullif(btrim(p_rastreio), '') end,
    nota = case when p_nota is null then f.nota else nullif(btrim(p_nota), '') end,
    atualizado_por = v_quem
  where f.id = v_id
  returning * into v_linha;

  if v_de is distinct from p_etapa then
    insert into public.fabrica_movimentos (pedido, venda, avulso, de, para, por)
    values (v_linha.pedido, v_linha.venda, v_linha.avulso, v_de, p_etapa, v_quem);
  end if;

  return jsonb_build_object('ok', true, 'de', v_de, 'para', p_etapa, 'os', v_linha.os);
end
$$;

-- Abre uma OS à mão. Quem vende e quem é da fábrica.
create or replace function public.fabrica_abrir_os(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_quem   uuid := (select auth.uid());
  v_tipo   text := coalesce(nullif(p->>'tipo', ''), 'troca');
  v_prio   text := coalesce(nullif(p->>'prioridade', ''), 'normal');
  v_prazo  date;
  v_origem bigint;
  v_tel    text := regexp_replace(coalesce(p->>'cliente_telefone', ''), '[^0-9]', '', 'g');
  v_pecas  jsonb := coalesce(p->'pecas', '[]'::jsonb);
  v_avulso uuid;
  v_linha  public.fabrica_pedidos;
begin
  if not coalesce(public.tem_acesso('lancar_venda') or public.tem_acesso('fabrica'), false) then
    raise exception 'Seu acesso não abre OS na fábrica.' using errcode = '42501';
  end if;
  if v_tipo not in ('venda_nova', 'troca', 'refazer', 'ajuste', 'upgrade', 'polimento', 'servico') then
    raise exception 'Tipo de trabalho desconhecido.' using errcode = '22023';
  end if;
  if v_prio not in ('normal', 'urgente', 'motoboy') then
    raise exception 'Prioridade desconhecida.' using errcode = '22023';
  end if;
  if jsonb_typeof(v_pecas) <> 'array' or jsonb_array_length(v_pecas) not between 1 and 8 then
    raise exception 'Diga de 1 a 8 peças.' using errcode = '22023';
  end if;
  if nullif(p->>'prazo', '') is not null then
    v_prazo := (p->>'prazo')::date;
    if v_prazo < (now() at time zone 'America/Sao_Paulo')::date or v_prazo > (now() at time zone 'America/Sao_Paulo')::date + 365 then
      raise exception 'O prazo precisa ser de hoje em diante.' using errcode = '22023';
    end if;
  end if;
  if nullif(p->>'pedido_origem', '') is not null then
    v_origem := (p->>'pedido_origem')::bigint;
    if not exists (select 1 from public.tray_pedidos t where t.pedido = v_origem) then
      raise exception 'O pedido % não está no painel.', v_origem using errcode = '22023';
    end if;
  end if;
  if v_tel <> '' then
    if v_tel !~ '^55' and char_length(v_tel) between 10 and 11 then v_tel := '55' || v_tel; end if;
    if v_tel !~ '^55[0-9]{10,11}$' then
      raise exception 'Telefone com DDD, só números.' using errcode = '22023';
    end if;
  end if;
  if v_origem is null and nullif(btrim(coalesce(p->>'cliente_nome', '')), '') is null then
    raise exception 'Diga o pedido de origem ou o nome do cliente.' using errcode = '22023';
  end if;

  insert into public.fabrica_avulsos (pedido_origem, cliente_nome, cliente_telefone, pecas, entrega, endereco, cidade, uf, relato, loja, numero_papel, criado_por)
  values (
    v_origem,
    coalesce(nullif(btrim(p->>'cliente_nome'), ''), (select t.cliente_nome from public.tray_pedidos t where t.pedido = v_origem)),
    coalesce(nullif(v_tel, ''), (select t.cliente_telefone from public.tray_pedidos t where t.pedido = v_origem and t.cliente_telefone ~ '^55[0-9]{10,11}$')),
    v_pecas,
    nullif(btrim(p->>'entrega'), ''),
    nullif(btrim(p->>'endereco'), ''),
    nullif(btrim(p->>'cidade'), ''),
    nullif(upper(btrim(p->>'uf')), ''),
    nullif(btrim(p->>'relato'), ''),
    nullif(btrim(p->>'loja'), ''),
    nullif(btrim(p->>'numero_papel'), ''),
    v_quem
  )
  returning id into v_avulso;

  insert into public.fabrica_pedidos (avulso, etapa, etapa_em, tipo, prioridade, prazo, atualizado_por)
  values (v_avulso, 'a_produzir', now(), v_tipo, v_prio, v_prazo, v_quem)
  returning * into v_linha;

  return jsonb_build_object('ok', true, 'ref', 'a' || v_avulso::text, 'os', v_linha.os);
end
$$;

-- O cliente pediu uma mudança: fica no cartão da fábrica até alguém dar ciência.
create or replace function public.fabrica_pedir_alteracao(p_ref text, p_texto text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_id bigint;
  v_al bigint;
begin
  if not coalesce(public.tem_acesso('lancar_venda') or public.tem_acesso('fabrica'), false) then
    raise exception 'Seu acesso não pede alteração na fábrica.' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_texto, ''))) not between 3 and 500 then
    raise exception 'Escreva a alteração em até 500 letras.' using errcode = '22023';
  end if;
  v_id := public.fabrica_garantir_linha(p_ref);
  insert into public.fabrica_alteracoes (fabrica_id, texto, pedido_por)
  values (v_id, btrim(p_texto), (select auth.uid()))
  returning id into v_al;
  return jsonb_build_object('ok', true, 'id', v_al);
end
$$;

create or replace function public.fabrica_ciente(p_id bigint)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
begin
  if not coalesce(public.tem_acesso('fabrica'), false) then
    raise exception 'Seu acesso não inclui a fábrica.' using errcode = '42501';
  end if;
  update public.fabrica_alteracoes set ciente_em = now(), ciente_por = (select auth.uid())
  where id = p_id and ciente_em is null;
  if not found then
    raise exception 'Esta alteração já tem ciência ou não existe.' using errcode = '22023';
  end if;
  return jsonb_build_object('ok', true);
end
$$;

create or replace function public.fila_da_fabrica(p_dias integer default 15)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  with pode as (select coalesce(public.tem_acesso('fabrica') or public.tem_acesso('lancar_venda') or public.tem_acesso('vendas'), false) as sim),
  dias as (select greatest(least(p_dias, 120), 1) as n, (now() at time zone 'America/Sao_Paulo')::date as hoje),
  finais as (select e.chave from public.fabrica_etapas e where e.papel = 'final'),
  -- Fora da janela, só fica o que a fábrica já pegou: nem na entrada, nem fora.
  pegou as (select chave from finais union all select 'a_produzir'),
  da_loja as (
    select
      p.pedido::text as ref, 'loja'::text as origem, p.pedido, p.dia, p.feito_em, p.status as status_da_loja,
      p.cliente_nome as cliente, p.cidade, p.uf, p.frete_tipo as entrega, null::text as endereco, null::text as vendedor,
      p.envio_codigo, p.itens,
      f.id as fid, null::bigint as pedido_origem, f.os, f.tipo, f.prioridade, f.prazo,
      f.etapa_em, f.rastreio, f.nota, f.atualizado_por,
      case
        when f.etapa in (select chave from finais) then f.etapa
        when upper(coalesce(p.status, '')) in ('ENVIADO', 'FINALIZADO', 'PROBLEMAS NA ENTREGA') then 'enviado'
        else coalesce(f.etapa, 'a_produzir')
      end as etapa,
      null::bigint as kommo, false as desfeito
    from public.tray_pedidos p
    left join public.fabrica_pedidos f on f.pedido = p.pedido
    cross join dias d
    where (select sim from pode)
      and p.situacao = 'pago'
      and (p.dia > d.hoje - d.n or (f.etapa is not null and f.etapa not in (select chave from pegou)))
  ),
  por_fora as (
    select
      'v' || v.id::text as ref, 'por_fora'::text as origem, null::bigint as pedido, v.dia, v.feita_em as feito_em, null::text as status_da_loja,
      v.cliente_nome as cliente, vp.cidade, vp.uf, vp.entrega, vp.endereco,
      (select nullif(split_part(coalesce(x.full_name, ''), ' ', 1), '') from public.profiles x where x.id = v.vendedor_id) as vendedor,
      null::text as envio_codigo, vp.pecas as itens,
      f.id as fid, null::bigint as pedido_origem, f.os, f.tipo, f.prioridade, f.prazo,
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
           or (fk.venda is not null and f.etapa is not null and f.etapa not in (select chave from pegou)))
      and (v.dia > d.hoje - d.n or (f.etapa is not null and f.etapa not in (select chave from pegou)))
  ),
  avulsos as (
    select
      'a' || a.id::text as ref, 'avulso'::text as origem, null::bigint as pedido,
      ((a.criado_em at time zone 'America/Sao_Paulo')::date) as dia, a.criado_em as feito_em, null::text as status_da_loja,
      a.cliente_nome as cliente, a.cidade, a.uf, a.entrega, a.endereco,
      (select nullif(split_part(coalesce(x.full_name, ''), ' ', 1), '') from public.profiles x where x.id = a.criado_por) as vendedor,
      null::text as envio_codigo, a.pecas as itens,
      f.id as fid, a.pedido_origem, f.os, f.tipo, f.prioridade, f.prazo,
      f.etapa_em, f.rastreio, f.nota, f.atualizado_por,
      f.etapa,
      null::bigint as kommo, false as desfeito
    from public.fabrica_avulsos a
    join public.fabrica_pedidos f on f.avulso = a.id
    cross join dias d
    where (select sim from pode)
      and (((a.criado_em at time zone 'America/Sao_Paulo')::date) > d.hoje - d.n or f.etapa not in (select chave from pegou))
  ),
  janela as (select * from da_loja union all select * from por_fora union all select * from avulsos),
  -- O que entrou só por ter linha antiga e já saiu não precisa aparecer.
  visiveis as (
    select j.* from janela j cross join dias d
    where j.etapa not in (select chave from finais) or j.dia > d.hoje - d.n
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
      (select pr.full_name from public.profiles pr where pr.id = v.atualizado_por) as movido_por,
      (select coalesce(jsonb_agg(jsonb_build_object(
          'id', al.id, 'texto', al.texto, 'em', al.pedido_em,
          'por', (select split_part(coalesce(x.full_name, ''), ' ', 1) from public.profiles x where x.id = al.pedido_por),
          'ciente_em', al.ciente_em,
          'ciente_por', (select split_part(coalesce(x.full_name, ''), ' ', 1) from public.profiles x where x.id = al.ciente_por)
        ) order by al.pedido_em), '[]'::jsonb)
       from public.fabrica_alteracoes al where al.fabrica_id = v.fid) as alteracoes
    from visiveis v
  )
  select jsonb_build_object(
    'dias', (select n from dias),
    'pode_mover', coalesce(public.tem_acesso('fabrica'), false),
    'etapas', case when (select sim from pode) then (
      select coalesce(jsonb_agg(jsonb_build_object(
        'chave', e.chave, 'nome', e.nome, 'frase', e.frase, 'cor', e.cor, 'ativa', e.ativa, 'papel', e.papel
      ) order by e.ordem), '[]'::jsonb) from public.fabrica_etapas e) else '[]'::jsonb end,
    'pedidos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'ref', ref,
        'origem', origem,
        'pedido', pedido,
        'pedido_origem', pedido_origem,
        'os', os,
        'tipo', coalesce(tipo, 'venda_nova'),
        'prioridade', coalesce(prioridade, 'normal'),
        'prazo', prazo,
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
        'desfeito_na_kommo', desfeito,
        'alteracoes', alteracoes
      ) order by feito_em)
      from pronto
    ), '[]'::jsonb)
  )
$$;

revoke all on function public.fabrica_garantir_linha(text) from public, anon, authenticated;
revoke all on function public.fabrica_abrir_os(jsonb) from public, anon;
revoke all on function public.fabrica_pedir_alteracao(text, text) from public, anon;
revoke all on function public.fabrica_ciente(bigint) from public, anon;
grant execute on function public.fabrica_abrir_os(jsonb) to authenticated;
grant execute on function public.fabrica_pedir_alteracao(text, text) to authenticated;
grant execute on function public.fabrica_ciente(bigint) to authenticated;
