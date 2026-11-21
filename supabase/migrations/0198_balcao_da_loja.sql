-- 0198: o balcão da loja física (cartão 71).
--
-- POR QUE
--
-- Em 20/11/2026 a JK pagava 13 usuários na Kommo, a maioria das lojas, e o
-- espelho mostrou que nenhuma loja fechou um negócio lá em 30 dias: a loja
-- usa a Kommo para anotar a venda do balcão (funil LOJA | PDV, etapa
-- Lançamento) e para lead. O pedido em si (sinal, saldo, retirada, a OS de
-- papel) mora no papel e no grupo. Esta migration dá à loja o lugar de anotar
-- o pedido inteiro no painel, e a fase 2 (cartão 72) leva pedido e lead para a
-- Kommo com a tag da loja.
--
-- O DESENHO
--
-- Nível novo `loja`: UMA conta por loja (o celular ou tablet do balcão), com
-- `profiles.loja` preenchido (0195). Quem atendeu é escolhido em cada pedido,
-- numa lista de vendedores da loja (`loja_vendedores`) que a própria loja e a
-- gerência mantêm: vendedor de loja troca muito e nem sempre tem conta no
-- painel. Fora de `is_staff()` e do conector, como vendas e fábrica.
--
-- Área nova `balcao`: loja, gerente e diretoria. Quem tem loja no perfil só vê
-- e mexe nos pedidos da própria loja; quem não tem (gerência geral, diretoria)
-- vê todas e escolhe a loja ao lançar.
--
-- Três tabelas, com RLS ligada e SEM policy: tudo passa pelas funções abaixo,
-- que conferem a área e a loja por dentro.
--   loja_pedidos     o pedido: cliente, peças (no formato da fábrica), total,
--                    entrega, prazo prometido, foto do papel, e as marcas de
--                    fábrica, chegada na loja, entrega e cancelamento.
--   loja_pagamentos  cada dinheiro que entrou (sinal, parcela, saldo), com
--                    forma, parcelas e comprovante. Estorna, não apaga.
--   loja_anexos      comprovante, documento e foto, no balde privado
--                    `loja-pedidos`, na pasta do pedido.
--
-- O id do pedido nasce no NAVEGADOR (uuid), antes de salvar: é o que deixa a
-- loja anexar o comprovante enquanto ainda preenche, com internet ruim, e
-- salvar tudo de uma vez. O caminho do anexo começa pelo id, e o banco confere
-- que o arquivo existe no balde antes de aceitar.
--
-- A FÁBRICA
--
-- "Mandar para a fábrica" abre a OS pelo mesmo lugar das OS manuais
-- (`fabrica_avulsos` mais `fabrica_pedidos`, tipo venda nova), com o pedido
-- ligado em `fabrica_avulsos.loja_pedido`. A fila, o quadro, a alteração e a
-- garantia já funcionam com isso, sem mudar uma linha. A fábrica nunca vê
-- valor: o relato leva o número do pedido e quem vendeu, e só.
--
-- A ORDEM IMPORTA (armadilha da 0056): ninguém vira `loja` antes de o código
-- que conhece o nível estar no ar.

-- ------------------------------------------------------------------ o nível

alter type public.app_role add value if not exists 'loja';

alter table public.acessos_por_papel drop constraint acessos_por_papel_papel_check;
alter table public.acessos_por_papel
  add constraint acessos_por_papel_papel_check
  check (papel = any (array['admin', 'dono', 'gm', 'gerente', 'trafego', 'vendas', 'fabrica', 'editor', 'reviewer', 'author', 'social', 'loja']));

-- A trava de áreas é refeita a partir da que está no banco (molde da 0102 e da 0141).
do $$
declare
  v_def text;
  v_areas text[];
begin
  select pg_get_constraintdef(c.oid) into v_def
  from pg_constraint c
  where c.conname = 'acessos_por_papel_area_check' and c.conrelid = 'public.acessos_por_papel'::regclass;
  select array_agg(t.m[1] order by t.n) into v_areas
  from regexp_matches(v_def, '''([a-z_]+)''', 'g') with ordinality as t (m, n);
  if v_areas is null or cardinality(v_areas) < 10 then
    raise exception 'A trava de áreas não foi lida como esperado: %', v_def;
  end if;
  if not ('balcao' = any (v_areas)) then
    v_areas := v_areas || 'balcao'::text;
  end if;
  alter table public.acessos_por_papel drop constraint acessos_por_papel_area_check;
  execute format('alter table public.acessos_por_papel add constraint acessos_por_papel_area_check check (area in (%s))',
    (select string_agg(quote_literal(a), ', ' order by n) from unnest(v_areas) with ordinality as u (a, n)));
end
$$;

insert into public.acessos_por_papel (papel, area, liberado)
values
  ('loja', 'balcao', true), ('loja', 'time', true), ('loja', 'consulta', true),
  ('gerente', 'balcao', true), ('admin', 'balcao', true), ('dono', 'balcao', true), ('gm', 'balcao', true)
on conflict (papel, area) do update set liberado = excluded.liberado;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active and p.role::text not in ('vendas', 'fabrica', 'social', 'loja')
  );
$function$;

-- ------------------------------------------------------------------ tabelas

create table public.loja_vendedores (
  id uuid primary key default gen_random_uuid(),
  loja text not null check (char_length(loja) between 2 and 60),
  nome text not null check (char_length(btrim(nome)) between 2 and 60),
  ativo boolean not null default true,
  criado_por uuid references auth.users (id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index loja_vendedores_nome_unico on public.loja_vendedores (loja, lower(btrim(nome)));
alter table public.loja_vendedores enable row level security;

create table public.loja_pedidos (
  id uuid primary key,
  numero bigint generated always as identity unique,
  loja text not null check (char_length(loja) between 2 and 60),
  vendedor uuid not null references public.loja_vendedores (id),
  cliente_nome text not null check (char_length(btrim(cliente_nome)) between 2 and 120),
  cliente_telefone text not null check (cliente_telefone ~ '^55[0-9]{10,11}$'),
  cliente_email text check (cliente_email is null or (char_length(cliente_email) <= 160 and cliente_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  motivo text check (motivo is null or motivo in ('namoro', 'noivado', 'casamento', 'bodas', 'presente', 'outro')),
  data_especial date,
  -- As peças no formato da fábrica ({nome, quantidade, info, produto_tray_id}),
  -- e o formulário cru, para a loja reabrir o pedido exatamente como deixou.
  pecas jsonb not null check (jsonb_typeof(pecas) = 'array' and jsonb_array_length(pecas) between 1 and 8),
  formulario jsonb,
  entrega text not null check (entrega in ('retirada', 'correios', 'moto', 'a_combinar')),
  entrega_texto text check (entrega_texto is null or char_length(entrega_texto) <= 160),
  endereco text check (endereco is null or char_length(endereco) <= 300),
  cidade text check (cidade is null or char_length(cidade) <= 80),
  uf text check (uf is null or uf ~ '^[A-Z]{2}$'),
  prazo date,
  total numeric(12, 2) not null check (total > 0 and total < 1000000),
  observacao text check (observacao is null or char_length(observacao) <= 1000),
  numero_papel text check (numero_papel is null or char_length(numero_papel) <= 30),
  fotos text[] not null default '{}',
  transcricao text check (transcricao is null or char_length(transcricao) <= 8000),
  fabrica_em timestamptz,
  fabrica_por uuid references auth.users (id),
  recebido_em timestamptz,
  recebido_por uuid references auth.users (id),
  entregue_em timestamptz,
  entregue_por uuid references auth.users (id),
  cancelado_em timestamptz,
  cancelado_por uuid references auth.users (id),
  cancelado_motivo text check (cancelado_motivo is null or char_length(cancelado_motivo) <= 300),
  criado_por uuid not null references auth.users (id),
  criado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users (id),
  atualizado_em timestamptz not null default now()
);
create index loja_pedidos_loja_criado on public.loja_pedidos (loja, criado_em desc);
create index loja_pedidos_telefone on public.loja_pedidos (cliente_telefone);
alter table public.loja_pedidos enable row level security;

create table public.loja_pagamentos (
  id uuid primary key default gen_random_uuid(),
  pedido uuid not null references public.loja_pedidos (id),
  valor numeric(12, 2) not null check (valor > 0 and valor < 1000000),
  forma text not null check (forma in ('pix', 'credito', 'debito', 'dinheiro', 'link', 'outro')),
  parcelas smallint not null default 1 check (parcelas between 1 and 24),
  pago_em date not null,
  comprovante text,
  criado_por uuid not null references auth.users (id),
  criado_em timestamptz not null default now(),
  estornado_em timestamptz,
  estornado_por uuid references auth.users (id),
  estornado_motivo text check (estornado_motivo is null or char_length(estornado_motivo) <= 300)
);
create index loja_pagamentos_pedido on public.loja_pagamentos (pedido);
alter table public.loja_pagamentos enable row level security;

create table public.loja_anexos (
  id uuid primary key default gen_random_uuid(),
  pedido uuid not null references public.loja_pedidos (id),
  caminho text not null unique,
  tipo text not null check (tipo in ('comprovante', 'documento', 'foto')),
  nome text check (nome is null or char_length(nome) <= 120),
  criado_por uuid not null references auth.users (id),
  criado_em timestamptz not null default now(),
  tirado_em timestamptz,
  tirado_por uuid references auth.users (id)
);
create index loja_anexos_pedido on public.loja_anexos (pedido);
alter table public.loja_anexos enable row level security;

alter table public.fabrica_avulsos add column loja_pedido uuid unique references public.loja_pedidos (id);

-- O balde dos anexos: privado, só por link assinado, 10 MB, imagem e PDF.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('loja-pedidos', 'loja-pedidos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- ------------------------------------------------------------------ apoio

-- Quem pode mexer no balcão de qual loja. Com loja no perfil: só a dela.
-- Sem loja: todas (gerência geral e diretoria).
create or replace function public.balcao_pode(p_loja text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce(public.tem_acesso('balcao'), false)
     and (public.minha_loja() is null or public.minha_loja() = p_loja)
$$;

create or replace function public.balcao_hoje()
returns date
language sql
stable
set search_path to ''
as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;

-- Telefone no formato da casa: 55 mais DDD e número. Nulo quando não dá.
create or replace function public.balcao_telefone(p text)
returns text
language plpgsql
immutable
set search_path to ''
as $$
declare v text := regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g');
begin
  if v !~ '^55' and char_length(v) between 10 and 11 then v := '55' || v; end if;
  if v ~ '^55[0-9]{10,11}$' then return v; end if;
  return null;
end
$$;

-- Um pedido, montado para a tela: com o que foi pago, o saldo, a etapa da
-- fábrica, os pagamentos e os anexos. Só chamada por dentro das funções que
-- já conferiram o acesso.
create or replace function public.balcao_montar(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  select jsonb_build_object(
    'id', p.id, 'numero', p.numero, 'loja', p.loja,
    'vendedor', p.vendedor, 'vendedor_nome', v.nome,
    'cliente_nome', p.cliente_nome, 'cliente_telefone', p.cliente_telefone, 'cliente_email', p.cliente_email,
    'motivo', p.motivo, 'data_especial', p.data_especial,
    'pecas', p.pecas, 'formulario', p.formulario,
    'entrega', p.entrega, 'entrega_texto', p.entrega_texto, 'endereco', p.endereco, 'cidade', p.cidade, 'uf', p.uf,
    'prazo', p.prazo, 'total', p.total, 'observacao', p.observacao, 'numero_papel', p.numero_papel,
    'fotos', to_jsonb(p.fotos), 'transcricao', p.transcricao,
    'pago', coalesce(pg.pago, 0),
    'fabrica_em', p.fabrica_em, 'recebido_em', p.recebido_em, 'entregue_em', p.entregue_em,
    'cancelado_em', p.cancelado_em, 'cancelado_motivo', p.cancelado_motivo,
    'criado_em', p.criado_em, 'atualizado_em', p.atualizado_em,
    'criado_por_nome', (select nullif(split_part(coalesce(x.full_name, ''), ' ', 1), '') from public.profiles x where x.id = p.criado_por),
    'os', f.os, 'etapa', f.etapa, 'etapa_nome', e.nome, 'etapa_papel', e.papel, 'etapa_em', f.etapa_em, 'rastreio', f.rastreio,
    'ref', case when a.id is null then null else 'a' || a.id::text end,
    'pagamentos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id, 'valor', g.valor, 'forma', g.forma, 'parcelas', g.parcelas, 'pago_em', g.pago_em,
        'comprovante', g.comprovante, 'criado_em', g.criado_em,
        'estornado_em', g.estornado_em, 'estornado_motivo', g.estornado_motivo
      ) order by g.criado_em)
      from public.loja_pagamentos g where g.pedido = p.id
    ), '[]'::jsonb),
    'anexos', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'caminho', x.caminho, 'tipo', x.tipo, 'nome', x.nome, 'criado_em', x.criado_em) order by x.criado_em)
      from public.loja_anexos x where x.pedido = p.id and x.tirado_em is null
    ), '[]'::jsonb)
  )
  from public.loja_pedidos p
  join public.loja_vendedores v on v.id = p.vendedor
  left join lateral (select sum(g.valor) as pago from public.loja_pagamentos g where g.pedido = p.id and g.estornado_em is null) pg on true
  left join public.fabrica_avulsos a on a.loja_pedido = p.id
  left join public.fabrica_pedidos f on f.avulso = a.id
  left join public.fabrica_etapas e on e.chave = f.etapa
  where p.id = p_id
$$;

-- ------------------------------------------------------------------ vendedores

create or replace function public.balcao_vendedores(p_loja text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare v_loja text := coalesce(public.minha_loja(), nullif(btrim(coalesce(p_loja, '')), ''));
begin
  if not coalesce(public.tem_acesso('balcao'), false) then
    raise exception 'Seu acesso não abre o balcão.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', v.id, 'loja', v.loja, 'nome', v.nome, 'ativo', v.ativo) order by v.ativo desc, v.nome)
    from public.loja_vendedores v
    where (v_loja is null or v.loja = v_loja)
  ), '[]'::jsonb);
end
$$;

create or replace function public.balcao_vendedor_salvar(p_id uuid, p_loja text, p_nome text, p_ativo boolean default true)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_loja text := coalesce(public.minha_loja(), nullif(btrim(coalesce(p_loja, '')), ''));
  v_nome text := regexp_replace(btrim(coalesce(p_nome, '')), '\s+', ' ', 'g');
  v_id uuid;
begin
  if v_loja is null or not public.balcao_pode(v_loja) then
    raise exception 'Seu acesso não mexe nos vendedores desta loja.' using errcode = '42501';
  end if;
  if char_length(v_nome) not between 2 and 60 or v_nome ~ '[—–]' then
    raise exception 'Escreva o nome do vendedor (2 a 60 letras, sem travessão).' using errcode = '22023';
  end if;
  if p_id is null then
    insert into public.loja_vendedores (loja, nome, ativo, criado_por)
    values (v_loja, v_nome, coalesce(p_ativo, true), (select auth.uid()))
    on conflict (loja, lower(btrim(nome))) do update set ativo = true, atualizado_em = now()
    returning id into v_id;
  else
    update public.loja_vendedores
       set nome = v_nome, ativo = coalesce(p_ativo, ativo), atualizado_em = now()
     where id = p_id and loja = v_loja
    returning id into v_id;
    if v_id is null then
      raise exception 'Vendedor não encontrado nesta loja.' using errcode = '22023';
    end if;
  end if;
  return jsonb_build_object('ok', true, 'id', v_id);
end
$$;

-- ------------------------------------------------------------------ pedido

-- Cria ou edita o pedido. `p.id` é o uuid que o navegador gerou.
-- Depois de ir para a fábrica, peças e entrega não mudam por aqui (a mudança
-- vira pedido de alteração na fila); cliente, total, prazo e observação, sim.
create or replace function public.balcao_salvar_pedido(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_quem    uuid := (select auth.uid());
  v_id      uuid;
  v_antes   public.loja_pedidos;
  v_loja    text;
  v_vend    uuid;
  v_tel     text := public.balcao_telefone(p->>'cliente_telefone');
  v_nome    text := regexp_replace(btrim(coalesce(p->>'cliente_nome', '')), '\s+', ' ', 'g');
  v_email   text := nullif(lower(btrim(coalesce(p->>'cliente_email', ''))), '');
  v_total   numeric;
  v_prazo   date;
  v_dataesp date;
  v_pecas   jsonb := coalesce(p->'pecas', '[]'::jsonb);
  v_fotos   text[] := '{}';
  v_foto    text;
  v_anexo   jsonb;
  v_pag     jsonb;
  v_novo    boolean;
  v_numero  bigint;
begin
  if not coalesce(public.tem_acesso('balcao'), false) then
    raise exception 'Seu acesso não abre o balcão.' using errcode = '42501';
  end if;
  begin
    v_id := (p->>'id')::uuid;
  exception when others then
    raise exception 'Pedido sem identificação. Recarregue a tela.' using errcode = '22023';
  end;
  if v_id is null then
    raise exception 'Pedido sem identificação. Recarregue a tela.' using errcode = '22023';
  end if;

  select * into v_antes from public.loja_pedidos where id = v_id for update;
  v_novo := v_antes.id is null;

  if v_novo then
    v_loja := coalesce(public.minha_loja(), nullif(btrim(coalesce(p->>'loja', '')), ''));
    if v_loja is null then
      raise exception 'Escolha a loja do pedido.' using errcode = '22023';
    end if;
  else
    v_loja := v_antes.loja;
    if v_antes.cancelado_em is not null then
      raise exception 'Este pedido foi cancelado.' using errcode = '22023';
    end if;
  end if;
  if not public.balcao_pode(v_loja) then
    raise exception 'Este pedido é de outra loja.' using errcode = '42501';
  end if;

  -- Quem atendeu: um vendedor ativo DESTA loja (ou o mesmo de antes, mesmo que tenha saído).
  begin
    v_vend := (p->>'vendedor')::uuid;
  exception when others then
    v_vend := null;
  end;
  if v_vend is null or not exists (
    select 1 from public.loja_vendedores x
    where x.id = v_vend and x.loja = v_loja and (x.ativo or x.id = v_antes.vendedor)
  ) then
    raise exception 'Escolha quem atendeu.' using errcode = '22023';
  end if;

  if char_length(v_nome) not between 2 and 120 then
    raise exception 'Escreva o nome do cliente.' using errcode = '22023';
  end if;
  if v_tel is null then
    raise exception 'WhatsApp do cliente com DDD.' using errcode = '22023';
  end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'O e-mail não parece certo.' using errcode = '22023';
  end if;
  begin
    v_total := round((p->>'total')::numeric, 2);
  exception when others then
    v_total := null;
  end;
  if v_total is null or v_total <= 0 or v_total >= 1000000 then
    raise exception 'Diga o valor total do pedido.' using errcode = '22023';
  end if;
  if coalesce(p->>'motivo', '') <> '' and p->>'motivo' not in ('namoro', 'noivado', 'casamento', 'bodas', 'presente', 'outro') then
    raise exception 'Motivo desconhecido.' using errcode = '22023';
  end if;
  if nullif(p->>'prazo', '') is not null then
    v_prazo := (p->>'prazo')::date;
    if v_novo and v_prazo < public.balcao_hoje() then
      raise exception 'O prazo prometido precisa ser de hoje em diante.' using errcode = '22023';
    end if;
    if v_prazo > public.balcao_hoje() + 365 then
      raise exception 'Prazo longe demais.' using errcode = '22023';
    end if;
  end if;
  if nullif(p->>'data_especial', '') is not null then
    v_dataesp := (p->>'data_especial')::date;
  end if;
  if coalesce(p->>'entrega', '') not in ('retirada', 'correios', 'moto', 'a_combinar') then
    raise exception 'Diga como a peça chega ao cliente.' using errcode = '22023';
  end if;
  if jsonb_typeof(v_pecas) <> 'array' or jsonb_array_length(v_pecas) not between 1 and 8 then
    raise exception 'Diga de 1 a 8 peças.' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_pecas) x
    where char_length(btrim(coalesce(x->>'nome', ''))) not between 2 and 200
       or coalesce((x->>'quantidade')::int, 0) not between 1 and 20
       or char_length(coalesce(x->>'info', '')) > 4000
  ) then
    raise exception 'Confira as peças: nome e quantidade.' using errcode = '22023';
  end if;
  if coalesce(p->>'observacao', '') ~ '[—–]' then
    raise exception 'Sem travessão na observação.' using errcode = '22023';
  end if;

  -- Fotos do pedido escrito: as mesmas da OS (balde `fabrica-os`), na pasta de quem lança.
  if jsonb_typeof(p->'fotos') = 'array' then
    for v_foto in select x from jsonb_array_elements_text(p->'fotos') as t(x) loop
      if v_foto = any (coalesce(v_antes.fotos, '{}')) then
        v_fotos := v_fotos || v_foto;
        continue;
      end if;
      if v_foto !~ ('^' || v_quem::text || '/[0-9a-f-]{36}\.jpg$')
         or not exists (select 1 from storage.objects o where o.bucket_id = 'fabrica-os' and o.name = v_foto) then
        raise exception 'A foto do pedido não subiu direito. Tire de novo.' using errcode = '22023';
      end if;
      v_fotos := v_fotos || v_foto;
    end loop;
    if cardinality(v_fotos) > 4 then
      raise exception 'Até 4 fotos do pedido escrito.' using errcode = '22023';
    end if;
  else
    v_fotos := coalesce(v_antes.fotos, '{}');
  end if;

  if v_novo then
    insert into public.loja_pedidos (
      id, loja, vendedor, cliente_nome, cliente_telefone, cliente_email, motivo, data_especial,
      pecas, formulario, entrega, entrega_texto, endereco, cidade, uf, prazo, total, observacao, numero_papel,
      fotos, transcricao, criado_por, atualizado_por
    ) values (
      v_id, v_loja, v_vend, v_nome, v_tel, v_email, nullif(p->>'motivo', ''), v_dataesp,
      v_pecas, p->'formulario', p->>'entrega', nullif(left(btrim(coalesce(p->>'entrega_texto', '')), 160), ''),
      nullif(left(btrim(coalesce(p->>'endereco', '')), 300), ''), nullif(left(btrim(coalesce(p->>'cidade', '')), 80), ''),
      nullif(upper(btrim(coalesce(p->>'uf', ''))), ''), v_prazo, v_total,
      nullif(left(btrim(coalesce(p->>'observacao', '')), 1000), ''), nullif(left(btrim(coalesce(p->>'numero_papel', '')), 30), ''),
      v_fotos, nullif(left(btrim(coalesce(p->>'transcricao', '')), 8000), ''), v_quem, v_quem
    );
  else
    update public.loja_pedidos set
      vendedor = v_vend,
      cliente_nome = v_nome, cliente_telefone = v_tel, cliente_email = v_email,
      motivo = nullif(p->>'motivo', ''), data_especial = v_dataesp,
      -- Na fábrica, as peças e a entrega são as que ela recebeu.
      pecas = case when fabrica_em is null then v_pecas else pecas end,
      formulario = case when fabrica_em is null then p->'formulario' else formulario end,
      entrega = case when fabrica_em is null then p->>'entrega' else entrega end,
      entrega_texto = case when fabrica_em is null then nullif(left(btrim(coalesce(p->>'entrega_texto', '')), 160), '') else entrega_texto end,
      endereco = case when fabrica_em is null then nullif(left(btrim(coalesce(p->>'endereco', '')), 300), '') else endereco end,
      cidade = case when fabrica_em is null then nullif(left(btrim(coalesce(p->>'cidade', '')), 80), '') else cidade end,
      uf = case when fabrica_em is null then nullif(upper(btrim(coalesce(p->>'uf', ''))), '') else uf end,
      prazo = v_prazo, total = v_total,
      observacao = nullif(left(btrim(coalesce(p->>'observacao', '')), 1000), ''),
      numero_papel = nullif(left(btrim(coalesce(p->>'numero_papel', '')), 30), ''),
      fotos = v_fotos,
      transcricao = coalesce(nullif(left(btrim(coalesce(p->>'transcricao', '')), 8000), ''), transcricao),
      atualizado_por = v_quem, atualizado_em = now()
    where id = v_id;
  end if;

  -- Anexos que subiram enquanto a loja preenchia.
  if jsonb_typeof(p->'anexos') = 'array' then
    for v_anexo in select x from jsonb_array_elements(p->'anexos') as t(x) loop
      perform public.balcao_registrar_anexo(v_id, v_anexo->>'caminho', coalesce(v_anexo->>'tipo', 'documento'), v_anexo->>'nome');
    end loop;
  end if;

  -- Pagamentos novos (o sinal, na criação). Cada um tem a sua chave, e repetir o envio não paga duas vezes.
  if jsonb_typeof(p->'pagamentos') = 'array' then
    for v_pag in select x from jsonb_array_elements(p->'pagamentos') as t(x) loop
      perform public.balcao_registrar_pagamento(v_id, v_pag);
    end loop;
  end if;

  select numero into v_numero from public.loja_pedidos where id = v_id;
  return jsonb_build_object('ok', true, 'id', v_id, 'numero', v_numero, 'novo', v_novo);
end
$$;

-- Registra um anexo que já subiu para o balde, na pasta do pedido. Interna:
-- quem chama já conferiu a loja.
create or replace function public.balcao_registrar_anexo(p_pedido uuid, p_caminho text, p_tipo text, p_nome text)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare v_id uuid;
begin
  if p_tipo not in ('comprovante', 'documento', 'foto') then
    raise exception 'Tipo de anexo desconhecido.' using errcode = '22023';
  end if;
  if coalesce(p_caminho, '') !~ ('^' || p_pedido::text || '/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$')
     or not exists (select 1 from storage.objects o where o.bucket_id = 'loja-pedidos' and o.name = p_caminho) then
    raise exception 'Um anexo não subiu direito. Mande de novo.' using errcode = '22023';
  end if;
  insert into public.loja_anexos (pedido, caminho, tipo, nome, criado_por)
  values (p_pedido, p_caminho, p_tipo, nullif(left(btrim(coalesce(p_nome, '')), 120), ''), (select auth.uid()))
  on conflict (caminho) do nothing
  returning id into v_id;
  return v_id;
end
$$;

-- Um pagamento. `p.chave` (uuid do navegador) é o id: mandar de novo não paga
-- duas vezes. Interna: quem chama já conferiu a loja.
create or replace function public.balcao_registrar_pagamento(p_pedido uuid, p jsonb)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_id     uuid;
  v_valor  numeric;
  v_parc   int := coalesce(nullif(p->>'parcelas', '')::int, 1);
  v_dia    date := coalesce(nullif(p->>'pago_em', '')::date, public.balcao_hoje());
  v_comp   text := nullif(p->>'comprovante', '');
begin
  begin
    v_id := (p->>'chave')::uuid;
  exception when others then
    v_id := null;
  end;
  if v_id is null then v_id := gen_random_uuid(); end if;
  if exists (select 1 from public.loja_pagamentos g where g.id = v_id) then
    return v_id;
  end if;
  begin
    v_valor := round((p->>'valor')::numeric, 2);
  exception when others then
    v_valor := null;
  end;
  if v_valor is null or v_valor <= 0 or v_valor >= 1000000 then
    raise exception 'Diga o valor pago.' using errcode = '22023';
  end if;
  if coalesce(p->>'forma', '') not in ('pix', 'credito', 'debito', 'dinheiro', 'link', 'outro') then
    raise exception 'Diga a forma de pagamento.' using errcode = '22023';
  end if;
  if v_parc not between 1 and 24 then
    raise exception 'Parcelas de 1 a 24.' using errcode = '22023';
  end if;
  if v_dia > public.balcao_hoje() or v_dia < public.balcao_hoje() - 365 then
    raise exception 'O dia do pagamento não pode ser no futuro.' using errcode = '22023';
  end if;
  if v_comp is not null then
    if v_comp !~ ('^' || p_pedido::text || '/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$')
       or not exists (select 1 from storage.objects o where o.bucket_id = 'loja-pedidos' and o.name = v_comp) then
      raise exception 'O comprovante não subiu direito. Mande de novo.' using errcode = '22023';
    end if;
    perform public.balcao_registrar_anexo(p_pedido, v_comp, 'comprovante', 'Comprovante');
  end if;
  insert into public.loja_pagamentos (id, pedido, valor, forma, parcelas, pago_em, comprovante, criado_por)
  values (v_id, p_pedido, v_valor, p->>'forma', v_parc, v_dia, v_comp, (select auth.uid()));
  return v_id;
end
$$;

-- Receber mais um pagamento num pedido já salvo (parcela, saldo na retirada).
create or replace function public.balcao_pagar(p_pedido uuid, p jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare v_p public.loja_pedidos;
begin
  select * into v_p from public.loja_pedidos where id = p_pedido for update;
  if v_p.id is null or not public.balcao_pode(v_p.loja) then
    raise exception 'Pedido não encontrado.' using errcode = '42501';
  end if;
  if v_p.cancelado_em is not null then
    raise exception 'Este pedido foi cancelado.' using errcode = '22023';
  end if;
  perform public.balcao_registrar_pagamento(p_pedido, p);
  update public.loja_pedidos set atualizado_por = (select auth.uid()), atualizado_em = now() where id = p_pedido;
  return public.balcao_montar(p_pedido);
end
$$;

create or replace function public.balcao_estornar(p_pagamento uuid, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_g public.loja_pagamentos;
  v_loja text;
  v_motivo text := btrim(coalesce(p_motivo, ''));
begin
  select * into v_g from public.loja_pagamentos where id = p_pagamento for update;
  select loja into v_loja from public.loja_pedidos where id = v_g.pedido;
  if v_g.id is null or not public.balcao_pode(v_loja) then
    raise exception 'Pagamento não encontrado.' using errcode = '42501';
  end if;
  if v_g.estornado_em is not null then
    return public.balcao_montar(v_g.pedido);
  end if;
  if char_length(v_motivo) not between 3 and 300 or v_motivo ~ '[—–]' then
    raise exception 'Diga por que o pagamento sai (sem travessão).' using errcode = '22023';
  end if;
  update public.loja_pagamentos set estornado_em = now(), estornado_por = (select auth.uid()), estornado_motivo = v_motivo where id = p_pagamento;
  return public.balcao_montar(v_g.pedido);
end
$$;

create or replace function public.balcao_anexar(p_pedido uuid, p_caminho text, p_tipo text, p_nome text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare v_loja text;
begin
  select loja into v_loja from public.loja_pedidos where id = p_pedido;
  if v_loja is null or not public.balcao_pode(v_loja) then
    raise exception 'Pedido não encontrado.' using errcode = '42501';
  end if;
  perform public.balcao_registrar_anexo(p_pedido, p_caminho, p_tipo, p_nome);
  return public.balcao_montar(p_pedido);
end
$$;

create or replace function public.balcao_tirar_anexo(p_anexo uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare v_pedido uuid; v_loja text;
begin
  select a.pedido, p.loja into v_pedido, v_loja from public.loja_anexos a join public.loja_pedidos p on p.id = a.pedido where a.id = p_anexo;
  if v_pedido is null or not public.balcao_pode(v_loja) then
    raise exception 'Anexo não encontrado.' using errcode = '42501';
  end if;
  -- O comprovante de um pagamento que vale não sai sozinho: estorne o pagamento antes.
  if exists (select 1 from public.loja_pagamentos g join public.loja_anexos a on a.caminho = g.comprovante where a.id = p_anexo and g.estornado_em is null) then
    raise exception 'Este é o comprovante de um pagamento. Estorne o pagamento para tirar.' using errcode = '22023';
  end if;
  update public.loja_anexos set tirado_em = now(), tirado_por = (select auth.uid()) where id = p_anexo and tirado_em is null;
  return public.balcao_montar(v_pedido);
end
$$;

-- O caminho pode ser lido por quem está logado? (o servidor só assina depois disto)
create or replace function public.balcao_arquivo_permitido(p_caminho text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce((
    select public.balcao_pode(p.loja)
    from public.loja_pedidos p
    where p.id::text = split_part(p_caminho, '/', 1)
      and (exists (select 1 from public.loja_anexos a where a.caminho = p_caminho and a.pedido = p.id)
           or p_caminho = any (p.fotos))
  ), false)
$$;

-- Pode subir arquivo na pasta deste id? Pedido que ainda não existe (o
-- navegador acabou de gerar o id) pode; o que existe, só se for da loja.
create or replace function public.balcao_pode_subir(p_pedido uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce(public.tem_acesso('balcao'), false)
     and coalesce((select public.balcao_pode(p.loja) and p.cancelado_em is null from public.loja_pedidos p where p.id = p_pedido), true)
$$;

-- ------------------------------------------------------------------ fábrica e marcas

create or replace function public.balcao_mandar_para_fabrica(p_pedido uuid, p_prioridade text default 'normal')
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_quem   uuid := (select auth.uid());
  v_p      public.loja_pedidos;
  v_vend   text;
  v_avulso uuid;
  v_relato text;
begin
  select * into v_p from public.loja_pedidos where id = p_pedido for update;
  if v_p.id is null or not public.balcao_pode(v_p.loja) then
    raise exception 'Pedido não encontrado.' using errcode = '42501';
  end if;
  if v_p.cancelado_em is not null then
    raise exception 'Este pedido foi cancelado.' using errcode = '22023';
  end if;
  if coalesce(p_prioridade, 'normal') not in ('normal', 'urgente', 'motoboy') then
    raise exception 'Prioridade desconhecida.' using errcode = '22023';
  end if;
  if v_p.fabrica_em is not null then
    return public.balcao_montar(p_pedido);
  end if;
  select nome into v_vend from public.loja_vendedores where id = v_p.vendedor;
  -- A fábrica não vê valor: só o número do pedido, quem vendeu e o que a loja escreveu.
  v_relato := left(concat_ws(E'\n',
    'Pedido da loja PL-' || v_p.numero || ', vendido por ' || v_vend || '.',
    v_p.observacao
  ), 1000);

  insert into public.fabrica_avulsos (cliente_nome, cliente_telefone, pecas, entrega, endereco, cidade, uf, relato, loja, numero_papel, criado_por, fotos, transcricao, loja_pedido)
  values (
    v_p.cliente_nome, v_p.cliente_telefone, v_p.pecas,
    coalesce(v_p.entrega_texto, v_p.entrega), v_p.endereco, v_p.cidade, v_p.uf,
    v_relato, v_p.loja, v_p.numero_papel, v_quem, v_p.fotos, v_p.transcricao, v_p.id
  )
  returning id into v_avulso;

  insert into public.fabrica_pedidos (avulso, etapa, etapa_em, tipo, prioridade, prazo, atualizado_por)
  values (v_avulso, 'a_produzir', now(), 'venda_nova', coalesce(p_prioridade, 'normal'),
          case when v_p.prazo >= public.balcao_hoje() then v_p.prazo end, v_quem);

  update public.loja_pedidos set fabrica_em = now(), fabrica_por = v_quem, atualizado_por = v_quem, atualizado_em = now() where id = p_pedido;
  return public.balcao_montar(p_pedido);
end
$$;

-- recebido: a peça chegou da fábrica na loja. entregue: o cliente levou (pede
-- o saldo zerado, ou um motivo). cancelar: pede motivo e não vale depois de
-- entregue. desfazer: tira a última marca de chegada ou de entrega.
create or replace function public.balcao_marcar(p_pedido uuid, p_acao text, p_motivo text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_quem   uuid := (select auth.uid());
  v_p      public.loja_pedidos;
  v_pago   numeric;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
begin
  select * into v_p from public.loja_pedidos where id = p_pedido for update;
  if v_p.id is null or not public.balcao_pode(v_p.loja) then
    raise exception 'Pedido não encontrado.' using errcode = '42501';
  end if;
  if v_motivo ~ '[—–]' then
    raise exception 'Sem travessão no motivo.' using errcode = '22023';
  end if;
  select coalesce(sum(valor), 0) into v_pago from public.loja_pagamentos where pedido = p_pedido and estornado_em is null;

  if p_acao = 'recebido' then
    if v_p.cancelado_em is not null then raise exception 'Este pedido foi cancelado.' using errcode = '22023'; end if;
    update public.loja_pedidos set recebido_em = coalesce(recebido_em, now()), recebido_por = coalesce(recebido_por, v_quem), atualizado_por = v_quem, atualizado_em = now() where id = p_pedido;
  elsif p_acao = 'entregue' then
    if v_p.cancelado_em is not null then raise exception 'Este pedido foi cancelado.' using errcode = '22023'; end if;
    if v_pago < v_p.total and coalesce(char_length(v_motivo), 0) < 3 then
      raise exception 'Falta receber R$ %. Registre o pagamento ou diga por que entrega assim.', replace(to_char(v_p.total - v_pago, 'FM99999990.00'), '.', ',') using errcode = '22023';
    end if;
    update public.loja_pedidos
       set entregue_em = coalesce(entregue_em, now()), entregue_por = coalesce(entregue_por, v_quem),
           recebido_em = coalesce(recebido_em, now()), recebido_por = coalesce(recebido_por, v_quem),
           observacao = case when v_pago < v_p.total then left(concat_ws(E'\n', observacao, 'Entregue com saldo aberto: ' || v_motivo), 1000) else observacao end,
           atualizado_por = v_quem, atualizado_em = now()
     where id = p_pedido;
  elsif p_acao = 'cancelar' then
    if v_p.entregue_em is not null then raise exception 'Pedido já entregue não se cancela.' using errcode = '22023'; end if;
    if coalesce(char_length(v_motivo), 0) < 3 then raise exception 'Diga por que cancela.' using errcode = '22023'; end if;
    update public.loja_pedidos set cancelado_em = now(), cancelado_por = v_quem, cancelado_motivo = left(v_motivo, 300), atualizado_por = v_quem, atualizado_em = now() where id = p_pedido and cancelado_em is null;
  elsif p_acao = 'desfazer' then
    if v_p.entregue_em is not null then
      update public.loja_pedidos set entregue_em = null, entregue_por = null, atualizado_por = v_quem, atualizado_em = now() where id = p_pedido;
    elsif v_p.recebido_em is not null then
      update public.loja_pedidos set recebido_em = null, recebido_por = null, atualizado_por = v_quem, atualizado_em = now() where id = p_pedido;
    end if;
  else
    raise exception 'Ação desconhecida.' using errcode = '22023';
  end if;
  return public.balcao_montar(p_pedido);
end
$$;

-- ------------------------------------------------------------------ leitura

create or replace function public.balcao_pedido(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare v_loja text;
begin
  select loja into v_loja from public.loja_pedidos where id = p_id;
  if v_loja is null or not public.balcao_pode(v_loja) then
    return null;
  end if;
  return public.balcao_montar(p_id);
end
$$;

-- A lista da loja: os abertos inteiros (não entregues nem cancelados), mais os
-- fechados dos últimos `p_dias`. Busca por número, cliente, telefone e peça.
create or replace function public.balcao_lista(p_loja text default null, p_dias integer default 30, p_busca text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_loja  text := coalesce(public.minha_loja(), nullif(btrim(coalesce(p_loja, '')), ''));
  v_busca text := nullif(lower(btrim(coalesce(p_busca, ''))), '');
  v_num   text := regexp_replace(coalesce(v_busca, ''), '[^0-9]', '', 'g');
begin
  if not coalesce(public.tem_acesso('balcao'), false) then
    raise exception 'Seu acesso não abre o balcão.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(public.balcao_montar(x.id) order by x.criado_em desc)
    from (
      select p.id, p.criado_em
      from public.loja_pedidos p
      where (v_loja is null or p.loja = v_loja)
        and public.balcao_pode(p.loja)
        and (
          v_busca is not null
          or (p.entregue_em is null and p.cancelado_em is null)
          or p.criado_em > now() - make_interval(days => greatest(least(coalesce(p_dias, 30), 365), 1))
        )
        and (
          v_busca is null
          or lower(p.cliente_nome) like '%' || v_busca || '%'
          or (char_length(v_num) >= 3 and (p.numero::text = v_num or p.cliente_telefone like '%' || v_num || '%' or coalesce(p.numero_papel, '') like '%' || v_num || '%'))
          or lower(p.pecas::text) like '%' || v_busca || '%'
        )
      order by p.criado_em desc
      limit 200
    ) x
  ), '[]'::jsonb);
end
$$;

-- O cliente que a loja digitou já comprou? Só nome, quando e onde: nada de valor de outra loja.
create or replace function public.balcao_cliente(p_telefone text)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare v_tel text := public.balcao_telefone(p_telefone);
begin
  if not coalesce(public.tem_acesso('balcao'), false) then
    raise exception 'Seu acesso não abre o balcão.' using errcode = '42501';
  end if;
  if v_tel is null then return null; end if;
  return jsonb_build_object(
    'nome', coalesce(
      (select p.cliente_nome from public.loja_pedidos p where p.cliente_telefone = v_tel order by p.criado_em desc limit 1),
      (select v.cliente_nome from public.vendas_avulsas v where v.cliente_telefone = v_tel and v.cliente_nome is not null order by v.feita_em desc limit 1),
      (select t.cliente_nome from public.tray_pedidos t where t.cliente_telefone = v_tel order by t.dia desc limit 1)
    ),
    'email', (select p.cliente_email from public.loja_pedidos p where p.cliente_telefone = v_tel and p.cliente_email is not null order by p.criado_em desc limit 1),
    'pedidos', coalesce((
      select jsonb_agg(jsonb_build_object('id', case when public.balcao_pode(p.loja) then p.id end, 'numero', p.numero, 'loja', p.loja, 'dia', (p.criado_em at time zone 'America/Sao_Paulo')::date) order by p.criado_em desc)
      from (select * from public.loja_pedidos p where p.cliente_telefone = v_tel and p.cancelado_em is null order by p.criado_em desc limit 5) p
    ), '[]'::jsonb),
    'compras_no_site', (select count(*) from public.tray_pedidos t where t.cliente_telefone = v_tel and t.situacao = 'pago')
  );
end
$$;

-- ------------------------------------------------------------------ direitos

revoke all on table public.loja_vendedores, public.loja_pedidos, public.loja_pagamentos, public.loja_anexos from anon, authenticated;

revoke execute on function public.balcao_montar(uuid) from public, anon, authenticated;
revoke execute on function public.balcao_registrar_anexo(uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public.balcao_registrar_pagamento(uuid, jsonb) from public, anon, authenticated;

do $$
declare f text;
begin
  foreach f in array array[
    'balcao_pode(text)', 'balcao_vendedores(text)', 'balcao_vendedor_salvar(uuid, text, text, boolean)',
    'balcao_salvar_pedido(jsonb)', 'balcao_pagar(uuid, jsonb)', 'balcao_estornar(uuid, text)',
    'balcao_anexar(uuid, text, text, text)', 'balcao_tirar_anexo(uuid)', 'balcao_arquivo_permitido(text)',
    'balcao_pode_subir(uuid)', 'balcao_mandar_para_fabrica(uuid, text)', 'balcao_marcar(uuid, text, text)',
    'balcao_pedido(uuid)', 'balcao_lista(text, integer, text)', 'balcao_cliente(text)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;
end
$$;
