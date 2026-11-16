-- 0084: redes sociais, publicar e agendar. O post, o envio para cada rede e a fila.
--
-- COMO É O DESENHO
--
-- Um POST é a peça que a pessoa montou: legenda, mídias, formato. Um ENVIO é a
-- ida desse post para UMA conta (Instagram, Facebook, YouTube). O mesmo post
-- com três redes marcadas tem três envios, e cada um anda sozinho: um pode
-- sair, outro falhar e o terceiro ainda estar preparando o vídeo.
--
-- A FILA é o próprio `redes_envios`: o relógio pega o que venceu, de uma vez
-- só (`for update skip locked`), e duas rodadas nunca pegam o mesmo envio.
--
-- TRÊS DECISÕES
--
-- 1. Envio que ficou preso em "publicando" NÃO volta para a fila sozinho. Se a
--    rodada morreu depois de a rede aceitar o post e antes de o painel anotar,
--    tentar de novo publicaria em dobro, na conta de verdade da JK. Preso vira
--    erro, com o aviso de conferir na rede, e quem decide tentar de novo é uma
--    pessoa. Envio "processando" (a rede preparando o vídeo) é diferente: ele
--    guarda o ponto em que parou e pode ser retomado sem risco.
-- 2. O ponto em que o envio parou (`andamento`) mora numa tabela à parte, sem
--    policy: ele pode guardar o endereço de uma sessão de envio do YouTube, que
--    vale como credencial enquanto durar.
-- 3. O estado do POST é mantido por gatilho a partir dos envios, e não por
--    cada porta (tela, conector, relógio): assim as três nunca discordam.
--
-- Escrita em tudo aqui é só da chave de serviço, pelo núcleo em
-- `src/lib/redes/posts.ts` e `fila.ts`. Quem tem a área `redes` lê.

-- ---------------------------------------------------------------- o post

create table public.redes_posts (
  id            uuid primary key default gen_random_uuid(),
  -- Título: nome do vídeo no YouTube. Nas outras redes serve só para achar o post na lista.
  titulo        text check (char_length(titulo) <= 200),
  legenda       text not null default '' check (char_length(legenda) <= 12000),
  formato       text not null check (formato in ('post', 'carrossel', 'video_curto', 'story', 'video', 'texto')),
  -- Lista de mídias já no armazenamento: tipo, url, caminho, alt, mime, largura, altura, duracao, tamanho.
  midias        jsonb not null default '[]'::jsonb check (jsonb_typeof(midias) = 'array'),
  -- O que cada rede aceita além da legenda (primeiro comentário, visibilidade do vídeo).
  opcoes        jsonb not null default '{}'::jsonb check (jsonb_typeof(opcoes) = 'object'),
  status        text not null default 'rascunho' check (status in ('rascunho', 'agendado', 'publicando', 'publicado', 'parcial', 'erro', 'cancelado')),
  agendado_para timestamptz,
  publicado_em  timestamptz,
  -- Por onde o post nasceu. O autor é sempre uma pessoa: pelo conector, quem está logado nele.
  origem        text not null default 'painel' check (origem in ('painel', 'conector')),
  criado_por    uuid references public.profiles(id) on delete set null,
  -- Quem mandou publicar ou agendar. Pode ser outra pessoa que não a que montou.
  liberado_por  uuid references public.profiles(id) on delete set null,
  liberado_em   timestamptz,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index redes_posts_lista on public.redes_posts (status, coalesce(agendado_para, criado_em) desc);

comment on table public.redes_posts is
  'A peça montada no painel ou pelo conector. O estado é mantido pelo gatilho de redes_envios. Escrita só pela chave de serviço.';

alter table public.redes_posts enable row level security;

create policy redes_posts_select on public.redes_posts
  for select to authenticated using ((select public.tem_acesso('redes')));

revoke all on public.redes_posts from anon;

-- ---------------------------------------------------------------- o envio (a fila)

create table public.redes_envios (
  id                uuid primary key default gen_random_uuid(),
  post_id           uuid not null references public.redes_posts(id) on delete cascade,
  conta_id          uuid not null references public.redes_contas(id) on delete restrict,
  rede              text not null,
  -- Legenda e título só desta rede, quando forem diferentes do post.
  legenda           text check (char_length(legenda) <= 12000),
  titulo            text check (char_length(titulo) <= 200),
  status            text not null default 'rascunho' check (status in ('rascunho', 'agendado', 'publicando', 'processando', 'publicado', 'erro', 'cancelado')),
  agendado_para     timestamptz,
  -- Quando a fila pode pegar de novo (nova tentativa, ou a rede ainda preparando o vídeo).
  proxima_tentativa timestamptz,
  -- Tentativas que FALHARAM. Rodada de espera pelo vídeo não conta.
  tentativas        integer not null default 0,
  pego_em           timestamptz,
  -- Quando a rede começou a preparar a mídia. Preparo que passa de três horas vira erro.
  processando_desde timestamptz,
  id_na_rede        text check (char_length(id_na_rede) <= 120),
  url_publicada     text check (char_length(url_publicada) <= 600),
  erro              text check (char_length(erro) <= 400),
  avisos            text[] not null default '{}',
  publicado_em      timestamptz,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now(),
  unique (post_id, conta_id)
);

create index redes_envios_fila on public.redes_envios (coalesce(proxima_tentativa, agendado_para)) where status in ('agendado', 'processando');
create index redes_envios_post on public.redes_envios (post_id);

alter table public.redes_envios enable row level security;

create policy redes_envios_select on public.redes_envios
  for select to authenticated using ((select public.tem_acesso('redes')));

revoke all on public.redes_envios from anon;

-- O ponto em que o envio parou. RLS ligada e nenhuma policy: só a chave de serviço.
create table public.redes_envios_andamento (
  envio_id      uuid primary key references public.redes_envios(id) on delete cascade,
  andamento     jsonb not null,
  atualizado_em timestamptz not null default now()
);

alter table public.redes_envios_andamento enable row level security;
revoke all on public.redes_envios_andamento from anon, authenticated;

-- A publicação lida da rede aponta para o envio que a criou, quando foi feita pelo painel.
alter table public.redes_publicacoes add column envio_id uuid references public.redes_envios(id) on delete set null;

-- ---------------------------------------------------------------- o estado do post

-- O estado do post sai dos envios dele. Roda a cada mudança de envio.
create or replace function public.redes_estado_do_post()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post uuid := coalesce(new.post_id, old.post_id);
  v_total int; v_publicados int; v_erros int; v_andando int; v_agendados int; v_cancelados int; v_rascunhos int;
  v_estado text;
begin
  select count(*),
         count(*) filter (where status = 'publicado'),
         count(*) filter (where status = 'erro'),
         count(*) filter (where status in ('publicando', 'processando')),
         count(*) filter (where status = 'agendado'),
         count(*) filter (where status = 'cancelado'),
         count(*) filter (where status = 'rascunho')
    into v_total, v_publicados, v_erros, v_andando, v_agendados, v_cancelados, v_rascunhos
  from public.redes_envios where post_id = v_post;

  v_estado := case
    when v_total = 0 or v_rascunhos = v_total then 'rascunho'
    when v_andando > 0 then 'publicando'
    when v_agendados > 0 then 'agendado'
    when v_publicados > 0 and v_erros > 0 then 'parcial'
    when v_publicados > 0 then 'publicado'
    when v_erros > 0 then 'erro'
    when v_cancelados > 0 then 'cancelado'
    else 'rascunho'
  end;

  update public.redes_posts p
     set status = v_estado,
         publicado_em = case when v_publicados > 0 then coalesce(p.publicado_em, now()) else null end,
         atualizado_em = now()
   where p.id = v_post and (p.status is distinct from v_estado or (v_publicados > 0 and p.publicado_em is null));
  return null;
end $$;

create trigger redes_envios_estado
  after insert or update of status or delete on public.redes_envios
  for each row execute function public.redes_estado_do_post();

-- ---------------------------------------------------------------- a fila

-- Pega os envios vencidos, de uma vez só. Só a chave de serviço executa.
-- `p_post`: só os envios daquele post (o "publicar agora" não espera o relógio).
create or replace function public.redes_pegar_envios(p_limite integer default 4, p_post uuid default null)
returns setof public.redes_envios
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Preso em "publicando" há mais de dez minutos: a rodada morreu no meio. Não volta para a fila (ver o topo do arquivo).
  update public.redes_envios
     set status = 'erro', pego_em = null, proxima_tentativa = null, atualizado_em = now(),
         erro = 'A publicação foi interrompida no meio. Confira na rede se o post saiu antes de tentar de novo.'
   where status = 'publicando' and pego_em < now() - interval '10 minutes';

  -- A rede preparando a mídia há mais de três horas: desiste.
  update public.redes_envios
     set status = 'erro', proxima_tentativa = null, atualizado_em = now(),
         erro = 'A rede passou de três horas preparando a mídia e não terminou. Confira o arquivo e tente de novo.'
   where status = 'processando' and processando_desde < now() - interval '3 hours';

  return query
  update public.redes_envios e
     set status = 'publicando', pego_em = now(), atualizado_em = now()
   where e.id in (
     select x.id from public.redes_envios x
      where x.status in ('agendado', 'processando')
        and coalesce(x.proxima_tentativa, x.agendado_para, now()) <= now()
        and (p_post is null or x.post_id = p_post)
      order by coalesce(x.proxima_tentativa, x.agendado_para)
      limit greatest(1, least(coalesce(p_limite, 4), 20))
      for update skip locked
   )
  returning e.*;
end $$;

revoke execute on function public.redes_pegar_envios(integer, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------- o relógio

-- De minuto em minuto, e só chama a rota quando há envio vencido: fila vazia
-- não acorda a função da Vercel. É o mesmo desenho da publicação agendada dos
-- posts do site (`disparar_publicacao_agendada`).
create or replace function public.disparar_fila_das_redes()
returns void
language plpgsql
security definer
set search_path to 'public', 'extensions', 'net'
as $$
declare
  v_url     text;
  v_segredo text;
begin
  if not exists (
    select 1 from public.redes_envios
     where (status in ('agendado', 'processando') and coalesce(proxima_tentativa, agendado_para, now()) <= now())
        or (status = 'publicando' and pego_em < now() - interval '10 minutes')
  ) then
    return;
  end if;

  select value->>'url' into v_url from public.site_settings where key = 'cron';
  select access_token into v_segredo from public.integration_tokens where provider = 'cron';
  if v_url is null or v_url = '' or v_segredo is null then
    return;
  end if;

  perform net.http_post(
    url     := rtrim(v_url, '/') || '/api/cron/redes-fila',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_segredo),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end $$;

revoke execute on function public.disparar_fila_das_redes() from public, anon, authenticated;

select cron.schedule(
  'publicar-nas-redes',
  '* * * * *',
  $$select public.disparar_fila_das_redes();$$
);

-- ---------------------------------------------------------------- o armazenamento

-- As mídias dos posts. Público por endereço (o Instagram e o Facebook vêm
-- buscar o arquivo), com caminho que ninguém adivinha, e sem listagem: não há
-- policy de leitura da lista. Quem sobe é o navegador, por endereço assinado
-- que o servidor cria depois de conferir a área; por isso também não há policy
-- de escrita. 50 MB é o teto do projeto no Supabase hoje.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('redes', 'redes', true, 52428800, array['image/jpeg', 'image/png', 'video/mp4', 'video/quicktime'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------- a saúde

-- A fila só roda quando há envio vencido, como o reenvio de contatos e a
-- publicação agendada (0078). A função de saúde passa a dizer também quantos
-- envios das redes estão esperando há mais de dez minutos.
create or replace function public.saude_das_ligacoes()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when not public.is_admin() then null else jsonb_build_object(
    'agora', now(),
    'rotinas', (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from public.rotinas_pulso r),
    'leituras', (
      select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select jsonb_build_object(
          'fonte', s.source,
          'ultima_em', max(s.created_at),
          'ultima_boa_em', max(s.created_at) filter (where s.status = 'success'),
          'ultimo_status', (array_agg(s.status order by s.created_at desc))[1],
          'ultimo_erro', (array_agg(left(s.error, 200) order by s.created_at desc) filter (where s.status <> 'success'))[1]
        ) as x
        from public.sync_logs s
        where s.created_at > now() - interval '30 days'
        group by s.source
      ) t
    ),
    -- O estado de cada destino é o do ÚLTIMO envio de cada contato: contato que
    -- falhou e depois entrou conta como entregue.
    'destinos', (
      select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select jsonb_build_object(
          'destino', d.key,
          'ok', count(*) filter (where d.value->>'status' = 'ok'),
          'erro', count(*) filter (where d.value->>'status' = 'erro'),
          'sem_chave', count(*) filter (where d.value->>'status' = 'sem_chave'),
          'ignorado', count(*) filter (where d.value->>'status' = 'ignorado'),
          'ultimo_ok_em', max(l.criado_em) filter (where d.value->>'status' = 'ok'),
          'erro_desde', min(l.criado_em) filter (where d.value->>'status' = 'erro'),
          'ultimo_erro', (array_agg(left(d.value->>'erro', 160) order by l.criado_em desc) filter (where d.value->>'status' = 'erro'))[1],
          -- Gastou as tentativas e saiu da fila de reenvio: só volta pelo botão de Integrações.
          'fora_da_fila', count(*) filter (where d.value->>'status' = 'erro' and not l.envio_pendente)
        ) as x
        from public.leads l, jsonb_each(l.envios) d
        where l.criado_em > now() - interval '90 days'
        group by d.key
      ) t
    ),
    'contatos', (select count(*) from public.leads where criado_em > now() - interval '90 days'),
    -- O que está esperando por uma rotina que só roda quando há o que fazer.
    'pendencias', jsonb_build_object(
      'leads_esperando', (select count(*) from public.leads where envio_pendente and criado_em < now() - interval '40 minutes'),
      'agendados_vencidos', (
        select count(*) from public.contents
        where scheduled_at is not null and scheduled_at < now() - interval '20 minutes' and status in ('draft', 'in_review')
      ),
      'redes_vencidos', (
        select count(*) from public.redes_envios
        where status in ('agendado', 'processando') and coalesce(proxima_tentativa, agendado_para) < now() - interval '10 minutes'
      )
    )
  ) end
$$;
