-- 0141: o Roadmap do painel, um quadro de trabalho para quem mexe no código.
--
-- De onde veio: pedido do Filipe em 18/11/2026. Duas pessoas mexem no código
-- do painel, cada uma com o próprio Claude (o Filipe e o Erick), e uma
-- atrapalhava a outra. Ele pediu "um ambiente de Roadmap, estilo kanban, que
-- mostre o que queremos corrigir, melhorar e atualizar, o que está sendo feito
-- e por quem", para o Claude sempre consultar antes de mexer e trabalhar num
-- ramo separado.
--
-- COMO FOI DESENHADO:
--
-- 1. Um cartão por trabalho, em seis colunas: ideias, a_fazer, fazendo,
--    em_revisao, no_ar e descartado. Cada cartão diz o tipo (correção,
--    melhoria, atualização, segurança), a prioridade, quem pegou (e se é o
--    Claude dessa pessoa, com o nome da sessão), o ramo do git, o pedido de
--    revisão e os CAMINHOS que o trabalho vai mexer (pastas, arquivos ou telas).
--
-- 2. O "inteligente" é o cruzamento de caminhos. Quem pega um cartão declara
--    onde vai mexer, e o quadro avisa quando outro cartão em fazendo ou
--    em_revisao já declarou um caminho que se sobrepõe (um é o outro, ou um
--    está dentro do outro). A regra mora numa função só (`roadmap_cruzam`),
--    usada pela tela, pelo conector e pela conferência antes de pegar. Tela
--    do painel vale como pasta: `/admin/vendas` é
--    `src/app/admin/(painel)/vendas`. É aviso, não trava: duas pessoas podem
--    combinar e seguir.
--
-- 3. Área NOVA `roadmap`, para administrador, dono e GM (o Filipe e o Erick
--    são GM). Mudar quem vê é mudar uma linha em `acessos_por_papel`.
--
-- 4. Duas portas, a mesma regra. A tela chama as funções com a sessão da
--    pessoa (`auth.uid()`). O conector do Claude roda com a chave de serviço e
--    não tem sessão: passa `p_quem`, o id de quem ligou o conector, e a
--    função só aceita esse parâmetro quando quem chama é a chave de serviço
--    (`roadmap_quem`). Com sessão, `p_quem` é ignorado. A área é conferida por
--    dentro, para o id que vale, sempre em `coalesce(..., false)`.
--
-- 5. Sugestões viram cartões. "Levar para o roadmap" cria o cartão ligado à
--    sugestão (0140), e a partir daí o estado da sugestão anda com o cartão
--    por um GATILHO só (`roadmap_anda_a_sugestao`): ideias e a fazer viram
--    "planejada", fazendo e em revisão viram "em andamento", no ar vira
--    "feita" e descartado vira "não vai entrar". A nota do movimento é a
--    resposta que quem sugeriu lê; sem nota, vai uma frase pronta. Sugestão
--    ligada a cartão não muda mais de estado pela tela de sugestões
--    (`sugestao_mudar` recusa), senão as duas portas discordariam.
--
-- 6. Criar em lote, para a auditoria de segurança e para a carga inicial.
--    `roadmap_criar` aceita até 100 cartões de uma vez, cada um com uma
--    `referencia` opcional: rodar o mesmo lote duas vezes não duplica nada.
--
-- 7. Ninguém lê nem grava direto: RLS ligada, sem policy. O histórico
--    (`roadmap_movimentos`) é escrito pelas próprias funções e diz quem fez o
--    quê, e se foi pela tela ou pelo conector.
--
-- 8. Travessão vira vírgula ao gravar (título, descrição e nota): a casa não
--    usa travessão, e um lote vindo de outra ferramenta não deve ser recusado
--    por isso.

-- ------------------------------------------------------------------ a área

-- A trava de áreas é refeita a partir da que está no banco na hora, com
-- `roadmap` acrescentada (o mesmo jeito da 0102).
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
  if not ('roadmap' = any (v_areas)) then
    v_areas := v_areas || 'roadmap'::text;
  end if;
  alter table public.acessos_por_papel drop constraint acessos_por_papel_area_check;
  execute format('alter table public.acessos_por_papel add constraint acessos_por_papel_area_check check (area in (%s))',
    (select string_agg(quote_literal(a), ', ' order by n) from unnest(v_areas) with ordinality as u (a, n)));
end
$$;

insert into public.acessos_por_papel (papel, area)
select p, 'roadmap' from unnest(array['admin', 'dono', 'gm']) as p
on conflict do nothing;

-- ---------------------------------------------------------------- as tabelas

create table public.roadmap_cartoes (
  id bigint generated always as identity primary key,
  criado_em timestamptz not null default now(),
  criado_por uuid references public.profiles (id),
  titulo text not null check (char_length(btrim(titulo)) between 3 and 160),
  descricao text check (char_length(descricao) <= 8000),
  tipo text not null default 'melhoria' check (tipo in ('correcao', 'melhoria', 'atualizacao', 'seguranca')),
  prioridade text not null default 'media' check (prioridade in ('urgente', 'alta', 'media', 'baixa')),
  coluna text not null default 'ideias' check (coluna in ('ideias', 'a_fazer', 'fazendo', 'em_revisao', 'no_ar', 'descartado')),
  -- Quem pegou. Quando é o Claude dessa pessoa, `via_claude` e o nome da sessão.
  responsavel uuid references public.profiles (id),
  via_claude boolean not null default false,
  sessao text check (char_length(sessao) <= 160),
  ramo text check (char_length(ramo) <= 200 and ramo ~ '^[A-Za-z0-9._/-]+$'),
  pr_url text check (char_length(pr_url) <= 300 and pr_url ~ '^https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/pull/[0-9]+$'),
  -- Como a pessoa escreveu. A comparação normaliza na hora (`roadmap_caminho`).
  caminhos text[] not null default '{}' check (cardinality(caminhos) <= 30),
  sugestao_id bigint unique references public.sugestoes (id),
  origem text not null default 'manual' check (origem in ('manual', 'sugestao', 'auditoria', 'conector', 'carga')),
  -- Chave de quem cria em lote, para o mesmo lote rodado de novo não duplicar.
  referencia text unique check (char_length(referencia) between 3 and 120),
  -- A nota do último movimento: o motivo do descarte, o que foi feito.
  ultima_nota text check (char_length(ultima_nota) <= 2000),
  mudou_em timestamptz not null default now(),
  mudou_por uuid references public.profiles (id),
  pegou_em timestamptz,
  concluido_em timestamptz,
  constraint roadmap_em_trabalho_tem_dono check (coluna not in ('fazendo', 'em_revisao') or responsavel is not null)
);

create index roadmap_cartoes_coluna_idx on public.roadmap_cartoes (coluna, mudou_em desc);

create table public.roadmap_movimentos (
  id bigint generated always as identity primary key,
  cartao bigint not null references public.roadmap_cartoes (id),
  em timestamptz not null default now(),
  por uuid references public.profiles (id),
  pelo_conector boolean not null default false,
  acao text not null check (acao in ('criou', 'editou', 'pegou', 'moveu', 'ligou_pr', 'levou_sugestao')),
  de text,
  para text,
  nota text check (char_length(nota) <= 2000),
  detalhe jsonb not null default '{}'::jsonb
);

create index roadmap_movimentos_cartao_idx on public.roadmap_movimentos (cartao, em desc);

alter table public.roadmap_cartoes enable row level security;
alter table public.roadmap_movimentos enable row level security;
revoke all on public.roadmap_cartoes from anon, authenticated;
revoke all on public.roadmap_movimentos from anon, authenticated;

-- ------------------------------------------------------- peças de dentro

-- Quem está agindo. Com sessão, a própria pessoa (e `p_quem` é ignorado).
-- Sem sessão, só a chave de serviço (o conector) pode dizer quem é.
create or replace function public.roadmap_quem(p_quem uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select auth.uid()) is not null then (select auth.uid())
    when coalesce((select auth.role()) = 'service_role', false) then p_quem
  end
$$;

-- A pessoa tem a área `roadmap`? (o `tem_acesso` de 0056, para um id dado).
create or replace function public.roadmap_pode(p_quem uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_quem is not null and exists (
    select 1
    from public.profiles p
    join public.acessos_por_papel a on a.papel = p.role::text
    where p.id = p_quem and p.is_active and a.area = 'roadmap' and a.liberado
  )
$$;

-- As sugestões são da diretoria (0140): o roadmap só mostra o texto delas a quem é.
create or replace function public.roadmap_diretoria(p_quem uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_quem is not null and exists (
    select 1 from public.profiles p where p.id = p_quem and p.is_active and p.role::text in ('admin', 'dono', 'gm')
  )
$$;

-- Texto limpo: sem espaço sobrando e sem travessão.
create or replace function public.roadmap_texto(p text, p_max integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(left(btrim(regexp_replace(coalesce(p, ''), '\s*[—–]\s*', ', ', 'g')), p_max), '')
$$;

-- Um caminho no formato de comparação. Tela do painel vira a pasta dela.
create or replace function public.roadmap_caminho(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when v = '' then null
    when v = '/admin' then 'src/app/admin/(painel)/page.tsx'
    when starts_with(v, '/admin/') then 'src/app/admin/(painel)' || substr(v, 7)
    else regexp_replace(v, '^/+', '')
  end
  from (
    select regexp_replace(
             regexp_replace(
               regexp_replace(replace(lower(btrim(coalesce(p, ''))), '\', '/'), '^(\./)+', ''),
               '(/\*+)+$', ''),
             '/+$', '') as v
  ) x
$$;

-- A regra do cruzamento: o mesmo caminho, ou um dentro do outro.
create or replace function public.roadmap_cruzam(a text, b text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select a is not null and b is not null and (a = b or starts_with(a, b || '/') or starts_with(b, a || '/'))
$$;

-- A lista que a pessoa mandou, limpa: sem vazio, sem repetido, até 30.
create or replace function public.roadmap_lista_de_caminhos(p text[])
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(c order by n), '{}')
  from (
    select c, min(n) as n
    from (
      select left(btrim(x), 200) as c, n
      from unnest(coalesce(p, '{}')) with ordinality as u (x, n)
    ) y
    where c <> '' and public.roadmap_caminho(c) is not null
    group by c
    order by min(n)
    limit 30
  ) z
$$;

-- Os cartões em trabalho (fazendo e em revisão) que cruzam com estes caminhos.
create or replace function public.roadmap_conflitos_de(p_caminhos text[], p_exceto bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with meus as (
    select distinct c as original, public.roadmap_caminho(c) as c
    from unnest(coalesce(p_caminhos, '{}')) as c
  ),
  deles as (
    select k.id, x as original, public.roadmap_caminho(x) as c
    from public.roadmap_cartoes k, unnest(k.caminhos) as x
    where k.coluna in ('fazendo', 'em_revisao') and k.id is distinct from p_exceto
  ),
  pares as (
    select d.id, jsonb_agg(distinct jsonb_build_object('meu', m.original, 'dele', d.original)) as cruzam
    from meus m
    join deles d on public.roadmap_cruzam(m.c, d.c)
    group by d.id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', k.id,
    'titulo', k.titulo,
    'coluna', k.coluna,
    'responsavel', r.full_name,
    'responsavel_id', k.responsavel,
    'via_claude', k.via_claude,
    'sessao', k.sessao,
    'ramo', k.ramo,
    'pr_url', k.pr_url,
    'cruzam', p.cruzam
  ) order by k.id), '[]'::jsonb)
  from pares p
  join public.roadmap_cartoes k on k.id = p.id
  left join public.profiles r on r.id = k.responsavel
$$;

-- Um cartão como a tela e o conector leem.
create or replace function public.roadmap_cartao_json(p_id bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', k.id,
    'titulo', k.titulo,
    'descricao', k.descricao,
    'tipo', k.tipo,
    'prioridade', k.prioridade,
    'coluna', k.coluna,
    'responsavel', r.full_name,
    'responsavel_id', k.responsavel,
    'via_claude', k.via_claude,
    'sessao', k.sessao,
    'ramo', k.ramo,
    'pr_url', k.pr_url,
    'caminhos', to_jsonb(k.caminhos),
    'sugestao_id', k.sugestao_id,
    'origem', k.origem,
    'referencia', k.referencia,
    'ultima_nota', k.ultima_nota,
    'criado_em', k.criado_em,
    'criado_por', c.full_name,
    'mudou_em', k.mudou_em,
    'mudou_por', m.full_name,
    'pegou_em', k.pegou_em,
    'concluido_em', k.concluido_em,
    'conflitos', case
      when k.coluna in ('no_ar', 'descartado') or cardinality(k.caminhos) = 0 then '[]'::jsonb
      else public.roadmap_conflitos_de(k.caminhos, k.id)
    end
  )
  from public.roadmap_cartoes k
  left join public.profiles r on r.id = k.responsavel
  left join public.profiles c on c.id = k.criado_por
  left join public.profiles m on m.id = k.mudou_por
  where k.id = p_id
$$;

create or replace function public.roadmap_anotar(
  p_cartao bigint, p_por uuid, p_acao text, p_de text, p_para text, p_nota text, p_detalhe jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.roadmap_movimentos (cartao, por, pelo_conector, acao, de, para, nota, detalhe)
  values (p_cartao, p_por, (select auth.uid()) is null, p_acao, p_de, p_para, left(p_nota, 2000), coalesce(p_detalhe, '{}'::jsonb))
$$;

-- ------------------------------------------------------- o gatilho da sugestão

-- A ÚNICA regra que anda a sugestão junto com o cartão.
create or replace function public.roadmap_anda_a_sugestao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estado text;
  v_resposta text;
begin
  if new.sugestao_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.coluna = old.coluna and new.sugestao_id is not distinct from old.sugestao_id then
    return new;
  end if;
  v_estado := case new.coluna
    when 'ideias' then 'planejada'
    when 'a_fazer' then 'planejada'
    when 'fazendo' then 'em_andamento'
    when 'em_revisao' then 'em_andamento'
    when 'no_ar' then 'feita'
    when 'descartado' then 'recusada'
  end;
  v_resposta := coalesce(new.ultima_nota, case new.coluna
    when 'ideias' then 'Entrou no roadmap do painel, na lista de ideias.'
    when 'a_fazer' then 'Entrou no roadmap do painel, na fila do que vai ser feito.'
    when 'fazendo' then 'Já está sendo feita.'
    when 'em_revisao' then 'Está pronta e passa pela revisão antes de ir ao ar.'
    when 'no_ar' then 'Está no ar. Obrigado pela sugestão.'
    when 'descartado' then 'Não vai entrar agora.'
  end);
  update public.sugestoes s
  set estado = v_estado,
      resposta = left(v_resposta, 2000),
      estado_mudou_em = now(),
      estado_por = coalesce(new.mudou_por, new.criado_por)
  where s.id = new.sugestao_id;
  return new;
end;
$$;

create trigger roadmap_anda_a_sugestao
after insert or update of coluna, sugestao_id on public.roadmap_cartoes
for each row execute function public.roadmap_anda_a_sugestao();

-- ------------------------------------------------------------------- leitura

-- O quadro: os cartões abertos e o que foi concluído nos últimos 60 dias,
-- quem pode pegar cartão e as sugestões novas que esperam ir para o quadro.
create or replace function public.roadmap_quadro(p_quem uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_eu uuid := public.roadmap_quem(p_quem);
begin
  if not coalesce(public.roadmap_pode(v_eu), false) then
    return jsonb_build_object('ok', false, 'motivo', 'sem_acesso');
  end if;
  return jsonb_build_object(
    'ok', true,
    'eu', v_eu,
    'cartoes', coalesce((
      select jsonb_agg(public.roadmap_cartao_json(k.id) order by
        case k.prioridade when 'urgente' then 0 when 'alta' then 1 when 'media' then 2 else 3 end, k.mudou_em desc)
      from public.roadmap_cartoes k
      where k.coluna not in ('no_ar', 'descartado') or k.concluido_em > now() - interval '60 days'
    ), '[]'::jsonb),
    'pessoas', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.full_name) order by p.full_name)
      from public.profiles p
      where public.roadmap_pode(p.id)
    ), '[]'::jsonb),
    'sugestoes', case when coalesce(public.roadmap_diretoria(v_eu), false) then coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'criada_em', s.criada_em,
        'autor', a.full_name,
        'tela', s.tela,
        'tela_nome', s.tela_nome,
        'texto', left(s.texto, 600),
        'prints', cardinality(s.imagens)
      ) order by s.criada_em)
      from public.sugestoes s
      left join public.profiles a on a.id = s.autor
      where s.estado = 'nova' and not exists (select 1 from public.roadmap_cartoes k where k.sugestao_id = s.id)
    ), '[]'::jsonb) else '[]'::jsonb end
  );
end;
$$;

-- Um cartão inteiro: o cartão, o histórico e a sugestão de onde veio.
create or replace function public.roadmap_ver(p_id bigint, p_quem uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_eu uuid := public.roadmap_quem(p_quem);
  v_cartao jsonb;
begin
  if not coalesce(public.roadmap_pode(v_eu), false) then
    return jsonb_build_object('ok', false, 'motivo', 'sem_acesso');
  end if;
  v_cartao := public.roadmap_cartao_json(p_id);
  if v_cartao is null then
    return jsonb_build_object('ok', false, 'motivo', 'nao_achou');
  end if;
  return jsonb_build_object(
    'ok', true,
    'cartao', v_cartao,
    'historico', coalesce((
      select jsonb_agg(jsonb_build_object(
        'em', h.em, 'por', p.full_name, 'pelo_conector', h.pelo_conector, 'acao', h.acao,
        'de', h.de, 'para', h.para, 'nota', h.nota, 'detalhe', h.detalhe
      ) order by h.em desc, h.id desc)
      from public.roadmap_movimentos h
      left join public.profiles p on p.id = h.por
      where h.cartao = p_id
    ), '[]'::jsonb),
    'sugestao', case when coalesce(public.roadmap_diretoria(v_eu), false) then (
      select jsonb_build_object('id', s.id, 'texto', s.texto, 'autor', a.full_name, 'tela', s.tela, 'tela_nome', s.tela_nome,
                                'estado', s.estado, 'resposta', s.resposta, 'criada_em', s.criada_em)
      from public.sugestoes s
      left join public.profiles a on a.id = s.autor
      where s.id = (v_cartao ->> 'sugestao_id')::bigint
    ) end
  );
end;
$$;

-- Antes de pegar: quem já está mexendo onde eu vou mexer?
create or replace function public.roadmap_conflitos(p_caminhos text[], p_exceto bigint default null, p_quem uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_eu uuid := public.roadmap_quem(p_quem);
begin
  if not coalesce(public.roadmap_pode(v_eu), false) then
    return jsonb_build_object('ok', false, 'motivo', 'sem_acesso');
  end if;
  return jsonb_build_object('ok', true, 'conflitos', public.roadmap_conflitos_de(public.roadmap_lista_de_caminhos(p_caminhos), p_exceto));
end;
$$;

-- ------------------------------------------------------------------- escrita

-- Criar um cartão ou um lote (até 100). Cartão com `referencia` que já existe
-- é pulado, para o mesmo lote poder rodar de novo.
create or replace function public.roadmap_criar(p_cartoes jsonb, p_quem uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu uuid := public.roadmap_quem(p_quem);
  v_lote jsonb := p_cartoes;
  v_item jsonb;
  v_n integer;
  v_titulo text;
  v_tipo text;
  v_prioridade text;
  v_coluna text;
  v_ref text;
  v_origem text;
  v_caminhos text[];
  v_id bigint;
  v_existente bigint;
  v_criados jsonb := '[]'::jsonb;
  v_pulados jsonb := '[]'::jsonb;
  v_recusados jsonb := '[]'::jsonb;
begin
  if not coalesce(public.roadmap_pode(v_eu), false) then
    return jsonb_build_object('ok', false, 'motivo', 'sem_acesso');
  end if;
  if jsonb_typeof(v_lote) = 'object' then
    v_lote := jsonb_build_array(v_lote);
  end if;
  if jsonb_typeof(v_lote) is distinct from 'array' or jsonb_array_length(v_lote) = 0 then
    return jsonb_build_object('ok', false, 'motivo', 'formato');
  end if;
  if jsonb_array_length(v_lote) > 100 then
    return jsonb_build_object('ok', false, 'motivo', 'lote_grande');
  end if;

  for v_item, v_n in select e, n::integer from jsonb_array_elements(v_lote) with ordinality as t (e, n) loop
    v_titulo := public.roadmap_texto(v_item ->> 'titulo', 160);
    v_tipo := coalesce(nullif(v_item ->> 'tipo', ''), 'melhoria');
    v_prioridade := coalesce(nullif(v_item ->> 'prioridade', ''), 'media');
    v_coluna := coalesce(nullif(v_item ->> 'coluna', ''), 'ideias');
    v_ref := public.roadmap_texto(v_item ->> 'referencia', 120);
    v_origem := case
      when v_item ->> 'origem' in ('auditoria', 'carga') then v_item ->> 'origem'
      when (select auth.uid()) is null then 'conector'
      else 'manual'
    end;

    if jsonb_typeof(v_item) is distinct from 'object' then
      v_recusados := v_recusados || jsonb_build_object('indice', v_n, 'motivo', 'formato');
      continue;
    end if;
    if v_titulo is null or char_length(v_titulo) < 3 then
      v_recusados := v_recusados || jsonb_build_object('indice', v_n, 'motivo', 'titulo');
      continue;
    end if;
    if v_tipo not in ('correcao', 'melhoria', 'atualizacao', 'seguranca') then
      v_recusados := v_recusados || jsonb_build_object('indice', v_n, 'titulo', v_titulo, 'motivo', 'tipo');
      continue;
    end if;
    if v_prioridade not in ('urgente', 'alta', 'media', 'baixa') then
      v_recusados := v_recusados || jsonb_build_object('indice', v_n, 'titulo', v_titulo, 'motivo', 'prioridade');
      continue;
    end if;
    if v_coluna not in ('ideias', 'a_fazer') then
      v_recusados := v_recusados || jsonb_build_object('indice', v_n, 'titulo', v_titulo, 'motivo', 'coluna');
      continue;
    end if;
    if v_ref is not null and char_length(v_ref) < 3 then
      v_recusados := v_recusados || jsonb_build_object('indice', v_n, 'titulo', v_titulo, 'motivo', 'referencia');
      continue;
    end if;
    if v_ref is not null then
      select k.id into v_existente from public.roadmap_cartoes k where k.referencia = v_ref;
      if v_existente is not null then
        v_pulados := v_pulados || jsonb_build_object('indice', v_n, 'id', v_existente, 'referencia', v_ref);
        v_existente := null;
        continue;
      end if;
    end if;
    v_caminhos := case when jsonb_typeof(v_item -> 'caminhos') = 'array'
      then public.roadmap_lista_de_caminhos(array(select jsonb_array_elements_text(v_item -> 'caminhos')))
      else '{}'::text[] end;

    begin
      insert into public.roadmap_cartoes (criado_por, titulo, descricao, tipo, prioridade, coluna, caminhos, origem, referencia, mudou_por)
      values (v_eu, v_titulo, public.roadmap_texto(v_item ->> 'descricao', 8000), v_tipo, v_prioridade, v_coluna, v_caminhos, v_origem, v_ref, v_eu)
      returning id into v_id;
    exception when others then
      v_recusados := v_recusados || jsonb_build_object('indice', v_n, 'titulo', v_titulo, 'motivo', 'gravar');
      continue;
    end;
    perform public.roadmap_anotar(v_id, v_eu, 'criou', null, v_coluna, null, jsonb_build_object('origem', v_origem));
    v_criados := v_criados || jsonb_build_object('indice', v_n, 'id', v_id, 'titulo', v_titulo, 'referencia', v_ref);
  end loop;

  return jsonb_build_object('ok', true, 'criados', v_criados, 'ja_existiam', v_pulados, 'recusados', v_recusados);
end;
$$;

-- Mudar o que está escrito no cartão: título, descrição, tipo, prioridade,
-- caminhos, ramo e sessão. Só as chaves que vierem.
create or replace function public.roadmap_editar(p_id bigint, p_campos jsonb, p_quem uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu uuid := public.roadmap_quem(p_quem);
  v_k public.roadmap_cartoes;
  v_c jsonb := coalesce(p_campos, '{}'::jsonb);
  v_titulo text;
  v_ramo text;
  v_mudou text[] := '{}';
begin
  if not coalesce(public.roadmap_pode(v_eu), false) then
    return jsonb_build_object('ok', false, 'motivo', 'sem_acesso');
  end if;
  select * into v_k from public.roadmap_cartoes k where k.id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'nao_achou');
  end if;

  if v_c ? 'titulo' then
    v_titulo := public.roadmap_texto(v_c ->> 'titulo', 160);
    if v_titulo is null or char_length(v_titulo) < 3 then
      return jsonb_build_object('ok', false, 'motivo', 'titulo');
    end if;
    if v_titulo is distinct from v_k.titulo then v_k.titulo := v_titulo; v_mudou := array_append(v_mudou, 'titulo'); end if;
  end if;
  if v_c ? 'descricao' and public.roadmap_texto(v_c ->> 'descricao', 8000) is distinct from v_k.descricao then
    v_k.descricao := public.roadmap_texto(v_c ->> 'descricao', 8000);
    v_mudou := array_append(v_mudou, 'descricao');
  end if;
  if v_c ? 'tipo' then
    if (v_c ->> 'tipo') is null or (v_c ->> 'tipo') not in ('correcao', 'melhoria', 'atualizacao', 'seguranca') then
      return jsonb_build_object('ok', false, 'motivo', 'tipo');
    end if;
    if v_c ->> 'tipo' <> v_k.tipo then v_k.tipo := v_c ->> 'tipo'; v_mudou := array_append(v_mudou, 'tipo'); end if;
  end if;
  if v_c ? 'prioridade' then
    if (v_c ->> 'prioridade') is null or (v_c ->> 'prioridade') not in ('urgente', 'alta', 'media', 'baixa') then
      return jsonb_build_object('ok', false, 'motivo', 'prioridade');
    end if;
    if v_c ->> 'prioridade' <> v_k.prioridade then v_k.prioridade := v_c ->> 'prioridade'; v_mudou := array_append(v_mudou, 'prioridade'); end if;
  end if;
  if v_c ? 'caminhos' then
    if jsonb_typeof(v_c -> 'caminhos') is distinct from 'array' then
      return jsonb_build_object('ok', false, 'motivo', 'caminhos');
    end if;
    if public.roadmap_lista_de_caminhos(array(select jsonb_array_elements_text(v_c -> 'caminhos'))) is distinct from v_k.caminhos then
      v_k.caminhos := public.roadmap_lista_de_caminhos(array(select jsonb_array_elements_text(v_c -> 'caminhos')));
      v_mudou := array_append(v_mudou, 'caminhos');
    end if;
  end if;
  if v_c ? 'ramo' then
    v_ramo := nullif(btrim(coalesce(v_c ->> 'ramo', '')), '');
    if v_ramo is not null and (char_length(v_ramo) > 200 or v_ramo !~ '^[A-Za-z0-9._/-]+$') then
      return jsonb_build_object('ok', false, 'motivo', 'ramo');
    end if;
    if v_ramo is distinct from v_k.ramo then v_k.ramo := v_ramo; v_mudou := array_append(v_mudou, 'ramo'); end if;
  end if;
  if v_c ? 'sessao' and public.roadmap_texto(v_c ->> 'sessao', 160) is distinct from v_k.sessao then
    v_k.sessao := public.roadmap_texto(v_c ->> 'sessao', 160);
    v_k.via_claude := v_k.sessao is not null or (select auth.uid()) is null;
    v_mudou := array_append(v_mudou, 'sessao');
  end if;

  if cardinality(v_mudou) = 0 then
    return jsonb_build_object('ok', true, 'mudou', '[]'::jsonb, 'cartao', public.roadmap_cartao_json(p_id));
  end if;

  update public.roadmap_cartoes k
  set titulo = v_k.titulo, descricao = v_k.descricao, tipo = v_k.tipo, prioridade = v_k.prioridade,
      caminhos = v_k.caminhos, ramo = v_k.ramo, sessao = v_k.sessao, via_claude = v_k.via_claude,
      mudou_em = now(), mudou_por = v_eu
  where k.id = p_id;
  perform public.roadmap_anotar(p_id, v_eu, 'editou', null, null, null, jsonb_build_object('campos', to_jsonb(v_mudou)));
  return jsonb_build_object('ok', true, 'mudou', to_jsonb(v_mudou), 'cartao', public.roadmap_cartao_json(p_id));
end;
$$;

-- Pegar um cartão: diz quem faz, o ramo, onde vai mexer e (se for o Claude)
-- de qual sessão. Vai para "fazendo" se ainda não estava, e devolve os
-- cruzamentos. Cartão que já é de outra pessoa só muda de dono com `p_tomar`.
create or replace function public.roadmap_pegar(
  p_id bigint,
  p_caminhos text[] default null,
  p_ramo text default null,
  p_sessao text default null,
  p_responsavel uuid default null,
  p_tomar boolean default false,
  p_quem uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu uuid := public.roadmap_quem(p_quem);
  v_conector boolean := (select auth.uid()) is null;
  v_k public.roadmap_cartoes;
  v_resp uuid;
  v_ramo text := nullif(btrim(coalesce(p_ramo, '')), '');
  v_sessao text := public.roadmap_texto(p_sessao, 160);
  v_caminhos text[];
  v_coluna text;
begin
  if not coalesce(public.roadmap_pode(v_eu), false) then
    return jsonb_build_object('ok', false, 'motivo', 'sem_acesso');
  end if;
  select * into v_k from public.roadmap_cartoes k where k.id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'nao_achou');
  end if;
  if v_k.coluna in ('no_ar', 'descartado') then
    return jsonb_build_object('ok', false, 'motivo', 'concluido');
  end if;
  v_resp := coalesce(p_responsavel, v_eu);
  if not coalesce(public.roadmap_pode(v_resp), false) then
    return jsonb_build_object('ok', false, 'motivo', 'responsavel');
  end if;
  if v_k.responsavel is not null and v_k.responsavel <> v_resp and v_k.coluna in ('fazendo', 'em_revisao')
     and not coalesce(p_tomar, false) then
    return jsonb_build_object('ok', false, 'motivo', 'com_outra_pessoa',
      'de', (select p.full_name from public.profiles p where p.id = v_k.responsavel));
  end if;
  if v_ramo is not null and (char_length(v_ramo) > 200 or v_ramo !~ '^[A-Za-z0-9._/-]+$') then
    return jsonb_build_object('ok', false, 'motivo', 'ramo');
  end if;
  v_caminhos := case when p_caminhos is null then v_k.caminhos else public.roadmap_lista_de_caminhos(p_caminhos) end;
  v_coluna := case when v_k.coluna in ('ideias', 'a_fazer') then 'fazendo' else v_k.coluna end;

  update public.roadmap_cartoes k
  set responsavel = v_resp,
      ramo = coalesce(v_ramo, k.ramo),
      caminhos = v_caminhos,
      sessao = v_sessao,
      via_claude = v_conector or v_sessao is not null,
      coluna = v_coluna,
      pegou_em = now(),
      concluido_em = null,
      ultima_nota = case when v_coluna <> v_k.coluna then null else k.ultima_nota end,
      mudou_em = now(),
      mudou_por = v_eu
  where k.id = p_id;

  perform public.roadmap_anotar(p_id, v_eu, 'pegou', v_k.coluna, v_coluna, null, jsonb_build_object(
    'responsavel', (select p.full_name from public.profiles p where p.id = v_resp),
    'tomou_de', case when v_k.responsavel is not null and v_k.responsavel <> v_resp then (select p.full_name from public.profiles p where p.id = v_k.responsavel) end,
    'ramo', coalesce(v_ramo, v_k.ramo),
    'caminhos', to_jsonb(v_caminhos),
    'sessao', v_sessao
  ));

  return jsonb_build_object('ok', true, 'cartao', public.roadmap_cartao_json(p_id), 'conflitos', public.roadmap_conflitos_de(v_caminhos, p_id));
end;
$$;

-- Mover entre as colunas. Descartar pede o motivo. Ir para fazendo ou em
-- revisão sem dono põe quem moveu como dono; voltar para ideias ou a fazer
-- solta o cartão.
create or replace function public.roadmap_mover(p_id bigint, p_coluna text, p_nota text default null, p_quem uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu uuid := public.roadmap_quem(p_quem);
  v_k public.roadmap_cartoes;
  v_nota text := public.roadmap_texto(p_nota, 2000);
begin
  if not coalesce(public.roadmap_pode(v_eu), false) then
    return jsonb_build_object('ok', false, 'motivo', 'sem_acesso');
  end if;
  if p_coluna is null or p_coluna not in ('ideias', 'a_fazer', 'fazendo', 'em_revisao', 'no_ar', 'descartado') then
    return jsonb_build_object('ok', false, 'motivo', 'coluna');
  end if;
  select * into v_k from public.roadmap_cartoes k where k.id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'nao_achou');
  end if;
  if p_coluna = 'descartado' and (v_nota is null or char_length(v_nota) < 3) then
    return jsonb_build_object('ok', false, 'motivo', 'motivo');
  end if;
  if v_k.coluna = p_coluna then
    return jsonb_build_object('ok', true, 'igual', true, 'cartao', public.roadmap_cartao_json(p_id));
  end if;

  update public.roadmap_cartoes k
  set coluna = p_coluna,
      responsavel = case
        when p_coluna in ('ideias', 'a_fazer') then null
        when p_coluna in ('fazendo', 'em_revisao') then coalesce(k.responsavel, v_eu)
        else k.responsavel
      end,
      sessao = case when p_coluna in ('ideias', 'a_fazer') then null else k.sessao end,
      via_claude = case when p_coluna in ('ideias', 'a_fazer') then false else k.via_claude end,
      pegou_em = case when p_coluna in ('fazendo', 'em_revisao') and k.responsavel is null then now() else k.pegou_em end,
      concluido_em = case when p_coluna in ('no_ar', 'descartado') then now() end,
      ultima_nota = v_nota,
      mudou_em = now(),
      mudou_por = v_eu
  where k.id = p_id;

  perform public.roadmap_anotar(p_id, v_eu, 'moveu', v_k.coluna, p_coluna, v_nota, '{}'::jsonb);
  return jsonb_build_object('ok', true, 'cartao', public.roadmap_cartao_json(p_id));
end;
$$;

-- Ligar o pedido de revisão (GitHub) ao cartão. Cartão que ainda não estava
-- em revisão vai para lá.
create or replace function public.roadmap_ligar_pr(p_id bigint, p_pr_url text, p_ramo text default null, p_quem uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu uuid := public.roadmap_quem(p_quem);
  v_k public.roadmap_cartoes;
  v_pr text := btrim(coalesce(p_pr_url, ''));
  v_ramo text := nullif(btrim(coalesce(p_ramo, '')), '');
  v_coluna text;
begin
  if not coalesce(public.roadmap_pode(v_eu), false) then
    return jsonb_build_object('ok', false, 'motivo', 'sem_acesso');
  end if;
  if char_length(v_pr) > 300 or v_pr !~ '^https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/pull/[0-9]+$' then
    return jsonb_build_object('ok', false, 'motivo', 'pr');
  end if;
  if v_ramo is not null and (char_length(v_ramo) > 200 or v_ramo !~ '^[A-Za-z0-9._/-]+$') then
    return jsonb_build_object('ok', false, 'motivo', 'ramo');
  end if;
  select * into v_k from public.roadmap_cartoes k where k.id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'nao_achou');
  end if;
  v_coluna := case when v_k.coluna in ('ideias', 'a_fazer', 'fazendo') then 'em_revisao' else v_k.coluna end;

  update public.roadmap_cartoes k
  set pr_url = v_pr,
      ramo = coalesce(v_ramo, k.ramo),
      coluna = v_coluna,
      responsavel = case when v_coluna = 'em_revisao' then coalesce(k.responsavel, v_eu) else k.responsavel end,
      pegou_em = case when v_coluna = 'em_revisao' and k.responsavel is null then now() else k.pegou_em end,
      ultima_nota = case when v_coluna <> v_k.coluna then null else k.ultima_nota end,
      mudou_em = now(),
      mudou_por = v_eu
  where k.id = p_id;

  perform public.roadmap_anotar(p_id, v_eu, 'ligou_pr', v_k.coluna, v_coluna, null,
    jsonb_build_object('pr_url', v_pr, 'ramo', coalesce(v_ramo, v_k.ramo)));
  return jsonb_build_object('ok', true, 'cartao', public.roadmap_cartao_json(p_id));
end;
$$;

-- "Levar para o roadmap": a sugestão vira cartão ligado a ela. Só a
-- diretoria, que é quem lê as sugestões (0140).
create or replace function public.roadmap_levar_sugestao(
  p_sugestao bigint,
  p_titulo text default null,
  p_tipo text default 'melhoria',
  p_prioridade text default 'media',
  p_coluna text default 'a_fazer',
  p_quem uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu uuid := public.roadmap_quem(p_quem);
  v_s public.sugestoes;
  v_autor text;
  v_titulo text;
  v_primeira text;
  v_id bigint;
begin
  if not coalesce(public.roadmap_pode(v_eu), false) or not coalesce(public.roadmap_diretoria(v_eu), false) then
    return jsonb_build_object('ok', false, 'motivo', 'sem_acesso');
  end if;
  if coalesce(p_tipo, '') not in ('correcao', 'melhoria', 'atualizacao', 'seguranca') then
    return jsonb_build_object('ok', false, 'motivo', 'tipo');
  end if;
  if coalesce(p_prioridade, '') not in ('urgente', 'alta', 'media', 'baixa') then
    return jsonb_build_object('ok', false, 'motivo', 'prioridade');
  end if;
  if coalesce(p_coluna, '') not in ('ideias', 'a_fazer') then
    return jsonb_build_object('ok', false, 'motivo', 'coluna');
  end if;
  select * into v_s from public.sugestoes s where s.id = p_sugestao for update;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'nao_achou');
  end if;
  select k.id into v_id from public.roadmap_cartoes k where k.sugestao_id = p_sugestao;
  if v_id is not null then
    return jsonb_build_object('ok', false, 'motivo', 'ja_no_roadmap', 'id', v_id);
  end if;

  select p.full_name into v_autor from public.profiles p where p.id = v_s.autor;
  v_primeira := public.roadmap_texto(split_part(v_s.texto, E'\n', 1), 4000);
  v_titulo := coalesce(public.roadmap_texto(p_titulo, 160),
    case when char_length(v_primeira) <= 120 then v_primeira else left(v_primeira, 117) || '...' end);
  if v_titulo is null or char_length(v_titulo) < 3 then
    v_titulo := 'Sugestão ' || v_s.id;
  end if;

  insert into public.roadmap_cartoes (criado_por, titulo, descricao, tipo, prioridade, coluna, sugestao_id, origem, mudou_por)
  values (
    v_eu, v_titulo,
    public.roadmap_texto(v_s.texto || E'\n\nSugerida por ' || coalesce(v_autor, 'alguém do time')
      || coalesce(' na tela ' || coalesce(v_s.tela_nome, v_s.tela), '') || '.', 8000),
    p_tipo, p_prioridade, p_coluna, p_sugestao, 'sugestao', v_eu
  )
  returning id into v_id;

  perform public.roadmap_anotar(v_id, v_eu, 'levou_sugestao', null, p_coluna, null, jsonb_build_object('sugestao', p_sugestao));
  return jsonb_build_object('ok', true, 'id', v_id, 'cartao', public.roadmap_cartao_json(v_id));
end;
$$;

-- --------------------------------------------- a tela de sugestões (0140)

-- A lista das sugestões passa a dizer em qual cartão do roadmap cada uma está.
create or replace function public.sugestoes_lista()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with quem as (
    select (select auth.uid()) as eu,
           coalesce((select public.is_admin()), false) as diretoria,
           coalesce((select public.tem_acesso('time')), false) as pode
  ),
  visiveis as (
    select s.*
    from public.sugestoes s, quem q
    where q.pode and q.eu is not null and (q.diretoria or s.autor = q.eu)
    order by s.criada_em desc
    limit 400
  )
  select jsonb_build_object(
    'eu', (select eu from quem),
    'diretoria', (select diretoria from quem),
    'itens', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', v.id,
        'criada_em', v.criada_em,
        'minha', v.autor = (select eu from quem),
        'autor', a.full_name,
        'tela', v.tela,
        'tela_nome', v.tela_nome,
        'aparelho', v.aparelho,
        'janela', v.janela,
        'texto', v.texto,
        'imagens', to_jsonb(v.imagens),
        'estado', v.estado,
        'resposta', v.resposta,
        'estado_mudou_em', v.estado_mudou_em,
        'estado_por', e.full_name,
        'cartao', case when k.id is not null then jsonb_build_object('id', k.id, 'coluna', k.coluna) end
      ) order by v.criada_em desc)
      from visiveis v
      left join public.profiles a on a.id = v.autor
      left join public.profiles e on e.id = v.estado_por
      left join public.roadmap_cartoes k on k.sugestao_id = v.id
    ), '[]'::jsonb)
  )
$$;

-- Sugestão no roadmap muda de estado pelo cartão. Pela tela de sugestões, só a resposta.
create or replace function public.sugestao_mudar(p_id bigint, p_estado text, p_resposta text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu uuid := (select auth.uid());
  v_atual text;
begin
  if v_eu is null or not coalesce(public.is_admin(), false) then
    return jsonb_build_object('ok', false, 'motivo', 'sem_acesso');
  end if;
  if p_estado is null or p_estado not in ('nova', 'planejada', 'em_andamento', 'feita', 'recusada') then
    return jsonb_build_object('ok', false, 'motivo', 'estado');
  end if;
  select s.estado into v_atual from public.sugestoes s where s.id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'nao_achou');
  end if;
  if p_estado <> v_atual and exists (select 1 from public.roadmap_cartoes k where k.sugestao_id = p_id) then
    return jsonb_build_object('ok', false, 'motivo', 'no_roadmap');
  end if;
  update public.sugestoes s
  set estado = p_estado,
      resposta = left(nullif(btrim(coalesce(p_resposta, '')), ''), 2000),
      estado_mudou_em = now(),
      estado_por = v_eu
  where s.id = p_id;
  return jsonb_build_object('ok', true);
end;
$$;

-- ------------------------------------------------------------- permissões

-- As peças de dentro não são chamadas de fora.
revoke execute on function public.roadmap_quem(uuid) from public, anon, authenticated;
revoke execute on function public.roadmap_pode(uuid) from public, anon, authenticated;
revoke execute on function public.roadmap_diretoria(uuid) from public, anon, authenticated;
revoke execute on function public.roadmap_conflitos_de(text[], bigint) from public, anon, authenticated;
revoke execute on function public.roadmap_cartao_json(bigint) from public, anon, authenticated;
revoke execute on function public.roadmap_anotar(bigint, uuid, text, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.roadmap_anda_a_sugestao() from public, anon, authenticated;

revoke execute on function public.roadmap_quadro(uuid) from public, anon;
revoke execute on function public.roadmap_ver(bigint, uuid) from public, anon;
revoke execute on function public.roadmap_conflitos(text[], bigint, uuid) from public, anon;
revoke execute on function public.roadmap_criar(jsonb, uuid) from public, anon;
revoke execute on function public.roadmap_editar(bigint, jsonb, uuid) from public, anon;
revoke execute on function public.roadmap_pegar(bigint, text[], text, text, uuid, boolean, uuid) from public, anon;
revoke execute on function public.roadmap_mover(bigint, text, text, uuid) from public, anon;
revoke execute on function public.roadmap_ligar_pr(bigint, text, text, uuid) from public, anon;
revoke execute on function public.roadmap_levar_sugestao(bigint, text, text, text, text, uuid) from public, anon;

grant execute on function public.roadmap_quadro(uuid) to authenticated, service_role;
grant execute on function public.roadmap_ver(bigint, uuid) to authenticated, service_role;
grant execute on function public.roadmap_conflitos(text[], bigint, uuid) to authenticated, service_role;
grant execute on function public.roadmap_criar(jsonb, uuid) to authenticated, service_role;
grant execute on function public.roadmap_editar(bigint, jsonb, uuid) to authenticated, service_role;
grant execute on function public.roadmap_pegar(bigint, text[], text, text, uuid, boolean, uuid) to authenticated, service_role;
grant execute on function public.roadmap_mover(bigint, text, text, uuid) to authenticated, service_role;
grant execute on function public.roadmap_ligar_pr(bigint, text, text, uuid) to authenticated, service_role;
grant execute on function public.roadmap_levar_sugestao(bigint, text, text, text, text, uuid) to authenticated, service_role;
