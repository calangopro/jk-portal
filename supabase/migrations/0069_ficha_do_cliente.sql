-- Ficha do cliente e oportunidades de venda.
--
-- POR QUE
--
-- O vendedor não sabia em que fase estava o cliente. O que a pessoa comprou
-- mora nos pedidos da loja, o que fechou no WhatsApp mora nas vendas por fora,
-- o cadastro no grupo mora nos contatos, e o que o time SABE dela (namora,
-- noivou, casa em março, o aniversário, o nome do par) não morava em lugar
-- nenhum. Medido em 14/11/2026: 1.116 clientes com pedido pago e só 18 com
-- uma segunda compra.
--
-- COMO
--
-- CLIENTE é o mesmo de sempre (0054 e 0058): o telefone; sem telefone, o
-- e-mail; sem os dois, o código na Tray. A ficha usa a MESMA expressão,
-- `coalesce(cliente_telefone, cliente_email, cliente_codigo)`, e ganha um
-- índice nela, que a fila de recuperação também aproveita.
--
-- A ficha é uma CONTA sobre o que já existe (pedidos, vendas por fora,
-- contatos do grupo, casos de recuperação) mais uma tabela pequena com o que
-- só gente sabe: `clientes_fichas`. Ninguém lê nem grava direto nela: tudo
-- passa por função que confere a área `lancar_venda` por dentro. Assim o
-- vendedor recebe a ficha sem ganhar leitura de `tray_pedidos`, que é
-- faturamento. A ficha mostra o que ESTE cliente comprou e quanto pagou, e
-- nunca o custo da peça nem soma da empresa.
--
-- O endereço da ficha não leva telefone nem e-mail: a tela abre por uma
-- REFERÊNCIA (`p` mais um pedido do cliente, `v` mais uma venda por fora, `l`
-- mais um cadastro no grupo), e quem troca a referência pela chave é o banco.
--
-- As datas podem vir sem o ano (`MM-DD`): aniversário quase nunca vem com ele,
-- e a gravação da aliança muitas vezes é só "12.06".
--
-- OPORTUNIDADE também é conta, não tabela: `base_de_oportunidades` separa quem
-- pode ter alguma coisa vencendo na janela e devolve o que se sabe de cada um;
-- quem decide é o código (`src/lib/clientes/oportunidades.ts`), com teste. A
-- única coisa gravada é a decisão do vendedor sobre uma ocorrência ("já
-- falei", "não vale"), presa ao dia dela: a do ano seguinte é outra, e volta.
--
-- Data tirada da gravação NUNCA é gravada sozinha. Ela aparece como sugestão
-- até alguém confirmar (vira campo da ficha) ou recusar (`datas_recusadas`).

create index tray_pedidos_cliente_idx
  on public.tray_pedidos ((coalesce(cliente_telefone, cliente_email, cliente_codigo)));

-- ------------------------------------------------------------ data sem ano

create function public.data_parcial_existe(p text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p is null then true
    when p !~ '^([0-9]{4}-)?(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$' then false
    when length(p) = 10 and left(p, 4)::integer not between 1900 and 2100 then false
    -- Sem ano, vale o calendário de um ano bissexto: 29 de fevereiro existe.
    else right(p, 2)::integer <= extract(day from (
      make_date(case when length(p) = 10 then left(p, 4)::integer else 2024 end, substr(right(p, 5), 1, 2)::integer, 1)
      + interval '1 month' - interval '1 day'))::integer
  end;
$$;

create domain public.data_parcial as text check (public.data_parcial_existe(value));

comment on domain public.data_parcial is
  'Data que pode vir sem o ano: AAAA-MM-DD ou MM-DD.';

-- ------------------------------------------------------------------ tabelas

create table public.clientes_fichas (
  chave           text primary key check (char_length(chave) between 3 and 200),
  fase            text not null default 'nao_sei'
                  check (fase in ('namoro', 'noivado', 'casamento_marcado', 'casado', 'nao_sei')),
  par_nome        text check (char_length(par_nome) <= 120),
  aniversario     public.data_parcial,
  aniversario_par public.data_parcial,
  data_namoro     public.data_parcial,
  data_casamento  public.data_parcial,
  datas_recusadas text[] not null default '{}',
  anotacoes       text check (char_length(anotacoes) <= 2000),
  responsavel_id  uuid references public.profiles (id) on delete set null,
  criado_por      uuid references public.profiles (id) on delete set null,
  criado_em       timestamptz not null default now(),
  atualizado_por  uuid references public.profiles (id) on delete set null,
  atualizado_em   timestamptz not null default now()
);

comment on table public.clientes_fichas is
  'O que o time sabe do cliente e nenhum sistema guarda. Leitura só por ficha_do_cliente(); escrita só por salvar_ficha_do_cliente().';
comment on column public.clientes_fichas.chave is
  'A chave do cliente: coalesce(cliente_telefone, cliente_email, cliente_codigo), como na fila de recuperação.';
comment on column public.clientes_fichas.datas_recusadas is
  'Datas lidas da gravação que alguém disse que não são do casal. Não voltam como sugestão.';

create index clientes_fichas_responsavel_idx on public.clientes_fichas (responsavel_id) where responsavel_id is not null;
create index clientes_fichas_criado_por_idx on public.clientes_fichas (criado_por);
create index clientes_fichas_atualizado_por_idx on public.clientes_fichas (atualizado_por);

create table public.clientes_fichas_alteracoes (
  id    bigint generated always as identity primary key,
  chave text not null references public.clientes_fichas (chave),
  por   uuid references public.profiles (id) on delete set null,
  em    timestamptz not null default now(),
  mudou jsonb not null
);

comment on table public.clientes_fichas_alteracoes is
  'Quem alterou a ficha e quando. mudou = {campo: {de, para}}.';

create index clientes_fichas_alteracoes_chave_idx on public.clientes_fichas_alteracoes (chave, em desc);
create index clientes_fichas_alteracoes_por_idx on public.clientes_fichas_alteracoes (por);

create table public.oportunidades_marcadas (
  chave      text not null check (char_length(chave) between 3 and 200),
  tipo       text not null check (tipo in (
               'aniversario_cliente', 'aniversario_par', 'aniversario_namoro', 'aniversario_casamento',
               'casamento_chegando', 'namoro_sem_noivado', 'um_ano_da_compra')),
  ocorrencia date not null,
  decisao    text not null check (decisao in ('falei', 'nao_vale', 'reaberta')),
  nota       text check (char_length(nota) <= 300),
  por        uuid references public.profiles (id) on delete set null,
  em         timestamptz not null default now(),
  primary key (chave, tipo, ocorrencia)
);

comment on table public.oportunidades_marcadas is
  'O que o vendedor decidiu sobre UMA ocorrência de oportunidade. A lista em si é conta (base_de_oportunidades mais o código). Escrita só por marcar_oportunidade().';

create index oportunidades_marcadas_por_idx on public.oportunidades_marcadas (por);

-- RLS ligada e nenhuma policy: ninguém lê nem grava direto. As funções abaixo
-- rodam com os direitos de quem as criou e conferem a área por dentro.
alter table public.clientes_fichas enable row level security;
alter table public.clientes_fichas_alteracoes enable row level security;
alter table public.oportunidades_marcadas enable row level security;

revoke all on public.clientes_fichas from anon, authenticated;
revoke all on public.clientes_fichas_alteracoes from anon, authenticated;
revoke all on public.oportunidades_marcadas from anon, authenticated;

-- -------------------------------------------------------- peças de dentro
--
-- As três funções abaixo NÃO conferem acesso: só são chamadas de dentro das
-- funções públicas, que conferem antes. Por isso ninguém além do dono pode
-- executá-las.

-- A referência do endereço vira a chave do cliente. Referência torta ou de
-- registro que não existe devolve null.
create function public.cliente_da_ref(p_ref text)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when p_ref ~ '^p[1-9][0-9]{0,14}$' then (
      select coalesce(t.cliente_telefone, t.cliente_email, t.cliente_codigo)
      from public.tray_pedidos t
      where t.pedido = substr(p_ref, 2)::bigint)
    when p_ref ~ '^v[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (
      select v.cliente_telefone from public.vendas_avulsas v where v.id = substr(p_ref, 2)::uuid)
    when p_ref ~ '^l[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (
      select l.whatsapp from public.leads l where l.id = substr(p_ref, 2)::uuid)
  end;
$$;

-- A referência de um cliente: o pedido mais recente dele; sem pedido, a venda
-- por fora mais recente; sem venda, o cadastro no grupo.
create function public.ref_do_cliente(p_chave text)
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select 'p' || t.pedido
     from public.tray_pedidos t
     where coalesce(t.cliente_telefone, t.cliente_email, t.cliente_codigo) = p_chave
     order by t.feito_em desc limit 1),
    (select 'v' || v.id from public.vendas_avulsas v where v.cliente_telefone = p_chave order by v.feita_em desc limit 1),
    (select 'l' || l.id from public.leads l where l.whatsapp = p_chave order by l.criado_em desc limit 1)
  );
$$;

-- Quem é o cliente, em uma linha: serve à lista da busca, ao topo da ficha e
-- à lista de oportunidades.
create function public.resumo_do_cliente(p_chave text)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'ref', public.ref_do_cliente(p_chave),
    'nome', coalesce(u.cliente_nome, av.cliente_nome, ld.nome),
    'telefone', case when p_chave ~ '^55[0-9]{10,11}$' then p_chave else u.cliente_telefone end,
    'email', coalesce(u.cliente_email, nullif(ld.email, '')),
    'cidade', u.cidade,
    'uf', u.uf,
    'pedidos_pagos', (
      select count(*) from public.tray_pedidos t
      where coalesce(t.cliente_telefone, t.cliente_email, t.cliente_codigo) = p_chave and t.situacao = 'pago'),
    'pedidos_nao_pagos', (
      select count(*) from public.tray_pedidos t
      where coalesce(t.cliente_telefone, t.cliente_email, t.cliente_codigo) = p_chave and t.situacao <> 'pago'),
    'vendas_por_fora', (
      select count(*) from public.vendas_avulsas v where v.cliente_telefone = p_chave and v.estornada_em is null),
    'ultima_compra', greatest(
      (select max(t.dia) from public.tray_pedidos t
       where coalesce(t.cliente_telefone, t.cliente_email, t.cliente_codigo) = p_chave and t.situacao = 'pago'),
      (select max(v.dia) from public.vendas_avulsas v where v.cliente_telefone = p_chave and v.estornada_em is null)),
    'no_grupo', exists (select 1 from public.leads l where l.whatsapp = p_chave),
    'fase', f.fase,
    'responsavel_id', f.responsavel_id,
    'responsavel', (select split_part(pr.full_name, ' ', 1) from public.profiles pr where pr.id = f.responsavel_id)
  )
  from (select 1) um
  left join lateral (
    select t.cliente_nome, t.cliente_telefone, t.cliente_email, t.cidade, t.uf
    from public.tray_pedidos t
    where coalesce(t.cliente_telefone, t.cliente_email, t.cliente_codigo) = p_chave
    order by t.feito_em desc limit 1
  ) u on true
  left join lateral (
    select v.cliente_nome from public.vendas_avulsas v
    where v.cliente_telefone = p_chave and v.cliente_nome is not null
    order by v.feita_em desc limit 1
  ) av on true
  left join lateral (
    select l.nome, l.email from public.leads l where l.whatsapp = p_chave order by l.criado_em desc limit 1
  ) ld on true
  left join public.clientes_fichas f on f.chave = p_chave;
$$;

revoke execute on function public.cliente_da_ref(text) from public, anon, authenticated;
revoke execute on function public.ref_do_cliente(text) from public, anon, authenticated;
revoke execute on function public.resumo_do_cliente(text) from public, anon, authenticated;

-- ------------------------------------------------------------------- busca

-- Busca por nome (todas as palavras, sem acento), pedaço de telefone, pedaço
-- de e-mail ou número de pedido. Sem termo nenhum: quem comprou por último,
-- ou, com p_meus, os clientes de quem a pessoa logada cuida.
create function public.buscar_clientes(
  p_nome text[] default null,
  p_telefone text default null,
  p_email text default null,
  p_pedido bigint default null,
  p_meus boolean default false,
  p_limite integer default 30
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with pode as (
    select
      public.tem_acesso('lancar_venda') as sim,
      (select auth.uid()) as eu,
      (coalesce(array_length(p_nome, 1), 0) > 0 or char_length(coalesce(p_telefone, '')) >= 4
        or char_length(coalesce(p_email, '')) >= 3 or p_pedido is not null) as tem_termo,
      least(greatest(coalesce(p_limite, 30), 1), 60) as limite
  ),
  achados as (
    select coalesce(t.cliente_telefone, t.cliente_email, t.cliente_codigo) as chave, t.feito_em as quando
    from public.tray_pedidos t, pode
    where pode.sim and pode.tem_termo and (
      (p_pedido is not null and t.pedido = p_pedido)
      or (char_length(coalesce(p_telefone, '')) >= 4 and strpos(t.cliente_telefone, p_telefone) > 0)
      or (char_length(coalesce(p_email, '')) >= 3 and strpos(t.cliente_email, lower(p_email)) > 0)
      or (coalesce(array_length(p_nome, 1), 0) > 0 and not exists (
        select 1 from unnest(p_nome) w
        where strpos(lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(t.cliente_nome, ''))), lower(w)) = 0))
    )
    union all
    select v.cliente_telefone, v.feita_em
    from public.vendas_avulsas v, pode
    where pode.sim and pode.tem_termo and v.cliente_telefone is not null and v.estornada_em is null and (
      (char_length(coalesce(p_telefone, '')) >= 4 and strpos(v.cliente_telefone, p_telefone) > 0)
      or (coalesce(array_length(p_nome, 1), 0) > 0 and not exists (
        select 1 from unnest(p_nome) w
        where strpos(lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(v.cliente_nome, ''))), lower(w)) = 0))
    )
    union all
    select l.whatsapp, l.criado_em
    from public.leads l, pode
    where pode.sim and pode.tem_termo and (
      (char_length(coalesce(p_telefone, '')) >= 4 and strpos(l.whatsapp, p_telefone) > 0)
      or (char_length(coalesce(p_email, '')) >= 3 and strpos(lower(coalesce(l.email, '')), lower(p_email)) > 0)
      or (coalesce(array_length(p_nome, 1), 0) > 0 and not exists (
        select 1 from unnest(p_nome) w
        where strpos(lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(l.nome, ''))), lower(w)) = 0))
    )
    union all
    -- Sem termo: os que compraram por último.
    select coalesce(t.cliente_telefone, t.cliente_email, t.cliente_codigo), t.feito_em
    from public.tray_pedidos t, pode
    where pode.sim and not pode.tem_termo and not coalesce(p_meus, false) and t.situacao = 'pago'
      and t.dia > (now() at time zone 'America/Sao_Paulo')::date - 30
    union all
    -- Sem termo, só os meus: as fichas de quem a pessoa cuida.
    select f.chave, f.atualizado_em
    from public.clientes_fichas f, pode
    where pode.sim and not pode.tem_termo and coalesce(p_meus, false) and f.responsavel_id = pode.eu
  ),
  unicos as (
    select chave, max(quando) as quando
    from achados
    where chave is not null
    group by chave
    order by max(quando) desc
    limit (select limite from pode)
  )
  select coalesce(jsonb_agg(public.resumo_do_cliente(u.chave) order by u.quando desc), '[]'::jsonb)
  from unicos u;
$$;

-- ------------------------------------------------------------------- ficha

create function public.ficha_do_cliente(p_ref text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_eu    uuid := (select auth.uid());
  v_chave text;
begin
  if v_eu is null or not public.tem_acesso('lancar_venda') then
    return jsonb_build_object('ok', false, 'motivo', 'sem_acesso');
  end if;

  v_chave := public.cliente_da_ref(p_ref);
  if v_chave is null then
    return jsonb_build_object('ok', false, 'motivo',
      case when p_ref ~ '^v' and exists (select 1 from public.vendas_avulsas v where v.id::text = substr(p_ref, 2))
           then 'sem_telefone' else 'nao_encontrado' end);
  end if;

  return public.resumo_do_cliente(v_chave) || jsonb_build_object(
    'ok', true,
    'eu', v_eu,
    'ficha', (
      select jsonb_build_object(
        'fase', f.fase, 'par_nome', f.par_nome,
        'aniversario', f.aniversario, 'aniversario_par', f.aniversario_par,
        'data_namoro', f.data_namoro, 'data_casamento', f.data_casamento,
        'datas_recusadas', f.datas_recusadas, 'anotacoes', f.anotacoes,
        'responsavel_id', f.responsavel_id,
        'atualizado_em', f.atualizado_em,
        'atualizado_por', (select split_part(p.full_name, ' ', 1) from public.profiles p where p.id = f.atualizado_por))
      from public.clientes_fichas f where f.chave = v_chave),
    -- O que ESTE cliente comprou e quanto pagou. O custo da peça, que mora
    -- junto no item, fica de fora de propósito.
    'pedidos', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'pedido', t.pedido, 'feito_em', t.feito_em, 'dia', t.dia, 'status', t.status, 'situacao', t.situacao,
        'total', t.total, 'pagamento', t.pagamento_tipo, 'frete', t.frete_tipo, 'cidade', t.cidade, 'uf', t.uf,
        'rastreio', nullif(t.envio_codigo, ''),
        'itens', case when jsonb_typeof(t.itens) = 'array' then (
          select coalesce(jsonb_agg(jsonb_build_object(
            'nome', i->>'nome', 'quantidade', i->>'quantidade', 'preco', i->>'preco',
            'referencia', i->>'referencia', 'info', i->>'info')), '[]'::jsonb)
          from jsonb_array_elements(t.itens) i) end
      ) order by t.feito_em desc), '[]'::jsonb)
      from public.tray_pedidos t
      where coalesce(t.cliente_telefone, t.cliente_email, t.cliente_codigo) = v_chave),
    'por_fora', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', v.id, 'dia', v.dia, 'feita_em', v.feita_em, 'valor', v.valor, 'forma', v.forma, 'canal', v.canal,
        'produto', v.produto, 'estornada', v.estornada_em is not null, 'pedido_recuperado', v.pedido_recuperado,
        'vendedor', (select split_part(p.full_name, ' ', 1) from public.profiles p where p.id = v.vendedor_id)
      ) order by v.feita_em desc), '[]'::jsonb)
      from public.vendas_avulsas v
      where v.cliente_telefone = v_chave
         or v.pedido_recuperado in (
           select t.pedido from public.tray_pedidos t
           where coalesce(t.cliente_telefone, t.cliente_email, t.cliente_codigo) = v_chave)),
    'cadastros', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'criado_em', l.criado_em, 'origem', l.origem, 'campanha', l.campanha, 'momento', l.momento,
        'clicou_grupo_em', l.clicou_grupo_em, 'entrou_grupo_em', l.entrou_grupo_em
      ) order by l.criado_em desc), '[]'::jsonb)
      from public.leads l
      where l.whatsapp = v_chave
         or (coalesce(l.email, '') <> '' and lower(l.email) in (
           select t.cliente_email from public.tray_pedidos t
           where coalesce(t.cliente_telefone, t.cliente_email, t.cliente_codigo) = v_chave and t.cliente_email is not null))),
    'recuperacao', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'pedido', s.pedido, 'estado', s.estado, 'nota', s.nota, 'atualizado_em', s.atualizado_em,
        'quem', (select split_part(p.full_name, ' ', 1) from public.profiles p where p.id = s.atualizado_por)
      ) order by s.atualizado_em desc), '[]'::jsonb)
      from public.recuperacao_casos s
      where s.pedido in (
        select t.pedido from public.tray_pedidos t
        where coalesce(t.cliente_telefone, t.cliente_email, t.cliente_codigo) = v_chave)),
    'marcadas', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'tipo', m.tipo, 'ocorrencia', m.ocorrencia, 'decisao', m.decisao, 'nota', m.nota, 'em', m.em,
        'por', (select split_part(p.full_name, ' ', 1) from public.profiles p where p.id = m.por)
      ) order by m.em desc), '[]'::jsonb)
      from public.oportunidades_marcadas m where m.chave = v_chave),
    'historico', (
      select coalesce(jsonb_agg(h.linha order by h.em desc), '[]'::jsonb)
      from (
        select a.em, jsonb_build_object(
          'em', a.em, 'campos', (select coalesce(jsonb_agg(k), '[]'::jsonb) from jsonb_object_keys(a.mudou) k),
          'por', (select split_part(p.full_name, ' ', 1) from public.profiles p where p.id = a.por)) as linha
        from public.clientes_fichas_alteracoes a
        where a.chave = v_chave
        order by a.em desc limit 10
      ) h),
    -- Quem pode cuidar de cliente: as pessoas ativas com a área de lançar venda.
    'equipe', (
      select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'nome', coalesce(nullif(btrim(p.full_name), ''), 'Sem nome'))
                                order by p.full_name), '[]'::jsonb)
      from public.profiles p
      join public.acessos_por_papel a on a.papel = p.role::text and a.area = 'lancar_venda' and a.liberado
      where p.is_active)
  );
end;
$$;

-- Grava só os campos que vierem em p_campos (chave presente com null apaga o
-- campo). `recusar_data` acrescenta uma data à lista das recusadas. Toda
-- mudança deixa uma linha em clientes_fichas_alteracoes, com quem e quando.
create function public.salvar_ficha_do_cliente(p_ref text, p_campos jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu     uuid := (select auth.uid());
  v_chave  text;
  v_campo  text;
  v_resp   uuid;
  v_antes  jsonb;
  v_depois jsonb;
  v_mudou  jsonb;
begin
  if v_eu is null or not public.tem_acesso('lancar_venda') then
    return jsonb_build_object('ok', false, 'motivo', 'sem_acesso');
  end if;
  v_chave := public.cliente_da_ref(p_ref);
  if v_chave is null then
    return jsonb_build_object('ok', false, 'motivo', 'nao_encontrado');
  end if;
  if p_campos is null or jsonb_typeof(p_campos) <> 'object' then
    return jsonb_build_object('ok', false, 'motivo', 'campos');
  end if;

  if p_campos ? 'fase' and coalesce(p_campos->>'fase', '') not in ('namoro', 'noivado', 'casamento_marcado', 'casado', 'nao_sei') then
    return jsonb_build_object('ok', false, 'motivo', 'fase');
  end if;
  foreach v_campo in array array['aniversario', 'aniversario_par', 'data_namoro', 'data_casamento'] loop
    if p_campos ? v_campo and not public.data_parcial_existe(p_campos->>v_campo) then
      return jsonb_build_object('ok', false, 'motivo', 'data', 'campo', v_campo);
    end if;
  end loop;
  if p_campos ? 'recusar_data' and (p_campos->>'recusar_data' is null or not public.data_parcial_existe(p_campos->>'recusar_data')) then
    return jsonb_build_object('ok', false, 'motivo', 'data', 'campo', 'recusar_data');
  end if;
  if char_length(coalesce(p_campos->>'par_nome', '')) > 120 or char_length(coalesce(p_campos->>'anotacoes', '')) > 2000 then
    return jsonb_build_object('ok', false, 'motivo', 'longo');
  end if;
  if p_campos ? 'responsavel_id' and p_campos->>'responsavel_id' is not null then
    if (p_campos->>'responsavel_id') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      return jsonb_build_object('ok', false, 'motivo', 'responsavel');
    end if;
    v_resp := (p_campos->>'responsavel_id')::uuid;
    if not exists (
      select 1 from public.profiles p
      join public.acessos_por_papel a on a.papel = p.role::text and a.area = 'lancar_venda' and a.liberado
      where p.id = v_resp and p.is_active
    ) then
      return jsonb_build_object('ok', false, 'motivo', 'responsavel');
    end if;
  end if;

  insert into public.clientes_fichas (chave, criado_por, atualizado_por)
  values (v_chave, v_eu, v_eu)
  on conflict (chave) do nothing;

  select to_jsonb(f) into v_antes from public.clientes_fichas f where f.chave = v_chave for update;

  update public.clientes_fichas f set
    fase            = case when p_campos ? 'fase' then p_campos->>'fase' else f.fase end,
    par_nome        = case when p_campos ? 'par_nome' then nullif(btrim(p_campos->>'par_nome'), '') else f.par_nome end,
    aniversario     = case when p_campos ? 'aniversario' then (p_campos->>'aniversario')::public.data_parcial else f.aniversario end,
    aniversario_par = case when p_campos ? 'aniversario_par' then (p_campos->>'aniversario_par')::public.data_parcial else f.aniversario_par end,
    data_namoro     = case when p_campos ? 'data_namoro' then (p_campos->>'data_namoro')::public.data_parcial else f.data_namoro end,
    data_casamento  = case when p_campos ? 'data_casamento' then (p_campos->>'data_casamento')::public.data_parcial else f.data_casamento end,
    anotacoes       = case when p_campos ? 'anotacoes' then nullif(btrim(p_campos->>'anotacoes'), '') else f.anotacoes end,
    responsavel_id  = case when p_campos ? 'responsavel_id' then v_resp else f.responsavel_id end,
    datas_recusadas = case
                        when p_campos ? 'recusar_data' and not (p_campos->>'recusar_data' = any (f.datas_recusadas))
                        then f.datas_recusadas || (p_campos->>'recusar_data')
                        else f.datas_recusadas
                      end
  where f.chave = v_chave
  returning to_jsonb(f) into v_depois;

  select coalesce(jsonb_object_agg(a.key, jsonb_build_object('de', a.value, 'para', d.value)), '{}'::jsonb)
    into v_mudou
  from jsonb_each(v_antes) a
  join jsonb_each(v_depois) d on d.key = a.key
  where a.key in ('fase', 'par_nome', 'aniversario', 'aniversario_par', 'data_namoro', 'data_casamento',
                  'anotacoes', 'responsavel_id', 'datas_recusadas')
    and a.value is distinct from d.value;

  if v_mudou <> '{}'::jsonb then
    update public.clientes_fichas f set atualizado_por = v_eu, atualizado_em = now() where f.chave = v_chave;
    insert into public.clientes_fichas_alteracoes (chave, por, mudou) values (v_chave, v_eu, v_mudou);
  end if;

  return jsonb_build_object('ok', true, 'mudou', (select count(*) from jsonb_object_keys(v_mudou)));
end;
$$;

-- ----------------------------------------------------------- oportunidades

-- "Já falei", "não vale" ou reabrir UMA ocorrência. Guarda quem e quando.
create function public.marcar_oportunidade(
  p_ref text,
  p_tipo text,
  p_ocorrencia date,
  p_decisao text,
  p_nota text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu    uuid := (select auth.uid());
  v_hoje  date := (now() at time zone 'America/Sao_Paulo')::date;
  v_chave text;
begin
  if v_eu is null or not public.tem_acesso('lancar_venda') then
    return jsonb_build_object('ok', false, 'motivo', 'sem_acesso');
  end if;
  v_chave := public.cliente_da_ref(p_ref);
  if v_chave is null then
    return jsonb_build_object('ok', false, 'motivo', 'nao_encontrado');
  end if;
  if p_decisao is null or p_decisao not in ('falei', 'nao_vale', 'reaberta')
     or p_tipo is null or p_tipo not in (
       'aniversario_cliente', 'aniversario_par', 'aniversario_namoro', 'aniversario_casamento',
       'casamento_chegando', 'namoro_sem_noivado', 'um_ano_da_compra')
     or p_ocorrencia is null or p_ocorrencia not between v_hoje - 400 and v_hoje + 400
     or char_length(coalesce(p_nota, '')) > 300 then
    return jsonb_build_object('ok', false, 'motivo', 'dados');
  end if;

  insert into public.oportunidades_marcadas (chave, tipo, ocorrencia, decisao, nota, por)
  values (v_chave, p_tipo, p_ocorrencia, p_decisao, nullif(btrim(p_nota), ''), v_eu)
  on conflict (chave, tipo, ocorrencia)
  do update set decisao = excluded.decisao, nota = excluded.nota, por = excluded.por, em = now();

  return jsonb_build_object('ok', true);
end;
$$;

-- Quem PODE ter alguma coisa vencendo entre p_de e p_ate, com o que se sabe de
-- cada um.
--
-- É um filtro largo, de propósito: separa quem tem data na ficha ou gravação
-- com um dia e mês da janela, e quem tem compra que completa um dos marcos
-- (`p_marcos`, em meses depois da compra, repetidos de ano em ano) dentro
-- dela. Quem decide o que é oportunidade é o código, que tem teste. O que este
-- filtro não pode é deixar de fora alguém que o código aceitaria.
--
-- O marco é conferido pela DATA inteira, não pelo dia e mês: na primeira
-- versão todo pedido dos últimos meses entrava como candidato a "um ano da
-- compra", porque o dia e o mês de hoje são os mesmos do ano que vem.
create function public.base_de_oportunidades(p_de date, p_ate date, p_marcos integer[])
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with pode as (select public.tem_acesso('lancar_venda') as sim),
  limites as (select p_de as de, least(p_ate, p_de + 400) as ate),
  janela as (
    -- Os dias do ano da janela, em MM-DD. 28 e 29 de fevereiro andam juntos:
    -- a data que cai num cai no outro conforme o ano.
    select array(
      select distinct to_char(d, 'MM-DD')
      from limites, generate_series(limites.de::timestamp, limites.ate::timestamp, interval '1 day') d
    ) as dias
  ),
  dias as (
    select case when j.dias && array['02-28', '02-29'] then j.dias || array['02-28', '02-29'] else j.dias end as lista
    from janela j
  ),
  pagos as (
    select coalesce(t.cliente_telefone, t.cliente_email, t.cliente_codigo) as chave, t.dia, t.itens
    from public.tray_pedidos t
    where (select sim from pode) and t.situacao = 'pago'
  ),
  candidatos as (
    select f.chave
    from public.clientes_fichas f, dias
    where (select sim from pode) and (
      right(f.aniversario, 5) = any (dias.lista) or right(f.aniversario_par, 5) = any (dias.lista)
      or right(f.data_namoro, 5) = any (dias.lista) or right(f.data_casamento, 5) = any (dias.lista))
    union
    select p.chave
    from pagos p, limites
    where p.dia < limites.ate and exists (
      select 1
      from unnest(p_marcos) m, generate_series(0, greatest((limites.ate - p.dia) / 365, 0) + 1) k
      where (p.dia + make_interval(months => m + 12 * k))::date between limites.de and limites.ate)
    union
    select p.chave
    from pagos p, dias
    where jsonb_typeof(p.itens) = 'array' and exists (
      select 1
      from jsonb_array_elements(p.itens) i,
           regexp_matches(coalesce(i->>'info', ''), '([0-9]{1,2})\s*[./-]\s*([0-9]{1,2})', 'g') as m
      where lpad(m[2], 2, '0') || '-' || lpad(m[1], 2, '0') = any (dias.lista))
    union
    select v.cliente_telefone
    from public.vendas_avulsas v, limites
    where (select sim from pode) and v.estornada_em is null and v.cliente_telefone is not null
      and v.dia < limites.ate and exists (
        select 1
        from unnest(p_marcos) m, generate_series(0, greatest((limites.ate - v.dia) / 365, 0) + 1) k
        where (v.dia + make_interval(months => m + 12 * k))::date between limites.de and limites.ate)
  )
  select jsonb_build_object(
    'eu', (select auth.uid()),
    'clientes', coalesce((
      select jsonb_agg(public.resumo_do_cliente(c.chave) || jsonb_build_object(
        'ficha', (
          select jsonb_build_object(
            'fase', f.fase, 'par_nome', f.par_nome,
            'aniversario', f.aniversario, 'aniversario_par', f.aniversario_par,
            'data_namoro', f.data_namoro, 'data_casamento', f.data_casamento,
            'datas_recusadas', f.datas_recusadas)
          from public.clientes_fichas f where f.chave = c.chave),
        -- Só compra paga, e só o nome e o que cada peça pedia: sem preço nenhum.
        'compras', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'pedido', t.pedido, 'dia', t.dia, 'frete', t.frete_tipo, 'cidade', t.cidade, 'uf', t.uf,
            'pecas', case when jsonb_typeof(t.itens) = 'array' then (
              select coalesce(jsonb_agg(jsonb_build_object('nome', i->>'nome', 'info', i->>'info')), '[]'::jsonb)
              from jsonb_array_elements(t.itens) i
              where coalesce(nullif(i->>'preco', '')::numeric, 0) > 0) end
          ) order by t.dia), '[]'::jsonb)
          from public.tray_pedidos t
          where coalesce(t.cliente_telefone, t.cliente_email, t.cliente_codigo) = c.chave and t.situacao = 'pago'),
        'por_fora', (
          select coalesce(jsonb_agg(jsonb_build_object('dia', v.dia, 'produto', v.produto) order by v.dia), '[]'::jsonb)
          from public.vendas_avulsas v
          where v.cliente_telefone = c.chave and v.estornada_em is null),
        'marcadas', (
          select coalesce(jsonb_agg(jsonb_build_object('tipo', m.tipo, 'ocorrencia', m.ocorrencia, 'decisao', m.decisao)), '[]'::jsonb)
          from public.oportunidades_marcadas m where m.chave = c.chave)
      ))
      from candidatos c
      where c.chave is not null
    ), '[]'::jsonb)
  );
$$;

revoke execute on function public.data_parcial_existe(text) from public, anon;
revoke execute on function public.buscar_clientes(text[], text, text, bigint, boolean, integer) from public, anon;
revoke execute on function public.ficha_do_cliente(text) from public, anon;
revoke execute on function public.salvar_ficha_do_cliente(text, jsonb) from public, anon;
revoke execute on function public.marcar_oportunidade(text, text, date, text, text) from public, anon;
revoke execute on function public.base_de_oportunidades(date, date, integer[]) from public, anon;

grant execute on function public.data_parcial_existe(text) to authenticated, service_role;
grant execute on function public.buscar_clientes(text[], text, text, bigint, boolean, integer) to authenticated, service_role;
grant execute on function public.ficha_do_cliente(text) to authenticated, service_role;
grant execute on function public.salvar_ficha_do_cliente(text, jsonb) to authenticated, service_role;
grant execute on function public.marcar_oportunidade(text, text, date, text, text) to authenticated, service_role;
grant execute on function public.base_de_oportunidades(date, date, integer[]) to authenticated, service_role;
