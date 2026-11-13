-- Vendas por fora da loja: o que o vendedor fecha no WhatsApp e não vira pedido na Tray.
--
-- POR QUE
--
-- Perto de um quarto do faturamento do e-commerce não passava por lugar
-- nenhum: o cliente pagava por Pix direto, o registro era uma planilha com uma
-- aba por dia, e na Kommo aparecia menos da metade. Sem isso o painel mostra
-- só a loja, a meta fica incompleta e não dá para acompanhar vendedor.
--
-- COMO
--
-- `vendas_avulsas` guarda cada venda fechada fora da Tray, com quem vendeu.
-- Ninguém grava direto na tabela: tudo passa por `registrar_venda_avulsa`, que
-- confere o acesso e a DUPLICIDADE antes de gravar:
--   repetida     mesmo telefone e mesmo valor em dia vizinho, já lançada;
--   ja_na_loja   mesmo telefone e mesmo valor num pedido PAGO da Tray, que já
--                está no faturamento da loja.
-- Quem lança pode insistir (duas vendas iguais existem), e aí a venda fica
-- marcada para conferência em vez de entrar calada.
--
-- Venda não se apaga, se estorna: fica na tabela com a hora e o autor do
-- estorno e sai de toda soma.
--
-- O vendedor lê só as próprias vendas. Quem tem a área de vendas lê todas.
-- A fila de recuperação passa a tirar sozinha o cliente que pagou por fora,
-- e a dizer quem está cuidando de cada caso.

alter table public.acessos_por_papel drop constraint acessos_por_papel_area_check;
alter table public.acessos_por_papel add constraint acessos_por_papel_area_check check (area in (
  'conteudo', 'site', 'catalogo', 'campanhas', 'vendas', 'recuperacao',
  'metricas', 'anuncios', 'margem', 'custos', 'equipe', 'fabrica', 'lancar_venda'));

insert into public.acessos_por_papel (papel, area)
select p, 'lancar_venda' from unnest(array['admin', 'dono', 'gm', 'gerente', 'vendas']) as p;

create table public.vendas_avulsas (
  id                uuid primary key default gen_random_uuid(),
  feita_em          timestamptz not null default now(),
  dia               date not null,
  vendedor_id       uuid not null references public.profiles (id),
  valor             numeric(12, 2) not null check (valor > 0),
  forma             text not null check (forma in ('pix', 'link_de_pagamento', 'cartao', 'dinheiro', 'outro')),
  canal             text not null check (canal in ('whatsapp', 'instagram', 'loja_fisica', 'indicacao', 'recuperacao', 'outro')),
  cliente_nome      text check (char_length(cliente_nome) <= 160),
  cliente_telefone  text check (cliente_telefone ~ '^55[0-9]{10,11}$'),
  produto           text check (char_length(produto) <= 300),
  pedido_recuperado bigint references public.tray_pedidos (pedido),
  observacao        text check (char_length(observacao) <= 500),
  conferir          text check (char_length(conferir) <= 200),
  estornada_em      timestamptz,
  estornada_por     uuid references public.profiles (id) on delete set null,
  lancada_por       uuid references public.profiles (id) on delete set null,
  criada_em         timestamptz not null default now()
);

comment on table public.vendas_avulsas is
  'Vendas fechadas fora da loja Tray. Gravação só por registrar_venda_avulsa(); estorno só por estornar_venda_avulsa().';
comment on column public.vendas_avulsas.conferir is
  'Preenchido quando a venda foi lançada mesmo parecendo repetida: diz com o quê ela se parece.';

create index vendas_avulsas_dia_idx on public.vendas_avulsas (dia desc);
create index vendas_avulsas_vendedor_idx on public.vendas_avulsas (vendedor_id, dia desc);
create index vendas_avulsas_telefone_idx on public.vendas_avulsas (cliente_telefone) where cliente_telefone is not null;
create index vendas_avulsas_estornada_por_idx on public.vendas_avulsas (estornada_por);
create index vendas_avulsas_lancada_por_idx on public.vendas_avulsas (lancada_por);
create index vendas_avulsas_pedido_idx on public.vendas_avulsas (pedido_recuperado) where pedido_recuperado is not null;

alter table public.vendas_avulsas enable row level security;

create policy vendas_avulsas_select on public.vendas_avulsas
  for select to authenticated
  using (vendedor_id = (select auth.uid()) or (select public.tem_acesso('vendas')));

revoke all on public.vendas_avulsas from anon;

create function public.registrar_venda_avulsa(
  p_valor numeric,
  p_forma text,
  p_canal text,
  p_cliente_nome text default null,
  p_telefone text default null,
  p_produto text default null,
  p_observacao text default null,
  p_dia date default null,
  p_vendedor uuid default null,
  p_pedido_recuperado bigint default null,
  p_forcar boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu       uuid := (select auth.uid());
  v_hoje     date := (now() at time zone 'America/Sao_Paulo')::date;
  v_dia      date;
  v_vendedor uuid;
  v_conferir text;
  v_achado   record;
  v_id       uuid;
begin
  if v_eu is null or not public.tem_acesso('lancar_venda') then
    return jsonb_build_object('ok', false, 'motivo', 'sem_acesso');
  end if;
  if p_valor is null or p_valor <= 0 then
    return jsonb_build_object('ok', false, 'motivo', 'valor');
  end if;

  -- Só quem vê todas as vendas lança em nome de outra pessoa.
  v_vendedor := case when p_vendedor is not null and public.tem_acesso('vendas') then p_vendedor else v_eu end;
  -- Dia retroativo de até 31 dias, para a planilha antiga poder entrar. Fora disso, hoje.
  v_dia := case when p_dia between v_hoje - 31 and v_hoje then p_dia else v_hoje end;

  if p_telefone is not null then
    select 'venda de ' || coalesce(split_part(p.full_name, ' ', 1), 'outra pessoa') || ' em ' || to_char(v.dia, 'DD/MM') as texto
      into v_achado
    from public.vendas_avulsas v
    left join public.profiles p on p.id = v.vendedor_id
    where v.estornada_em is null and v.cliente_telefone = p_telefone and v.valor = p_valor
      and v.dia between v_dia - 1 and v_dia + 1
    limit 1;
    if found then
      if not p_forcar then return jsonb_build_object('ok', false, 'motivo', 'repetida', 'parecida_com', v_achado.texto); end if;
      v_conferir := 'Parecida com ' || v_achado.texto;
    else
      select 'pedido ' || t.pedido || ' da loja, de ' || to_char(t.dia, 'DD/MM') as texto
        into v_achado
      from public.tray_pedidos t
      where t.situacao = 'pago' and t.cliente_telefone = p_telefone and abs(t.total - p_valor) < 0.01
        and t.dia between v_dia - 2 and v_dia + 2
      limit 1;
      if found then
        if not p_forcar then return jsonb_build_object('ok', false, 'motivo', 'ja_na_loja', 'parecida_com', v_achado.texto); end if;
        v_conferir := 'Parecida com o ' || v_achado.texto;
      end if;
    end if;
  end if;

  insert into public.vendas_avulsas (
    dia, vendedor_id, valor, forma, canal, cliente_nome, cliente_telefone, produto,
    pedido_recuperado, observacao, conferir, lancada_por
  ) values (
    v_dia, v_vendedor, round(p_valor, 2), p_forma, p_canal, nullif(btrim(p_cliente_nome), ''), p_telefone,
    nullif(btrim(p_produto), ''), p_pedido_recuperado, nullif(btrim(p_observacao), ''), v_conferir, v_eu
  )
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'conferir', v_conferir);
end;
$$;

-- O vendedor estorna a própria venda de hoje ou de ontem. Depois disso, só quem vê todas.
create function public.estornar_venda_avulsa(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu   uuid := (select auth.uid());
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  update public.vendas_avulsas v
  set estornada_em = now(), estornada_por = v_eu
  where v.id = p_id and v.estornada_em is null
    and (public.tem_acesso('vendas') or (v.vendedor_id = v_eu and v.dia >= v_hoje - 1));
  return found;
end;
$$;

-- Resumo do que foi vendido por fora no intervalo. Roda com os direitos de quem
-- chama: o vendedor recebe só as próprias vendas, e quem tem a área de vendas
-- recebe todas, com o total de cada vendedor.
create function public.resumo_por_fora(p_de date, p_ate date)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with base as (
    select v.*, coalesce(split_part(p.full_name, ' ', 1), 'Sem nome') as vendedor
    from public.vendas_avulsas v
    left join public.profiles p on p.id = v.vendedor_id
    where v.dia between p_de and p_ate and v.estornada_em is null
  )
  select jsonb_build_object(
    'vendas', (select count(*) from base),
    'valor', (select coalesce(sum(valor), 0) from base),
    'a_conferir', (select count(*) from base where conferir is not null),
    'por_vendedor', coalesce((
      select jsonb_agg(l order by (l->>'valor')::numeric desc)
      from (
        select jsonb_build_object(
          'vendedor_id', vendedor_id, 'vendedor', max(vendedor), 'vendas', count(*), 'valor', sum(valor),
          'recuperadas', count(*) filter (where canal = 'recuperacao' or pedido_recuperado is not null),
          'valor_recuperado', coalesce(sum(valor) filter (where canal = 'recuperacao' or pedido_recuperado is not null), 0)
        ) as l
        from base group by vendedor_id
      ) x
    ), '[]'::jsonb),
    'por_dia', coalesce((
      select jsonb_agg(l order by l->>'dia')
      from (select jsonb_build_object('dia', dia, 'vendas', count(*), 'valor', sum(valor)) as l from base group by dia) x
    ), '[]'::jsonb),
    'por_forma', coalesce((
      select jsonb_agg(l order by (l->>'valor')::numeric desc)
      from (select jsonb_build_object('forma', forma, 'vendas', count(*), 'valor', sum(valor)) as l from base group by forma) x
    ), '[]'::jsonb),
    'ultimas', coalesce((
      select jsonb_agg(l order by (l->>'feita_em') desc)
      from (
        select jsonb_build_object(
          'id', id, 'feita_em', feita_em, 'dia', dia, 'vendedor', vendedor, 'valor', valor, 'forma', forma,
          'canal', canal, 'cliente', cliente_nome, 'produto', produto, 'conferir', conferir
        ) as l
        from base order by feita_em desc limit 40
      ) x
    ), '[]'::jsonb)
  );
$$;

revoke execute on function public.registrar_venda_avulsa(numeric, text, text, text, text, text, text, date, uuid, bigint, boolean) from public, anon;
revoke execute on function public.estornar_venda_avulsa(uuid) from public, anon;
revoke execute on function public.resumo_por_fora(date, date) from public, anon;
grant execute on function public.registrar_venda_avulsa(numeric, text, text, text, text, text, text, date, uuid, bigint, boolean) to authenticated, service_role;
grant execute on function public.estornar_venda_avulsa(uuid) to authenticated, service_role;
grant execute on function public.resumo_por_fora(date, date) to authenticated, service_role;

-- A fila passa a tirar sozinha quem pagou por fora (pela venda lançada com o
-- mesmo telefone, ou ligada ao pedido) e a dizer quem está cuidando do caso.
create or replace function public.fila_de_recuperacao(p_dias integer default 14)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with janela as (
    select p.*, coalesce(p.cliente_telefone, p.cliente_email, p.cliente_codigo) as cliente
    from public.tray_pedidos p
    where p.dia > (now() at time zone 'America/Sao_Paulo')::date - greatest(least(p_dias, 90), 1)
      and public.tem_acesso('recuperacao')
  ),
  por_cliente as (
    select
      cliente,
      count(*) as tentativas,
      min(feito_em) as primeira,
      max(feito_em) as ultima,
      max(total) as maior_valor,
      (array_agg(pedido order by feito_em desc))[1] as pedido_ref,
      max(cliente_telefone) as telefone_cliente,
      array_agg(pedido) as pedidos
    from janela
    where situacao in ('cancelado', 'aguardando') and cliente is not null
    group by cliente
  ),
  casos as (
    select
      c.pedido_ref as pedido,
      c.tentativas,
      c.primeira,
      c.ultima,
      c.maior_valor,
      r.cliente_nome as cliente,
      r.cliente_telefone as telefone,
      r.cliente_email as email,
      r.cidade,
      r.uf,
      r.status,
      (r.situacao = 'aguardando') as aguardando,
      r.pagamento_tipo as pagamento,
      coalesce(r.utm_source, '') as origem,
      (
        select string_agg(i.nome, ' + ')
        from jsonb_to_recordset(coalesce(r.itens, '[]'::jsonb)) as i(nome text, preco numeric)
        where coalesce(i.preco, 0) > 0
      ) as itens,
      pg.pedido as pago_pedido,
      pg.total as pago_valor,
      pg.feito_em as pago_em,
      e.nota,
      coalesce(av.valor, e.valor_fora) as valor_fora,
      e.atualizado_em as estado_em,
      coalesce(av.quem, e.quem) as quem,
      case
        when pg.pedido is not null then 'recuperado'
        when av.valor is not null then 'pago_por_fora'
        when e.estado in ('em_contato', 'pago_por_fora', 'descartado') then e.estado
        else 'a_recuperar'
      end as fase
    from por_cliente c
    join public.tray_pedidos r on r.pedido = c.pedido_ref
    left join lateral (
      select q.pedido, q.total, q.feito_em
      from public.tray_pedidos q
      where coalesce(q.cliente_telefone, q.cliente_email, q.cliente_codigo) = c.cliente
        and q.situacao = 'pago'
        and q.feito_em >= c.primeira - interval '2 hours'
      order by q.feito_em
      limit 1
    ) pg on true
    left join lateral (
      select s.estado, s.nota, s.valor_fora, s.atualizado_em,
             (select split_part(p.full_name, ' ', 1) from public.profiles p where p.id = s.atualizado_por) as quem
      from public.recuperacao_casos s
      where s.pedido = any (c.pedidos)
      order by s.atualizado_em desc
      limit 1
    ) e on true
    left join lateral (
      select v.valor,
             (select split_part(p.full_name, ' ', 1) from public.profiles p where p.id = v.vendedor_id) as quem
      from public.vendas_avulsas v
      where v.estornada_em is null
        and (
          v.pedido_recuperado = any (c.pedidos)
          or (c.telefone_cliente is not null and v.cliente_telefone = c.telefone_cliente
              and v.feita_em >= c.primeira - interval '2 hours')
        )
      order by v.feita_em
      limit 1
    ) av on true
  ),
  com_valor as (
    select
      casos.*,
      case fase
        when 'recuperado' then pago_valor
        when 'pago_por_fora' then valor_fora
        else maior_valor
      end as valor
    from casos
  )
  select jsonb_build_object(
    'dias', greatest(least(p_dias, 90), 1),
    'resumo', coalesce((
      select jsonb_object_agg(fase, jsonb_build_object('clientes', clientes, 'valor', valor))
      from (
        select fase, count(*) as clientes, coalesce(sum(valor), 0) as valor
        from com_valor
        group by fase
      ) t
    ), '{}'::jsonb),
    'casos', coalesce((
      select jsonb_agg(to_jsonb(l) order by l.valor desc, l.ultima desc)
      from (select * from com_valor order by valor desc limit 400) l
    ), '[]'::jsonb)
  );
$$;
