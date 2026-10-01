-- Contatos do grupo de ofertas no WhatsApp: a bio e a página /grupo.
--
-- POR QUE
--
-- O formulário da bio enviava para `/api/bio/lead`, que nunca existiu. Quem
-- preenchia via "Não deu para enviar agora" e não chegava ao grupo. E o gestor
-- de tráfego precisava de uma página fixa para o anúncio (/grupo), para não
-- trocar o link toda vez que um grupo enche, e de uma lista de quem demonstrou
-- interesse e não entrou.
--
-- COMO
--
-- Cada envio do formulário vira uma linha aqui, gravada SÓ pelo servidor
-- (service_role). Depois de gravar, o portal repassa para a Kommo, o RD
-- Station, o webhook do grupo (DevZapp, Make) e a API de Conversões do Meta.
-- O resultado de cada destino fica em `envios`, então um destino fora do ar
-- não perde contato: o relógio tenta de novo.
--
-- `clicou_grupo_em` vem de /grupo/entrar, o link fixo que leva ao grupo.
-- `entrou_grupo_em` só existe se a ferramenta do grupo avisar a entrada pelo
-- webhook (/api/grupo/entrou). O site enxerga até o clique, não a entrada.
--
-- LGPD: o aceite é obrigatório no formulário, e o texto aceito e a hora ficam
-- gravados junto, que é a prova do consentimento. IP e navegador servem só ao
-- casamento de eventos do Meta.

create table public.leads (
  id               uuid primary key default gen_random_uuid(),
  criado_em        timestamptz not null default now(),
  origem           text not null check (origem in ('bio', 'grupo')),
  campanha         text not null default '',
  nome             text not null check (char_length(nome) between 2 and 60),
  whatsapp         text not null check (whatsapp ~ '^55[1-9][0-9]{9,10}$'),
  email            text check (email is null or char_length(email) <= 120),
  momento          text check (momento is null or momento in ('namoro', 'noivado', 'casamento', 'presente')),
  pagina           text,
  referencia       text,
  rede             text,
  utm_source       text,
  utm_medium       text,
  utm_campaign     text,
  utm_content      text,
  utm_term         text,
  gclid            text,
  fbclid           text,
  fbc              text,
  fbp              text,
  ip               text,
  user_agent       text,
  aceite_texto     text not null,
  aceite_em        timestamptz not null,
  -- O mesmo id vai no evento do navegador e no do servidor, para o Meta
  -- contar o Lead uma vez só.
  event_id         text not null unique,
  clicou_grupo_em  timestamptz,
  entrou_grupo_em  timestamptz,
  -- { "kommo": { "status": "ok", "em": "...", "ref": "123" }, "rd": {...} }
  envios           jsonb not null default '{}'::jsonb,
  -- Algum destino deu erro e ainda cabe nova tentativa.
  envio_pendente   boolean not null default false,
  tentativas       smallint not null default 0
);

create index leads_criado_em_idx on public.leads (criado_em desc);
create index leads_whatsapp_idx on public.leads (whatsapp);
create index leads_ip_idx on public.leads (ip, criado_em desc);
create index leads_pendentes_idx on public.leads (criado_em) where envio_pendente;

alter table public.leads enable row level security;

-- Leitura para a equipe, no painel. Escrita nenhuma por policy: só o servidor
-- grava, com a service_role. Com a chave anônima (que vai no HTML) ninguém lê
-- nem escreve contato.
create policy leads_staff_select on public.leads
  for select to authenticated using (public.is_staff());

comment on table public.leads is
  'Contatos do grupo de ofertas (bio e /grupo). Escrita só pela service_role.';

-- Avisos de entrada no grupo, como a ferramenta do grupo mandou. O corpo cru
-- fica guardado porque o formato do aviso só se conhece depois do primeiro.
create table public.grupo_entradas (
  id           bigint generated always as identity primary key,
  recebido_em  timestamptz not null default now(),
  telefone     text,
  lead_id      uuid references public.leads(id) on delete set null,
  bruto        jsonb not null
);

create index grupo_entradas_recebido_idx on public.grupo_entradas (recebido_em desc);

alter table public.grupo_entradas enable row level security;

create policy grupo_entradas_staff_select on public.grupo_entradas
  for select to authenticated using (public.is_staff());

-- Nova tentativa dos envios que falharam, de dez em dez minutos. Mesmo desenho
-- da sincronização da Tray (0040): URL em `site_settings.cron`, segredo em
-- `integration_tokens`, e quem fala com Kommo, RD e Meta é o portal.
create or replace function public.disparar_reenvio_de_leads()
returns void
language plpgsql
security definer
set search_path to 'public', 'extensions', 'net'
as $$
declare
  v_url     text;
  v_segredo text;
begin
  if not exists (select 1 from public.leads where envio_pendente) then
    return;
  end if;

  select value->>'url' into v_url from public.site_settings where key = 'cron';
  select access_token into v_segredo from public.integration_tokens where provider = 'cron';

  if v_url is null or v_url = '' or v_segredo is null then
    return;
  end if;

  perform net.http_post(
    url     := rtrim(v_url, '/') || '/api/cron/leads',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_segredo),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end $$;

revoke execute on function public.disparar_reenvio_de_leads() from public, anon, authenticated;

select cron.schedule(
  'reenviar-leads',
  '*/10 * * * *',
  $$select public.disparar_reenvio_de_leads()$$
);
