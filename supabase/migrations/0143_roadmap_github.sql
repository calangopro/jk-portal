-- 0143: o Roadmap (0141) ligado ao GitHub.
--
-- De onde veio: o Filipe perguntou se o quadro sabia do GitHub sozinho ("se eu
-- começar um projeto aqui, já atualiza lá? E se o Erick começar outro, junta
-- os dois sem estragar?") e pediu "segurança total para ninguém estragar o
-- projeto de ninguém e tudo ser sempre 100% atualizado".
--
-- COMO FUNCIONA:
--
-- 1. Um workflow do próprio repositório (.github/workflows/roadmap.yml) roda a
--    cada envio de ramo e a cada mudança de pedido de revisão, e conta ao
--    painel (/api/roadmap/github) o que mudou: o ramo, o pedido, os ARQUIVOS
--    que o ramo mexe de verdade (diferença contra o main) e quantos commits ele
--    está atrás do main. O painel confere a identidade pelo token OIDC que o
--    próprio GitHub assina (repositório, ramo, quem enviou); não há segredo
--    para guardar nem para vazar.
--
-- 2. O cartão anda sozinho: ramo de um cartão recebeu commit e o cartão estava
--    em ideias ou a fazer, vai para fazendo; pedido de revisão aberto, vai para
--    em revisão (rascunho fica em fazendo); juntado ao main, vai para no ar;
--    fechado sem juntar, volta para fazendo. O cartão é achado pelo pedido de
--    revisão já ligado, pelo ramo registrado, pelo número no nome do ramo
--    (`erick/12-...`) ou por "Cartão 12" no título ou na descrição do pedido.
--    Sem dono conhecido, o cartão não vai para fazendo nem para em revisão (a
--    trava 0141 pede dono): fica onde está, e o login aparece no cartão.
--
-- 3. O cruzamento passa a usar os arquivos reais, além dos caminhos
--    declarados. Duas regras novas na mesma função de sempre: migration cruza
--    pelo NÚMERO (0150_a e 0150_b são o mesmo lugar, porque dois números iguais
--    quebram a ordem do banco), e "arquivo de todos" (CLAUDE.md, package.json,
--    setores.ts...) cruza mas é marcado `comum`: o git costuma juntar sozinho,
--    e avisar como se fosse o mesmo trabalho faria todo mundo ignorar o aviso.
--
-- 4. Quando um pedido de revisão é juntado, todo outro trabalho em andamento
--    que mexe nos mesmos arquivos (fora os de todos) ganha o aviso "traga o
--    main para o seu ramo antes de juntar". O aviso some sozinho quando o
--    workflow vê aquele ramo com zero commits atrás do main.
--
-- 5. Ramo que não casa com nenhum cartão vira "trabalho fora do quadro"
--    (`roadmap_ramos`): aparece no topo do quadro, com quem enviou, o pedido e
--    se cruza com algum cartão. É o que pega quem começou sem pegar cartão.
--
-- 6. Quem é quem: o login do GitHub vira pessoa do painel por
--    `roadmap_github_pessoas`. Login desconhecido não move cartão para fazendo
--    sem dono, e aparece pelo nome do login.

-- ------------------------------------------------------------- as colunas

alter table public.roadmap_cartoes
  add column pr_numero integer check (pr_numero > 0),
  add column pr_estado text check (pr_estado in ('rascunho', 'aberto', 'juntado', 'fechado')),
  add column arquivos text[] not null default '{}' check (cardinality(arquivos) <= 500),
  add column atras_do_main integer check (atras_do_main >= 0),
  add column aviso_main text check (char_length(aviso_main) <= 600),
  add column github_login text check (char_length(github_login) <= 60),
  add column github_sha text check (github_sha ~ '^[0-9a-f]{7,40}$'),
  add column github_em timestamptz;

alter table public.roadmap_movimentos add column pelo_github boolean not null default false;

create table public.roadmap_github_pessoas (
  login text primary key check (login ~ '^[A-Za-z0-9-]{1,39}$'),
  perfil uuid not null references public.profiles (id)
);

-- Trabalho fora do quadro: ramo que o GitHub viu e nenhum cartão reconheceu.
create table public.roadmap_ramos (
  ramo text primary key check (char_length(ramo) <= 200 and ramo ~ '^[A-Za-z0-9._/-]+$'),
  github_login text check (char_length(github_login) <= 60),
  perfil uuid references public.profiles (id),
  pr_numero integer check (pr_numero > 0),
  pr_estado text check (pr_estado in ('rascunho', 'aberto', 'juntado', 'fechado')),
  titulo text check (char_length(titulo) <= 300),
  arquivos text[] not null default '{}' check (cardinality(arquivos) <= 500),
  atras_do_main integer check (atras_do_main >= 0),
  aviso_main text check (char_length(aviso_main) <= 600),
  visto_em timestamptz not null default now(),
  -- Preenchido quando um cartão passa a reconhecer o ramo: aí ele sai do "fora do quadro".
  cartao bigint references public.roadmap_cartoes (id)
);

alter table public.roadmap_github_pessoas enable row level security;
alter table public.roadmap_ramos enable row level security;
revoke all on public.roadmap_github_pessoas from anon, authenticated;
revoke all on public.roadmap_ramos from anon, authenticated;

-- Os dois logins conhecidos em 18/11/2026. O dono do repositório (calangopro)
-- fica de fora até alguém dizer de quem é.
insert into public.roadmap_github_pessoas (login, perfil)
select l.login, p.id
from (values ('agenciasetup', 'Filipe'), ('ErickOlih', 'Erick')) as l (login, nome)
join public.profiles p on p.full_name = l.nome and p.role::text = 'gm' and p.is_active
on conflict (login) do nothing;

-- ------------------------------------------------- as regras do cruzamento

-- O caminho no formato de comparação. Novo: migration vale pelo número.
create or replace function public.roadmap_caminho(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when w is null then null
    when w ~ '^supabase/migrations/[0-9]+_' then substring(w from '^(supabase/migrations/[0-9]+)_')
    else w
  end
  from (
    select case
      when v = '' then null
      when v = '/admin' then 'src/app/admin/(painel)/page.tsx'
      when starts_with(v, '/admin/') then 'src/app/admin/(painel)' || substr(v, 7)
      else regexp_replace(v, '^/+', '')
    end as w
    from (
      select regexp_replace(
               regexp_replace(
                 regexp_replace(replace(lower(btrim(coalesce(p, ''))), '\', '/'), '^(\./)+', ''),
                 '(/\*+)+$', ''),
               '/+$', '') as v
    ) x
  ) y
$$;

-- Arquivo que quase todo trabalho toca, e que o git costuma juntar sozinho.
create or replace function public.roadmap_comum(p text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p in (
    'claude.md', 'regras.md', 'projeto.md', 'package.json', 'package-lock.json',
    'src/lib/painel/setores.ts', 'src/lib/auth/acessos.ts', 'src/lib/conector/operacoes/index.ts'
  ), false)
$$;

-- Os cartões em trabalho que cruzam com estes caminhos, agora pelos caminhos
-- declarados E pelos arquivos que o GitHub viu. Cada cruzamento diz se é só
-- de arquivo de todos (`comum`).
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
    select distinct k.id, x as original, public.roadmap_caminho(x) as c
    from public.roadmap_cartoes k, unnest(k.caminhos || k.arquivos) as x
    where k.coluna in ('fazendo', 'em_revisao') and k.id is distinct from p_exceto
  ),
  pares as (
    select d.id,
           jsonb_agg(distinct jsonb_build_object('meu', m.original, 'dele', d.original,
             'comum', public.roadmap_comum(m.c) and public.roadmap_comum(d.c))) as cruzam,
           bool_and(public.roadmap_comum(m.c) and public.roadmap_comum(d.c)) as so_comum
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
    'cruzam', p.cruzam,
    'so_comum', p.so_comum
  ) order by p.so_comum, k.id), '[]'::jsonb)
  from pares p
  join public.roadmap_cartoes k on k.id = p.id
  left join public.profiles r on r.id = k.responsavel
$$;

-- Os caminhos (fora os de todos) de A que cruzam com B, para o texto do aviso.
create or replace function public.roadmap_onde_cruzam(a text[], b text[])
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(distinct x order by x), '{}')
  from unnest(coalesce(a, '{}')) as x
  where not public.roadmap_comum(public.roadmap_caminho(x))
    and exists (
      select 1 from unnest(coalesce(b, '{}')) as y
      where not public.roadmap_comum(public.roadmap_caminho(y))
        and public.roadmap_cruzam(public.roadmap_caminho(x), public.roadmap_caminho(y))
    )
$$;

-- ------------------------------------------------------- leitura (refeita)

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
    'pr_numero', k.pr_numero,
    'pr_estado', k.pr_estado,
    'caminhos', to_jsonb(k.caminhos),
    'arquivos', to_jsonb(k.arquivos),
    'atras_do_main', k.atras_do_main,
    'aviso_main', k.aviso_main,
    'github_login', k.github_login,
    'github_em', k.github_em,
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
      when k.coluna in ('no_ar', 'descartado') or cardinality(k.caminhos || k.arquivos) = 0 then '[]'::jsonb
      else public.roadmap_conflitos_de(k.caminhos || k.arquivos, k.id)
    end
  )
  from public.roadmap_cartoes k
  left join public.profiles r on r.id = k.responsavel
  left join public.profiles c on c.id = k.criado_por
  left join public.profiles m on m.id = k.mudou_por
  where k.id = p_id
$$;

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
    ), '[]'::jsonb) else '[]'::jsonb end,
    -- Trabalho fora do quadro: ramo vivo que nenhum cartão reconhece.
    'ramos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'ramo', g.ramo,
        'github_login', g.github_login,
        'pessoa', p.full_name,
        'pr_numero', g.pr_numero,
        'pr_estado', g.pr_estado,
        'titulo', g.titulo,
        'arquivos', cardinality(g.arquivos),
        'atras_do_main', g.atras_do_main,
        'aviso_main', g.aviso_main,
        'visto_em', g.visto_em,
        'cruza_com', coalesce((
          select jsonb_agg(c ->> 'id')
          from jsonb_array_elements(public.roadmap_conflitos_de(g.arquivos, null)) c
          where not (c ->> 'so_comum')::boolean
        ), '[]'::jsonb)
      ) order by g.visto_em desc)
      from public.roadmap_ramos g
      left join public.profiles p on p.id = g.perfil
      where g.cartao is null and coalesce(g.pr_estado, 'aberto') in ('aberto', 'rascunho') and g.visto_em > now() - interval '30 days'
    ), '[]'::jsonb),
    'github_em', greatest(
      (select max(k.github_em) from public.roadmap_cartoes k),
      (select max(g.visto_em) from public.roadmap_ramos g)
    )
  );
end;
$$;

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
        'em', h.em, 'por', p.full_name, 'pelo_conector', h.pelo_conector, 'pelo_github', h.pelo_github, 'acao', h.acao,
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

-- ------------------------------------------------- o evento que vem do GitHub

-- Quando um pedido de revisão é juntado: avisa todo outro trabalho em andamento
-- que mexe nos mesmos arquivos (fora os de todos). Devolve quantos avisou.
create or replace function public.roadmap_avisar_main(p_arquivos text[], p_pr integer, p_exceto bigint, p_ramo text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer := 0;
  v_m integer := 0;
begin
  if cardinality(coalesce(p_arquivos, '{}')) = 0 then
    return 0;
  end if;
  update public.roadmap_cartoes k
  set aviso_main = left(format('O pedido de revisão %s foi juntado ao main e mexe no que este trabalho mexe: %s. Traga o main para o seu ramo antes de juntar.',
        p_pr, array_to_string((public.roadmap_onde_cruzam(k.caminhos || k.arquivos, p_arquivos))[1:3], ', ')), 600)
  where k.id is distinct from p_exceto
    and k.coluna in ('fazendo', 'em_revisao')
    and cardinality(public.roadmap_onde_cruzam(k.caminhos || k.arquivos, p_arquivos)) > 0;
  get diagnostics v_n = row_count;
  update public.roadmap_ramos g
  set aviso_main = left(format('O pedido de revisão %s foi juntado ao main e mexe no que este trabalho mexe: %s. Traga o main para o seu ramo antes de juntar.',
        p_pr, array_to_string((public.roadmap_onde_cruzam(g.arquivos, p_arquivos))[1:3], ', ')), 600)
  where g.ramo is distinct from p_ramo
    and g.cartao is null
    and coalesce(g.pr_estado, 'aberto') in ('aberto', 'rascunho')
    and cardinality(public.roadmap_onde_cruzam(g.arquivos, p_arquivos)) > 0;
  get diagnostics v_m = row_count;
  return v_n + v_m;
end;
$$;

-- O evento. Só a chave de serviço chama, e quem chama é a rota
-- /api/roadmap/github depois de conferir o token OIDC do GitHub. O ramo, o
-- login e o número do pedido vêm do token (assinado); os arquivos e os
-- commits atrás do main vêm do corpo, calculados pelo workflow.
create or replace function public.roadmap_github(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_evento text := p ->> 'evento';
  v_acao text := coalesce(p ->> 'acao', '');
  v_ramo text := btrim(coalesce(p ->> 'ramo', ''));
  v_login text := nullif(btrim(coalesce(p ->> 'login', '')), '');
  v_sha text := case when coalesce(p ->> 'sha', '') ~ '^[0-9a-f]{7,40}$' then p ->> 'sha' end;
  v_pr integer := case when coalesce(p ->> 'pr_numero', '') ~ '^[1-9][0-9]{0,8}$' then (p ->> 'pr_numero')::integer end;
  v_repo text := coalesce(p ->> 'repositorio', '');
  v_titulo text := public.roadmap_texto(p ->> 'titulo', 300);
  v_corpo text := left(coalesce(p ->> 'corpo', ''), 4000);
  v_rascunho boolean := coalesce((p ->> 'rascunho')::boolean, false);
  v_juntado boolean := coalesce((p ->> 'juntado')::boolean, false);
  v_atras integer := case when coalesce(p ->> 'atras_do_main', '') ~ '^[0-9]{1,6}$' then (p ->> 'atras_do_main')::integer end;
  v_arquivos text[];
  v_pr_url text;
  v_estado text;
  v_perfil uuid;
  v_k public.roadmap_cartoes;
  v_n bigint;
  v_coluna text;
  v_resp uuid;
  v_nota text;
  v_avisados integer := 0;
  v_todos text[];
begin
  if not coalesce((select auth.role()) = 'service_role', false) then
    return jsonb_build_object('ok', false, 'motivo', 'sem_acesso');
  end if;
  if v_evento is null or v_evento not in ('pull_request', 'push') or v_repo !~ '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$'
     or v_ramo = '' or char_length(v_ramo) > 200 or v_ramo !~ '^[A-Za-z0-9._/-]+$' then
    return jsonb_build_object('ok', false, 'motivo', 'formato');
  end if;
  if v_ramo = 'main' then
    return jsonb_build_object('ok', true, 'ignorado', 'main');
  end if;

  v_pr_url := case when v_pr is not null then 'https://github.com/' || v_repo || '/pull/' || v_pr end;
  v_estado := case when v_evento = 'pull_request' then
    case when v_acao = 'closed' then case when v_juntado then 'juntado' else 'fechado' end
         when v_rascunho then 'rascunho' else 'aberto' end
  end;
  if jsonb_typeof(p -> 'arquivos') = 'array' then
    v_arquivos := array(
      select left(x, 300) from (select distinct btrim(x) as x from jsonb_array_elements_text(p -> 'arquivos') as x) s
      where x <> '' order by x limit 500
    );
  end if;
  select g.perfil into v_perfil from public.roadmap_github_pessoas g where lower(g.login) = lower(v_login);

  -- Achar o cartão: pelo pedido já ligado, pelo ramo, pelo número no ramo e por "Cartão N" no pedido.
  if v_pr_url is not null then
    select * into v_k from public.roadmap_cartoes k where k.pr_url = v_pr_url order by k.id desc limit 1;
  end if;
  if v_k.id is null then
    select * into v_k from public.roadmap_cartoes k where k.ramo = v_ramo
    order by (k.coluna in ('fazendo', 'em_revisao')) desc, k.mudou_em desc limit 1;
  end if;
  if v_k.id is null then
    v_n := (regexp_match(v_ramo, '^[^/]+/([0-9]{1,9})(-|$)'))[1]::bigint;
    if v_n is not null then
      select * into v_k from public.roadmap_cartoes k where k.id = v_n;
    end if;
  end if;
  if v_k.id is null and v_evento = 'pull_request' then
    v_n := (regexp_match(lower(coalesce(v_titulo, '') || ' ' || v_corpo), '(roadmap|cart[aã]o)[[:space:]]*(n[º°o.]?[[:space:]]*)?#?[[:space:]]*([0-9]{1,9})'))[3]::bigint;
    if v_n is not null then
      select * into v_k from public.roadmap_cartoes k where k.id = v_n;
    end if;
  end if;

  -- Sem cartão: trabalho fora do quadro.
  if v_k.id is null then
    insert into public.roadmap_ramos as g (ramo, github_login, perfil, pr_numero, pr_estado, titulo, arquivos, atras_do_main, visto_em)
    values (v_ramo, v_login, v_perfil, v_pr, v_estado, v_titulo, coalesce(v_arquivos, '{}'), v_atras, now())
    on conflict (ramo) do update set
      github_login = coalesce(v_login, g.github_login),
      perfil = coalesce(v_perfil, g.perfil),
      pr_numero = coalesce(v_pr, g.pr_numero),
      pr_estado = coalesce(v_estado, g.pr_estado),
      titulo = coalesce(v_titulo, g.titulo),
      arquivos = coalesce(v_arquivos, g.arquivos),
      atras_do_main = coalesce(v_atras, g.atras_do_main),
      aviso_main = case when v_atras = 0 then null else g.aviso_main end,
      visto_em = now(),
      cartao = null;
    select g.arquivos into v_todos from public.roadmap_ramos g where g.ramo = v_ramo;
    if v_estado = 'juntado' then
      v_avisados := public.roadmap_avisar_main(v_todos, v_pr, null, v_ramo);
    end if;
    return jsonb_build_object(
      'ok', true,
      'cartao', null,
      'fora_do_quadro', true,
      'pr_estado', v_estado,
      'conflitos', case when v_estado in ('juntado', 'fechado') then '[]'::jsonb else public.roadmap_conflitos_de(v_todos, null) end,
      'avisados', v_avisados
    );
  end if;

  -- Com cartão: o ramo deixa de estar fora do quadro.
  update public.roadmap_ramos g set cartao = v_k.id where g.ramo = v_ramo and g.cartao is null;

  v_coluna := v_k.coluna;
  if v_evento = 'pull_request' and v_acao = 'closed' then
    if v_juntado then
      v_coluna := 'no_ar';
      v_nota := format('Juntado ao main pelo pedido de revisão %s.', v_pr);
    elsif v_k.coluna = 'em_revisao' then
      v_coluna := 'fazendo';
      v_nota := format('O pedido de revisão %s foi fechado sem juntar.', v_pr);
    end if;
  elsif v_evento = 'pull_request' then
    if v_rascunho then
      if v_k.coluna in ('ideias', 'a_fazer') then v_coluna := 'fazendo'; end if;
    elsif v_k.coluna in ('ideias', 'a_fazer', 'fazendo') or (v_acao = 'reopened' and v_k.coluna in ('no_ar', 'descartado')) then
      v_coluna := 'em_revisao';
    end if;
    if v_coluna <> v_k.coluna then v_nota := format('Pedido de revisão %s %s no GitHub.', v_pr, case when v_rascunho then 'aberto como rascunho' else 'aberto' end); end if;
  elsif v_k.coluna in ('ideias', 'a_fazer') then
    v_coluna := 'fazendo';
    v_nota := format('Começou no ramo %s (visto no GitHub).', v_ramo);
  end if;

  -- Fazendo e em revisão pedem dono (0141). Sem dono conhecido, não move.
  v_resp := coalesce(v_k.responsavel, v_perfil);
  if v_coluna in ('fazendo', 'em_revisao') and v_resp is null then
    v_coluna := v_k.coluna;
    v_nota := null;
  end if;

  update public.roadmap_cartoes k
  set coluna = v_coluna,
      responsavel = case
        when v_coluna in ('fazendo', 'em_revisao') then v_resp
        else k.responsavel
      end,
      pegou_em = case when v_coluna in ('fazendo', 'em_revisao') and k.responsavel is null then now() else k.pegou_em end,
      ramo = v_ramo,
      pr_url = coalesce(v_pr_url, k.pr_url),
      pr_numero = coalesce(v_pr, k.pr_numero),
      pr_estado = coalesce(v_estado, k.pr_estado),
      arquivos = coalesce(v_arquivos, k.arquivos),
      atras_do_main = coalesce(v_atras, k.atras_do_main),
      aviso_main = case when v_atras = 0 or v_coluna in ('no_ar', 'descartado') then null else k.aviso_main end,
      github_login = coalesce(v_login, k.github_login),
      github_sha = coalesce(v_sha, k.github_sha),
      github_em = now(),
      concluido_em = case
        when v_coluna in ('no_ar', 'descartado') then case when k.coluna = v_coluna then k.concluido_em else now() end
      end,
      -- A nota técnica fica no histórico. A do cartão vira a resposta de quem sugeriu: vai a frase pronta.
      ultima_nota = case when v_coluna <> k.coluna then null else k.ultima_nota end,
      mudou_em = case when v_coluna <> k.coluna then now() else k.mudou_em end,
      mudou_por = case when v_coluna <> k.coluna then coalesce(v_perfil, k.mudou_por) else k.mudou_por end
  where k.id = v_k.id;

  if v_coluna <> v_k.coluna or (v_pr_url is not null and v_k.pr_url is distinct from v_pr_url) then
    insert into public.roadmap_movimentos (cartao, por, pelo_conector, pelo_github, acao, de, para, nota, detalhe)
    values (
      v_k.id, v_perfil, false, true,
      case when v_coluna <> v_k.coluna then 'moveu' else 'ligou_pr' end,
      v_k.coluna, v_coluna,
      coalesce(v_nota, case when v_pr is not null then format('Pedido de revisão %s ligado pelo GitHub.', v_pr) end),
      jsonb_build_object('login', v_login, 'ramo', v_ramo, 'pr', v_pr, 'evento', v_evento, 'acao', nullif(v_acao, ''))
    );
  end if;

  select k.caminhos || k.arquivos, k.arquivos into v_todos, v_arquivos from public.roadmap_cartoes k where k.id = v_k.id;
  if v_estado = 'juntado' then
    v_avisados := public.roadmap_avisar_main(v_arquivos, v_pr, v_k.id, v_ramo);
  end if;

  return jsonb_build_object(
    'ok', true,
    'cartao', (select jsonb_build_object('id', k.id, 'titulo', k.titulo, 'coluna', k.coluna, 'responsavel', r.full_name,
                                         'atras_do_main', k.atras_do_main, 'aviso_main', k.aviso_main)
               from public.roadmap_cartoes k left join public.profiles r on r.id = k.responsavel where k.id = v_k.id),
    'moveu', v_coluna <> v_k.coluna,
    'de', v_k.coluna,
    'sem_dono', v_resp is null,
    'pr_estado', v_estado,
    'conflitos', case when v_coluna in ('no_ar', 'descartado') then '[]'::jsonb else public.roadmap_conflitos_de(v_todos, v_k.id) end,
    'avisados', v_avisados
  );
end;
$$;

-- ------------------------------------------------------------- permissões

revoke execute on function public.roadmap_avisar_main(text[], integer, bigint, text) from public, anon, authenticated;
revoke execute on function public.roadmap_github(jsonb) from public, anon, authenticated;
grant execute on function public.roadmap_github(jsonb) to service_role;
