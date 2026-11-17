-- O envio da compra da loja ao Meta pelo servidor do painel.
--
-- POR QUE
--
-- Em 15/11/2026 a integração "Facebook e Instagram" da Tray parou de mandar
-- eventos ao Meta, para todas as lojas (o aplicativo dela no Meta foi apagado),
-- e ela sempre contou o pedido CRIADO como compra. O Filipe decidiu em 17/11
-- que o painel assume: a compra sai do pedido lido pela API da Tray, com e-mail
-- e telefone em SHA-256, e o pedido pago vira um segundo evento, `CompraPaga`.
-- Tudo nasce DESLIGADO e liga em 01/12. Plano em docs/medicao-pelo-painel.md.
--
-- O QUE CRIA
--
-- meta_loja_config  uma linha só: o modo (desligado, teste, ligado) e a data a
--                   partir da qual os pedidos entram. Fora de site_settings de
--                   propósito: lá a equipe de conteúdo escreve.
-- meta_envios       uma linha por pedido e por evento. É o que impede mandar a
--                   mesma compra duas vezes e o que a tela mostra.
-- meta_sinais       o que o Meta usa para casar a compra com quem viu o anúncio
--                   e que só existe no navegador: os cookies `_fbp` e `_fbc`, o
--                   navegador e o IP. Gravado pelo coletor de origem SÓ na página
--                   de confirmação do pedido e SÓ com o envio ligado ou em teste,
--                   e apagado em 30 dias (limpar_meta_sinais).
--
-- As três tabelas têm RLS ligada e nenhuma policy: só a chave de serviço lê e
-- escreve. A tela lê o resumo por meta_resumo_da_loja(), que confere a área.

create table if not exists public.meta_loja_config (
  id            boolean primary key default true check (id),
  modo          text not null default 'desligado' check (modo in ('desligado', 'teste', 'ligado')),
  -- Pedido feito antes disto não entra, nem em teste. Evita mandar ao Meta compra
  -- que a Tray já mandou do jeito dela, com outro número de evento.
  desde         timestamptz,
  -- O código de "Eventos de teste" do Gerenciador, só para a compra. O do cartão
  -- do Meta em Integrações é do Lead do grupo, e misturar os dois poria o Lead
  -- em teste junto.
  codigo_de_teste text check (char_length(codigo_de_teste) <= 40),
  alterado_em   timestamptz not null default now(),
  alterado_por  uuid references auth.users(id)
);

insert into public.meta_loja_config (id) values (true) on conflict (id) do nothing;

create table if not exists public.meta_envios (
  pedido       bigint not null check (pedido > 0),
  evento       text not null check (evento in ('Purchase', 'CompraPaga')),
  event_id     text not null check (char_length(event_id) <= 60),
  estado       text not null check (estado in ('enviado', 'teste', 'erro', 'ignorado')),
  motivo       text check (char_length(motivo) <= 300),
  origem       text check (origem in ('website', 'system_generated')),
  tentativas   integer not null default 0,
  fbtrace      text check (char_length(fbtrace) <= 80),
  enviado_em   timestamptz,
  atualizado_em timestamptz not null default now(),
  primary key (pedido, evento)
);

create index if not exists meta_envios_estado on public.meta_envios (estado, atualizado_em desc);

create table if not exists public.meta_sinais (
  pedido     bigint primary key check (pedido > 0),
  fbp        text check (char_length(fbp) <= 120),
  fbc        text check (char_length(fbc) <= 600),
  navegador  text check (char_length(navegador) <= 500),
  ip         text check (char_length(ip) <= 64),
  em         timestamptz not null default now()
);

alter table public.meta_loja_config enable row level security;
alter table public.meta_envios enable row level security;
alter table public.meta_sinais enable row level security;

-- Sinais do navegador vivem 30 dias: o Meta só aceita evento de até 7.
create or replace function public.limpar_meta_sinais()
returns integer
language sql
security definer
set search_path to ''
as $$
  with apagados as (
    delete from public.meta_sinais where em < now() - interval '30 days' returning 1
  )
  select count(*)::integer from apagados;
$$;

revoke execute on function public.limpar_meta_sinais() from public, anon, authenticated;

-- O resumo para a tela de Integrações e para a Saúde: modo, contas por estado e
-- os últimos erros, sem dado de cliente.
create or replace function public.meta_resumo_da_loja()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v jsonb;
begin
  if not coalesce(public.tem_acesso('trafego'), false) then
    return jsonb_build_object('erro', 'sem_acesso');
  end if;

  select jsonb_build_object(
    'modo', c.modo,
    'desde', c.desde,
    'tem_codigo_de_teste', coalesce(c.codigo_de_teste, '') <> '',
    'alterado_em', c.alterado_em,
    'por_estado', coalesce((
      select jsonb_object_agg(evento || ':' || estado, n)
      from (select evento, estado, count(*) n from public.meta_envios
            where atualizado_em > now() - interval '7 days' group by 1, 2) x
    ), '{}'::jsonb),
    'ultimo_envio', (select max(enviado_em) from public.meta_envios where estado = 'enviado'),
    'erros', coalesce((
      select jsonb_agg(jsonb_build_object('pedido', pedido, 'evento', evento, 'motivo', motivo, 'em', atualizado_em) order by atualizado_em desc)
      from (select * from public.meta_envios where estado = 'erro' order by atualizado_em desc limit 5) e
    ), '[]'::jsonb),
    'sinais_7_dias', (select count(*) from public.meta_sinais where em > now() - interval '7 days')
  ) into v
  from public.meta_loja_config c
  where c.id;

  return v;
end $$;

revoke execute on function public.meta_resumo_da_loja() from public, anon;
grant execute on function public.meta_resumo_da_loja() to authenticated;

-- O relógio: de dez em dez minutos, três minutos depois da leitura de pedidos
-- (0101 roda nos minutos 3, 13, 23...), para o pedido novo já estar no banco.
-- A rota olha o modo: desligada, só deixa o pulso e volta.
create or replace function public.disparar_envio_ao_meta()
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
    url     := rtrim(v_url, '/') || '/api/cron/meta-loja',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_segredo),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end $$;

revoke execute on function public.disparar_envio_ao_meta() from public, anon, authenticated;

select cron.schedule(
  'enviar-compras-ao-meta',
  '6-59/10 * * * *',
  $$select public.disparar_envio_ao_meta();$$
);

select cron.schedule(
  'limpar-sinais-do-meta',
  '40 4 * * *',
  $$select public.limpar_meta_sinais();$$
);
