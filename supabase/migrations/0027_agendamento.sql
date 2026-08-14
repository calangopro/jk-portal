-- Publicação agendada.
--
-- POR QUE
--
-- O `REGRAS.md` pede agendar publicação com fuso de São Paulo desde o começo, e
-- isso nunca existiu: `published_at` só era gravado no ato do clique. Sem
-- agendamento, publicar em ritmo depende de alguém estar na frente do
-- computador na hora certa, e é por isso que conteúdo sai em rajada e depois
-- some por três semanas. Escrever cinco guias num dia e soltar um por semana é
-- o que transforma um dia de trabalho em um mês de frequência.
--
-- COMO O RELÓGIO DISPARA
--
-- `pg_cron` acorda de cinco em cinco minutos e faz uma chamada HTTP para o
-- próprio portal, com `pg_net`. Quem publica de verdade é o portal, pela MESMA
-- função que o botão do editor usa, com a trava de fonte e a trava do
-- analisador. Publicar direto por SQL seria mais simples e abriria a porta pela
-- qual a regra morreria: bastaria agendar para o texto entrar no ar sem fonte.
--
-- Enquanto o endereço do portal não estiver configurado, o job roda e não faz
-- nada. É de propósito: instalado agora, começa a funcionar sozinho no dia em
-- que o site subir, sem ninguém precisar lembrar de voltar aqui.

alter table public.contents
  add column scheduled_at timestamptz,
  -- Por que a última tentativa não publicou. É o que evita o pior caso do
  -- agendamento: a hora passar, a trava recusar e ninguém ficar sabendo.
  add column scheduled_error text;

-- Índice parcial: a consulta quente é "o que vence agora", e ela olha só o
-- punhado de conteúdos agendados, nunca a tabela inteira.
create index contents_agendados_idx
  on public.contents (scheduled_at)
  where scheduled_at is not null and status in ('draft', 'in_review');

-- Agendar conteúdo já publicado não quer dizer nada, e deixaria o cron tentando
-- republicar a mesma página para sempre.
alter table public.contents
  add constraint contents_agendamento_so_fora_do_ar
  check (scheduled_at is null or status <> 'published');

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Onde o cron bate. Fica em `site_settings` com `is_public = false`, que é a
-- válvula criada em 0021 exatamente para configuração que não pode ir ao
-- público.
insert into public.site_settings (key, value, is_public)
values ('cron', jsonb_build_object('url', ''), false)
on conflict (key) do nothing;

-- O segredo do disparo mora em `integration_tokens`, que tem RLS ligada e
-- nenhuma policy de propósito desde 0012: só `service_role` e o dono do banco
-- enxergam. Segredo em `site_settings` seria legível por qualquer membro da
-- equipe.
insert into public.integration_tokens (provider, access_token)
values ('cron', encode(gen_random_bytes(32), 'hex'))
on conflict (provider) do nothing;

/**
 * Bate no portal para ele publicar o que venceu.
 *
 * Não decide nada: quem confere fonte e analisador é o portal. Aqui só existe o
 * relógio e o telefone.
 */
create or replace function public.disparar_publicacao_agendada()
returns void
language plpgsql
security definer
set search_path = public, extensions, net
as $$
declare
  v_url     text;
  v_segredo text;
  v_vencidos int;
begin
  select value->>'url' into v_url from public.site_settings where key = 'cron';
  select access_token into v_segredo from public.integration_tokens where provider = 'cron';

  -- Sem endereço configurado, não há o que fazer. Silencioso de propósito:
  -- este é o estado normal enquanto o portal não estiver no ar.
  if v_url is null or v_url = '' or v_segredo is null then
    return;
  end if;

  -- Não acorda o portal à toa. A chamada só sai quando existe algo vencido.
  select count(*) into v_vencidos
  from public.contents
  where scheduled_at is not null
    and scheduled_at <= now()
    and status in ('draft', 'in_review');

  if v_vencidos = 0 then
    return;
  end if;

  perform net.http_post(
    url     := rtrim(v_url, '/') || '/api/cron/publicar',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_segredo),
    body    := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
end $$;

revoke execute on function public.disparar_publicacao_agendada() from public, anon, authenticated;

-- De cinco em cinco minutos. Não precisa ser mais fino: agendamento editorial
-- se pensa em hora, não em minuto, e cada disparo acorda o servidor do portal.
select cron.schedule(
  'publicar-agendados',
  '*/5 * * * *',
  $$select public.disparar_publicacao_agendada()$$
);
