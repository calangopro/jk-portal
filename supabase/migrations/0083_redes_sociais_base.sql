-- 0083: redes sociais, a base. Contas ligadas, credenciais e os números lidos.
--
-- De onde veio: pedido do Filipe em 16/11/2026, de ver as métricas de todas as
-- redes da JK num lugar só, publicar, agendar e responder pelo painel e pelo
-- Claude. Esta migration é só o alicerce: a conta ligada, o cofre da credencial
-- e as tabelas que a rotina de leitura enche. Fila de publicação, comentários,
-- directs e automações vêm nas seguintes.
--
-- TRÊS DECISÕES
--
-- 1. A credencial mora numa tabela à parte (`redes_credenciais`), cifrada pelo
--    servidor (AES-GCM, `src/lib/redes/cofre.ts`) e SEM policy nenhuma. Quem tem
--    a área `redes` lê a conta (nome, foto, situação) e nunca o token: nem por
--    engano de `select *`, porque a coluna não está na tabela que a pessoa lê.
-- 2. Tela nenhuma chama API de rede social. A rotina busca e grava aqui, a tela
--    lê daqui. Por isso `redes_contas_dia` e `redes_publicacoes` são escritas
--    só pela chave de serviço.
-- 3. Área nova, `redes`: administrador, dono, GM, gerente e editor. Ligar e
--    desligar conta continua sendo de administrador, dono e GM (`is_admin()`),
--    conferido no código da rota.

-- ---------------------------------------------------------------- a área

alter table public.acessos_por_papel drop constraint acessos_por_papel_area_check;
alter table public.acessos_por_papel add constraint acessos_por_papel_area_check check (area in (
  'conteudo', 'site', 'catalogo', 'campanhas', 'vendas', 'recuperacao', 'metricas', 'anuncios',
  'margem', 'custos', 'equipe', 'fabrica', 'lancar_venda', 'trafego', 'loja', 'consulta', 'time',
  'redes'));

insert into public.acessos_por_papel (papel, area)
select p, 'redes' from unnest(array['admin', 'dono', 'gm', 'gerente', 'editor']) as p
on conflict do nothing;

-- ---------------------------------------------------------------- contas

create table public.redes_contas (
  id            uuid primary key default gen_random_uuid(),
  rede          text not null check (rede in ('instagram', 'facebook', 'threads', 'youtube', 'tiktok', 'pinterest', 'linkedin', 'x')),
  -- O id da conta NA REDE (id do Instagram, da Página, do canal).
  conta_id      text not null check (char_length(conta_id) between 1 and 80),
  nome          text check (char_length(nome) <= 160),
  usuario       text check (char_length(usuario) <= 160),
  foto_url      text check (char_length(foto_url) <= 1200),
  link          text check (char_length(link) <= 500),
  escopos       text[] not null default '{}',
  -- Como a conta foi ligada: pelo login da rede ou por token colado em Integrações.
  via           text not null default 'oauth' check (via in ('oauth', 'token')),
  status        text not null default 'ativa' check (status in ('ativa', 'expirada', 'desligada')),
  expira_em     timestamptz,
  ultimo_erro   text check (char_length(ultimo_erro) <= 300),
  -- O que a rotina precisa e não é segredo: a lista de envios do canal, a Página ligada ao Instagram.
  extra         jsonb not null default '{}'::jsonb,
  conectada_por uuid references public.profiles(id) on delete set null,
  conectada_em  timestamptz not null default now(),
  -- Última leitura boa de números. É dela que a tela tira "lida há X".
  lida_em       timestamptz,
  atualizado_em timestamptz not null default now(),
  unique (rede, conta_id)
);

comment on table public.redes_contas is
  'Contas de rede social ligadas ao painel. Sem segredo: a credencial mora em redes_credenciais. Escrita só pela chave de serviço.';

alter table public.redes_contas enable row level security;

create policy redes_contas_select on public.redes_contas
  for select to authenticated using ((select public.tem_acesso('redes')));

revoke all on public.redes_contas from anon;

-- A credencial, cifrada. RLS ligada e nenhuma policy: só a chave de serviço lê.
create table public.redes_credenciais (
  conta_id      uuid primary key references public.redes_contas(id) on delete cascade,
  cifrado       text not null check (cifrado like 'v1.%'),
  atualizado_em timestamptz not null default now()
);

comment on table public.redes_credenciais is
  'Token de cada conta de rede social, cifrado pelo servidor (AES-GCM). Sem policy: nem administrador lê pelo painel.';

alter table public.redes_credenciais enable row level security;
revoke all on public.redes_credenciais from anon, authenticated;

-- ---------------------------------------------------------------- números por dia

-- Uma foto da conta por dia. `seguidores` e `publicacoes` são o total daquele
-- dia; o resto é o que a rede informa PARA o dia. Rede que não informa um
-- número deixa nulo, e a tela diz "a rede não informa" em vez de mostrar zero.
create table public.redes_contas_dia (
  conta_id          uuid not null references public.redes_contas(id) on delete cascade,
  dia               date not null,
  seguidores        integer,
  publicacoes       integer,
  alcance           integer,
  visualizacoes     integer,
  interacoes        integer,
  visitas_ao_perfil integer,
  cliques_no_link   integer,
  novos_seguidores  integer,
  extra             jsonb not null default '{}'::jsonb,
  lido_em           timestamptz not null default now(),
  primary key (conta_id, dia)
);

alter table public.redes_contas_dia enable row level security;

create policy redes_contas_dia_select on public.redes_contas_dia
  for select to authenticated using ((select public.tem_acesso('redes')));

revoke all on public.redes_contas_dia from anon;

-- ---------------------------------------------------------------- publicações lidas

-- O que cada conta publicou, feito pelo painel ou não, com os números mais
-- recentes. A legenda é cortada: serve para reconhecer o post, não para arquivar.
create table public.redes_publicacoes (
  id                   uuid primary key default gen_random_uuid(),
  conta_id             uuid not null references public.redes_contas(id) on delete cascade,
  rede                 text not null,
  id_na_rede           text not null check (char_length(id_na_rede) <= 120),
  formato              text check (char_length(formato) <= 20),
  legenda              text check (char_length(legenda) <= 2400),
  link                 text check (char_length(link) <= 600),
  miniatura_url        text check (char_length(miniatura_url) <= 1600),
  publicado_em         timestamptz,
  curtidas             integer,
  comentarios          integer,
  salvos               integer,
  compartilhamentos    integer,
  alcance              integer,
  visualizacoes        integer,
  extra                jsonb not null default '{}'::jsonb,
  -- Última leitura das métricas que pedem chamada própria (alcance, salvos).
  metricas_em          timestamptz,
  criado_em            timestamptz not null default now(),
  atualizado_em        timestamptz not null default now(),
  unique (conta_id, id_na_rede)
);

create index redes_publicacoes_data on public.redes_publicacoes (publicado_em desc);
create index redes_publicacoes_conta on public.redes_publicacoes (conta_id, publicado_em desc);
create index redes_publicacoes_metricas on public.redes_publicacoes (metricas_em nulls first);

alter table public.redes_publicacoes enable row level security;

create policy redes_publicacoes_select on public.redes_publicacoes
  for select to authenticated using ((select public.tem_acesso('redes')));

revoke all on public.redes_publicacoes from anon;

-- ---------------------------------------------------------------- o resumo da tela

-- Tudo o que a tela "Todas as redes" mostra, numa ida ao banco: cada conta com
-- o total de agora, a variação no período, a série por dia e os melhores posts.
-- Roda com os direitos de quem chama, então a RLS das tabelas acima vale aqui:
-- quem não tem a área recebe listas vazias.
create or replace function public.redes_resumo(p_dias integer default 28)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with periodo as (
    select greatest(1, least(coalesce(p_dias, 28), 365)) as dias,
           (now() at time zone 'America/Sao_Paulo')::date as hoje
  ),
  contas as (
    select c.* from public.redes_contas c where c.status <> 'desligada'
  ),
  dias as (
    select d.* from public.redes_contas_dia d, periodo p
    where d.dia > p.hoje - (p.dias * 2) and d.conta_id in (select id from contas)
  ),
  pubs as (
    select b.* from public.redes_publicacoes b, periodo p
    where b.publicado_em > now() - make_interval(days => p.dias * 2) and b.conta_id in (select id from contas)
  )
  select jsonb_build_object(
    'dias', (select dias from periodo),
    'hoje', (select hoje from periodo),
    'contas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'rede', c.rede, 'nome', c.nome, 'usuario', c.usuario, 'foto_url', c.foto_url, 'link', c.link,
        'status', c.status, 'ultimo_erro', c.ultimo_erro, 'lida_em', c.lida_em, 'expira_em', c.expira_em,
        'seguidores', (select d.seguidores from dias d where d.conta_id = c.id and d.seguidores is not null order by d.dia desc limit 1),
        'seguidores_antes', (
          select d.seguidores from public.redes_contas_dia d, periodo p
          where d.conta_id = c.id and d.seguidores is not null and d.dia <= p.hoje - p.dias order by d.dia desc limit 1),
        'serie', coalesce((
          select jsonb_agg(jsonb_build_object(
            'dia', d.dia, 'seguidores', d.seguidores, 'alcance', d.alcance, 'visualizacoes', d.visualizacoes,
            'interacoes', d.interacoes, 'visitas_ao_perfil', d.visitas_ao_perfil, 'cliques_no_link', d.cliques_no_link,
            'novos_seguidores', d.novos_seguidores) order by d.dia)
          from dias d, periodo p where d.conta_id = c.id and d.dia > p.hoje - p.dias), '[]'::jsonb),
        'anterior', (
          select jsonb_build_object(
            'alcance', sum(d.alcance), 'visualizacoes', sum(d.visualizacoes), 'interacoes', sum(d.interacoes),
            'visitas_ao_perfil', sum(d.visitas_ao_perfil), 'cliques_no_link', sum(d.cliques_no_link))
          from dias d, periodo p where d.conta_id = c.id and d.dia <= p.hoje - p.dias),
        'posts', (
          select jsonb_build_object(
            'quantos', count(*), 'curtidas', sum(b.curtidas), 'comentarios', sum(b.comentarios), 'salvos', sum(b.salvos),
            'compartilhamentos', sum(b.compartilhamentos), 'alcance', sum(b.alcance), 'visualizacoes', sum(b.visualizacoes))
          from pubs b, periodo p where b.conta_id = c.id and b.publicado_em > now() - make_interval(days => p.dias)),
        'posts_antes', (
          select jsonb_build_object(
            'quantos', count(*), 'curtidas', sum(b.curtidas), 'comentarios', sum(b.comentarios),
            'alcance', sum(b.alcance), 'visualizacoes', sum(b.visualizacoes))
          from pubs b, periodo p where b.conta_id = c.id and b.publicado_em <= now() - make_interval(days => p.dias))
      ) order by c.conectada_em)
      from contas c), '[]'::jsonb),
    'publicacoes', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.publicado_em desc) from (
        select b.id, b.conta_id, b.rede, b.id_na_rede, b.formato, left(b.legenda, 200) as legenda, b.link, b.miniatura_url,
               b.publicado_em, b.curtidas, b.comentarios, b.salvos, b.compartilhamentos, b.alcance, b.visualizacoes
        from pubs b, periodo p
        where b.publicado_em > now() - make_interval(days => p.dias)
        order by b.publicado_em desc
        limit 300
      ) t), '[]'::jsonb)
  )
$$;

revoke execute on function public.redes_resumo(integer) from public, anon;
grant execute on function public.redes_resumo(integer) to authenticated;

-- ---------------------------------------------------------------- a rotina de leitura

-- O mesmo desenho das outras rotinas: o `pg_cron` chama a rota pelo `pg_net`,
-- com o endereço de `site_settings.cron` e o segredo de `integration_tokens`
-- (provider `cron`). Sem endereço ou sem segredo, a função não faz nada.
--
-- Roda aos 7 e aos 37 de toda hora, fora dos minutos das outras rotinas. A
-- rota grava o pulso (`rotinas_pulso`, rotina `redes`), e é por ele que a tela
-- de saúde sabe se a leitura parou.
create or replace function public.disparar_leitura_das_redes()
returns void
language plpgsql
security definer
set search_path to 'public', 'extensions', 'net'
as $$
declare
  v_url     text;
  v_segredo text;
begin
  select value->>'url' into v_url from public.site_settings where key = 'cron';
  select access_token into v_segredo from public.integration_tokens where provider = 'cron';

  if v_url is null or v_url = '' or v_segredo is null then
    return;
  end if;

  perform net.http_post(
    url     := rtrim(v_url, '/') || '/api/cron/redes',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_segredo),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end $$;

revoke execute on function public.disparar_leitura_das_redes() from public, anon, authenticated;

select cron.schedule(
  'ler-redes-sociais',
  '7,37 * * * *',
  $$select public.disparar_leitura_das_redes();$$
);
