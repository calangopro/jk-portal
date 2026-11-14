-- 0067: a fila da fábrica.
--
-- O pedido pago na loja vira trabalho para a fábrica: produzir, deixar pronto e
-- enviar. Até aqui isso andava fora do painel, e o status da Tray não serve de
-- controle: em 14/11/2026 havia 271 pedidos pagos como "A ENVIAR", 117 deles de
-- setembro. A etapa de produção passa a morar aqui.
--
-- TRÊS DECISÕES:
--
-- 1. A fila é CONTA, não cópia. Pedido pago sem linha em `fabrica_pedidos` está
--    em "a produzir" por definição. A linha só nasce quando alguém move o
--    pedido. Assim pedido novo entra na fila sozinho, na importação seguinte,
--    sem rotina para criar linha.
--
-- 2. A fábrica NÃO lê `tray_pedidos`. Aquela tabela é faturamento, e a policy
--    dela pede a área de vendas. A fila sai de uma função `security definer`
--    que confere a área `fabrica` por dentro e devolve só o que a produção
--    precisa: número, data, nome do cliente, entrega e os itens SEM preço nem
--    custo. É o mesmo desenho da fila de recuperação (0056).
--
-- 3. Enviado é o que QUALQUER um dos dois lados disser. Se a Tray marcou o
--    pedido como enviado ou finalizado, ele sai da produção mesmo sem ninguém
--    ter mexido aqui; se a fábrica marcou como enviado, vale mesmo com a Tray
--    atrasada.

create table public.fabrica_pedidos (
  pedido         bigint primary key references public.tray_pedidos (pedido) on delete cascade,
  etapa          text not null check (etapa in ('a_produzir', 'em_producao', 'pronto', 'enviado')),
  etapa_em       timestamptz not null default now(),
  rastreio       text check (char_length(rastreio) <= 80),
  nota           text check (char_length(nota) <= 500),
  atualizado_por uuid references public.profiles (id) on delete set null,
  criado_em      timestamptz not null default now()
);

comment on table public.fabrica_pedidos is
  'A etapa de produção de cada pedido pago. Pedido sem linha está em "a produzir".';
comment on column public.fabrica_pedidos.etapa_em is
  'Quando o pedido entrou na etapa atual. Só muda quando a etapa muda.';

create table public.fabrica_movimentos (
  id     bigint generated always as identity primary key,
  pedido bigint not null references public.tray_pedidos (pedido) on delete cascade,
  de     text not null check (de in ('a_produzir', 'em_producao', 'pronto', 'enviado')),
  para   text not null check (para in ('a_produzir', 'em_producao', 'pronto', 'enviado')),
  por    uuid references public.profiles (id) on delete set null,
  em     timestamptz not null default now()
);

comment on table public.fabrica_movimentos is
  'Cada mudança de etapa: de onde saiu, para onde foi, quem moveu e quando.';

create index fabrica_pedidos_etapa_idx on public.fabrica_pedidos (etapa, etapa_em);
create index fabrica_pedidos_quem_idx on public.fabrica_pedidos (atualizado_por);
create index fabrica_movimentos_pedido_idx on public.fabrica_movimentos (pedido, em desc);
create index fabrica_movimentos_quem_idx on public.fabrica_movimentos (por);

alter table public.fabrica_pedidos enable row level security;
alter table public.fabrica_movimentos enable row level security;

-- Leitura para quem tem a área. Escrita, nenhuma: quem grava é a função abaixo.
create policy fabrica_pedidos_select on public.fabrica_pedidos
  for select to authenticated using ((select public.tem_acesso('fabrica')));
create policy fabrica_movimentos_select on public.fabrica_movimentos
  for select to authenticated using ((select public.tem_acesso('fabrica')));

revoke all on public.fabrica_pedidos from anon;
revoke all on public.fabrica_movimentos from anon;

-- ------------------------------------------------------------------ a fila

/**
 * Os pedidos da produção, da etapa "a produzir" até "enviado".
 *
 * Entram: todo pedido que a fábrica já moveu e ainda não enviou (esse nunca
 * some, por mais velho que seja), e os pedidos pagos dos últimos `p_dias`.
 * O pedido antigo que a Tray ainda mostra como "A ENVIAR" e ninguém moveu fica
 * de fora da janela: sem isso a fila nasceria com centenas de pedidos de meses
 * atrás que já foram entregues.
 */
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
          'info', i->>'info'
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

revoke execute on function public.fila_da_fabrica(integer) from public, anon;
grant execute on function public.fila_da_fabrica(integer) to authenticated;

-- ------------------------------------------------------------------ mover

/**
 * Move um pedido de etapa. É a ÚNICA porta de escrita: confere a área, exige
 * pedido pago, guarda quem moveu e deixa o movimento no histórico.
 *
 * `p_rastreio` e `p_nota` nulos não mexem no que já está gravado; texto vazio
 * apaga.
 */
create or replace function public.mover_pedido_da_fabrica(
  p_pedido bigint,
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
  v_quem uuid := (select auth.uid());
  v_de text;
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
  if not exists (select 1 from public.tray_pedidos p where p.pedido = p_pedido and p.situacao = 'pago') then
    raise exception 'Só pedido pago entra na fábrica.' using errcode = '22023';
  end if;

  select f.etapa into v_de from public.fabrica_pedidos f where f.pedido = p_pedido;

  insert into public.fabrica_pedidos as f (pedido, etapa, etapa_em, rastreio, nota, atualizado_por)
  values (p_pedido, p_etapa, now(), nullif(btrim(p_rastreio), ''), nullif(btrim(p_nota), ''), v_quem)
  on conflict (pedido) do update set
    etapa = excluded.etapa,
    etapa_em = case when f.etapa is distinct from excluded.etapa then now() else f.etapa_em end,
    rastreio = case when p_rastreio is null then f.rastreio else nullif(btrim(p_rastreio), '') end,
    nota = case when p_nota is null then f.nota else nullif(btrim(p_nota), '') end,
    atualizado_por = v_quem;

  if coalesce(v_de, 'a_produzir') is distinct from p_etapa then
    insert into public.fabrica_movimentos (pedido, de, para, por)
    values (p_pedido, coalesce(v_de, 'a_produzir'), p_etapa, v_quem);
  end if;

  return jsonb_build_object('ok', true, 'de', coalesce(v_de, 'a_produzir'), 'para', p_etapa);
end
$$;

revoke execute on function public.mover_pedido_da_fabrica(bigint, text, text, text) from public, anon;
grant execute on function public.mover_pedido_da_fabrica(bigint, text, text, text) to authenticated;
