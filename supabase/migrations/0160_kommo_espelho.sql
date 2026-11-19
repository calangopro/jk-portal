-- 0160: o espelho da Kommo (cartão 45, fase 1 do plano da Kommo).
--
-- A conversa com o cliente mora na Kommo. O painel guarda uma CÓPIA de leitura
-- do que acontece lá (negócios, contatos, eventos, usuários, funis e etapas)
-- para juntar com pedido, venda e anúncio. Cada dado tem um dono só: o que está
-- aqui nunca é editado pelo painel, só regravado pela leitura seguinte.
--
-- Quem escreve: a rotina `/api/cron/kommo` e o webhook `/api/kommo/webhook`,
-- os dois com a chave de serviço. Quem lê: as funções `kommo_*` abaixo, que
-- conferem a área por dentro. Todas as tabelas têm RLS ligada e NENHUMA policy.
--
-- O que NÃO entra, de propósito: CPF, endereço e os demais campos do contato
-- (só nome, telefone e e-mail), texto de nota e texto de mensagem (o evento
-- guarda quem, quando e em qual negócio, nunca o que foi dito).

-- Usuários da Kommo. As lojas físicas são usuários lá (ARICANDUVA, GRANJA VIANNA...).
create table if not exists public.kommo_usuarios (
  id            bigint primary key,
  nome          text not null,
  ativo         boolean not null default true,
  administrador boolean not null default false,
  lido_em       timestamptz not null default now()
);

create table if not exists public.kommo_funis (
  id         bigint primary key,
  nome       text not null,
  principal  boolean not null default false,
  arquivado  boolean not null default false,
  ordem      integer not null default 0,
  lido_em    timestamptz not null default now()
);

-- 142 (ganho) e 143 (perdido) se repetem em todo funil: a chave é o par.
create table if not exists public.kommo_etapas (
  funil_id  bigint not null,
  id        bigint not null,
  nome      text not null,
  ordem     integer not null default 0,
  -- ganho, perdido, entrada (a primeira etapa, "leads de entrada") ou aberta.
  tipo      text not null default 'aberta' check (tipo in ('aberta', 'entrada', 'ganho', 'perdido')),
  lido_em   timestamptz not null default now(),
  primary key (funil_id, id)
);

create table if not exists public.kommo_contatos (
  id                   bigint primary key,
  nome                 text,
  -- O primeiro telefone que deu para normalizar, com 55 na frente (o formato do painel).
  telefone             text,
  telefones            text[] not null default '{}',
  email                text,
  responsavel_id       bigint,
  criado_em            timestamptz,
  atualizado_na_kommo  timestamptz,
  apagado              boolean not null default false,
  espelhado_em         timestamptz not null default now()
);
create index if not exists kommo_contatos_telefone on public.kommo_contatos (telefone) where telefone is not null;
create index if not exists kommo_contatos_telefones on public.kommo_contatos using gin (telefones);
create index if not exists kommo_contatos_email on public.kommo_contatos (lower(email)) where email is not null;

create table if not exists public.kommo_negocios (
  id                   bigint primary key,
  nome                 text,
  valor                numeric(12,2),
  funil_id             bigint,
  etapa_id             bigint,
  responsavel_id       bigint,
  contato_id           bigint,
  contatos             bigint[] not null default '{}',
  motivo_perda_id      bigint,
  tags                 text[] not null default '{}',
  criado_em            timestamptz,
  atualizado_na_kommo  timestamptz,
  fechado_em           timestamptz,
  apagado              boolean not null default false,
  -- Desde quando está na etapa e com o responsável de agora (gatilho abaixo).
  etapa_desde          timestamptz,
  responsavel_desde    timestamptz,
  -- Última mensagem do cliente e da loja no chat ligado ao negócio (pelos eventos).
  ultima_msg_cliente_em timestamptz,
  ultima_msg_loja_em    timestamptz,
  -- Campos que as próximas fases usam, já tirados de `campos`.
  pedido_tray          text,
  motivo_compra        text,
  origem_cliente       text,
  utm_source           text,
  utm_medium           text,
  utm_campaign         text,
  utm_content          text,
  utm_term             text,
  utm_id               text,
  fbclid               text,
  gclid                text,
  ad_id                text,
  meta_ad_id           text,
  meta_adset_id        text,
  meta_campaign_id     text,
  -- Todos os campos preenchidos, como vieram: [{id, nome, codigo, valor}]. Sem campo de arquivo.
  campos               jsonb not null default '[]'::jsonb,
  espelhado_em         timestamptz not null default now()
);
create index if not exists kommo_negocios_etapa on public.kommo_negocios (funil_id, etapa_id) where not apagado;
create index if not exists kommo_negocios_responsavel on public.kommo_negocios (responsavel_id) where not apagado;
create index if not exists kommo_negocios_contato on public.kommo_negocios (contato_id);
create index if not exists kommo_negocios_atualizado on public.kommo_negocios (atualizado_na_kommo desc);
create index if not exists kommo_negocios_pedido on public.kommo_negocios (pedido_tray) where pedido_tray is not null;
create index if not exists kommo_negocios_meta_ad on public.kommo_negocios (meta_ad_id) where meta_ad_id is not null;

-- O dia em que mudou de etapa ou de responsável é o dado que o alerta de "parado" precisa.
create or replace function public.kommo_negocio_marca_desde()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  if tg_op = 'INSERT' then
    new.etapa_desde := coalesce(new.etapa_desde, new.atualizado_na_kommo, new.criado_em, now());
    new.responsavel_desde := coalesce(new.responsavel_desde, new.atualizado_na_kommo, new.criado_em, now());
  else
    if new.etapa_id is distinct from old.etapa_id or new.funil_id is distinct from old.funil_id then
      new.etapa_desde := coalesce(new.atualizado_na_kommo, now());
    else
      new.etapa_desde := old.etapa_desde;
    end if;
    if new.responsavel_id is distinct from old.responsavel_id then
      new.responsavel_desde := coalesce(new.atualizado_na_kommo, now());
    else
      new.responsavel_desde := old.responsavel_desde;
    end if;
    -- A leitura do negócio não traz as mensagens: elas só andam para a frente.
    new.ultima_msg_cliente_em := greatest(old.ultima_msg_cliente_em, new.ultima_msg_cliente_em);
    new.ultima_msg_loja_em := greatest(old.ultima_msg_loja_em, new.ultima_msg_loja_em);
  end if;
  return new;
end $$;

drop trigger if exists kommo_negocio_marca_desde on public.kommo_negocios;
create trigger kommo_negocio_marca_desde
  before insert or update on public.kommo_negocios
  for each row execute function public.kommo_negocio_marca_desde();

-- Os eventos que a API devolve (`GET /api/v4/events`), com o id da Kommo.
-- Sem texto: mensagem e nota entram só como "aconteceu".
create table if not exists public.kommo_eventos (
  id           text primary key,
  tipo         text not null,
  entidade     text not null,
  entidade_id  bigint not null,
  autor_id     bigint,
  criado_em    timestamptz not null,
  antes        jsonb,
  depois       jsonb,
  lido_em      timestamptz not null default now()
);
create index if not exists kommo_eventos_entidade on public.kommo_eventos (entidade, entidade_id, criado_em desc);
create index if not exists kommo_eventos_tipo on public.kommo_eventos (tipo, criado_em desc);

-- O que o webhook avisou e a rotina ainda não releu pela API.
create table if not exists public.kommo_pendentes (
  entidade     text not null check (entidade in ('negocio', 'contato')),
  id           bigint not null,
  acao         text not null default 'atualizar' check (acao in ('atualizar', 'apagar')),
  avisado_em   timestamptz not null default now(),
  primary key (entidade, id)
);

-- Uma linha só: o ponto da leitura, a carga inicial e o estado do webhook.
create table if not exists public.kommo_estado (
  id                    integer primary key default 1 check (id = 1),
  eventos_ate           timestamptz,
  carga_desde           timestamptz,
  carga_pagina          integer,
  carga_concluida_em    timestamptz,
  ultimo_webhook_em     timestamptz,
  webhooks_recebidos    bigint not null default 0,
  webhook_id            bigint,
  webhook_desligado     boolean,
  webhook_conferido_em  timestamptz,
  webhook_erro          text,
  ultima_leitura_em     timestamptz,
  ultima_leitura        jsonb
);
insert into public.kommo_estado (id) values (1) on conflict do nothing;

-- Quem é quem: usuário da Kommo, pessoa do painel e loja física.
create table if not exists public.kommo_mapa (
  usuario_id     bigint primary key,
  papel          text not null default 'outro' check (papel in ('loja', 'vendedor', 'diretoria', 'outro')),
  profile_id     uuid references public.profiles (id) on delete set null,
  location_id    uuid references public.locations (id) on delete set null,
  atualizado_por uuid,
  atualizado_em  timestamptz not null default now()
);

alter table public.kommo_usuarios enable row level security;
alter table public.kommo_funis    enable row level security;
alter table public.kommo_etapas   enable row level security;
alter table public.kommo_contatos enable row level security;
alter table public.kommo_negocios enable row level security;
alter table public.kommo_eventos  enable row level security;
alter table public.kommo_pendentes enable row level security;
alter table public.kommo_estado   enable row level security;
alter table public.kommo_mapa     enable row level security;

revoke all on public.kommo_usuarios, public.kommo_funis, public.kommo_etapas, public.kommo_contatos,
  public.kommo_negocios, public.kommo_eventos, public.kommo_pendentes, public.kommo_estado, public.kommo_mapa
  from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Leitura. Cada função confere a área por dentro, em coalesce(..., false).
-- ---------------------------------------------------------------------------

-- Estado do espelho, para o cartão da Kommo em Integrações. Só diretoria.
create or replace function public.kommo_estado_do_espelho()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v jsonb;
begin
  if not coalesce(public.is_admin(), false) then
    return null;
  end if;
  select jsonb_build_object(
    'eventos_ate', e.eventos_ate,
    'carga_desde', e.carga_desde,
    'carga_pagina', e.carga_pagina,
    'carga_concluida_em', e.carga_concluida_em,
    'ultimo_webhook_em', e.ultimo_webhook_em,
    'webhooks_recebidos', e.webhooks_recebidos,
    'webhook_id', e.webhook_id,
    'webhook_desligado', e.webhook_desligado,
    'webhook_conferido_em', e.webhook_conferido_em,
    'webhook_erro', e.webhook_erro,
    'ultima_leitura_em', e.ultima_leitura_em,
    'ultima_leitura', e.ultima_leitura,
    'negocios', (select count(*) from public.kommo_negocios where not apagado),
    'contatos', (select count(*) from public.kommo_contatos where not apagado),
    'eventos', (select count(*) from public.kommo_eventos),
    'usuarios', (select count(*) from public.kommo_usuarios),
    'funis', (select count(*) from public.kommo_funis where not arquivado),
    'pendentes', (select count(*) from public.kommo_pendentes),
    'sem_mapa', (select count(*) from public.kommo_usuarios u where u.ativo and not exists (select 1 from public.kommo_mapa m where m.usuario_id = u.id))
  ) into v
  from public.kommo_estado e where e.id = 1;
  return v;
end $$;

-- O mapa para a tela da diretoria: usuários da Kommo, o que já foi ligado e as opções.
create or replace function public.kommo_mapa_lista()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
begin
  if not coalesce(public.is_admin(), false) then
    return null;
  end if;
  return jsonb_build_object(
    'usuarios', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', u.id, 'nome', u.nome, 'ativo', u.ativo, 'administrador', u.administrador,
        'papel', m.papel, 'profile_id', m.profile_id, 'location_id', m.location_id,
        'negocios_abertos', (select count(*) from public.kommo_negocios n
                             where n.responsavel_id = u.id and not n.apagado and n.etapa_id not in (142, 143))
      ) order by u.ativo desc, u.nome)
      from public.kommo_usuarios u
      left join public.kommo_mapa m on m.usuario_id = u.id
    ), '[]'::jsonb),
    'pessoas', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'nome', coalesce(p.full_name, 'Sem nome'), 'papel', p.role::text) order by p.full_name)
      from public.profiles p where p.is_active
    ), '[]'::jsonb),
    'lojas', coalesce((
      select jsonb_agg(jsonb_build_object('id', l.id, 'nome', l.name) order by l.name)
      from public.locations l
    ), '[]'::jsonb)
  );
end $$;

create or replace function public.kommo_mapa_salvar(p_usuario bigint, p_papel text, p_profile uuid, p_location uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
begin
  if not coalesce(public.is_admin(), false) then
    return jsonb_build_object('ok', false, 'erro', 'sem_acesso');
  end if;
  if not exists (select 1 from public.kommo_usuarios where id = p_usuario) then
    return jsonb_build_object('ok', false, 'erro', 'usuario_desconhecido');
  end if;
  if p_papel not in ('loja', 'vendedor', 'diretoria', 'outro') then
    return jsonb_build_object('ok', false, 'erro', 'papel_invalido');
  end if;
  insert into public.kommo_mapa (usuario_id, papel, profile_id, location_id, atualizado_por, atualizado_em)
  values (p_usuario, p_papel, p_profile, p_location, (select auth.uid()), now())
  on conflict (usuario_id) do update
    set papel = excluded.papel, profile_id = excluded.profile_id, location_id = excluded.location_id,
        atualizado_por = excluded.atualizado_por, atualizado_em = now();
  return jsonb_build_object('ok', true);
end $$;

-- Um negócio, com nomes de funil, etapa, responsável, a pessoa e a loja do mapa,
-- e o contato. Para quem vê vendas (gerência e diretoria). Telefone só sai para
-- quem também lança venda, a mesma régua da ficha do cliente.
create or replace function public.kommo_negocio(p_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_vendas boolean := coalesce(public.is_admin(), false) or coalesce(public.tem_acesso('vendas'), false);
  v_cliente boolean := coalesce(public.is_admin(), false) or coalesce(public.tem_acesso('lancar_venda'), false);
  v jsonb;
begin
  if not v_vendas then
    return null;
  end if;
  select jsonb_build_object(
    'id', n.id, 'nome', n.nome, 'valor', n.valor,
    'funil', jsonb_build_object('id', n.funil_id, 'nome', f.nome),
    'etapa', jsonb_build_object('id', n.etapa_id, 'nome', e.nome, 'tipo', e.tipo),
    'etapa_desde', n.etapa_desde,
    'responsavel', jsonb_build_object('id', n.responsavel_id, 'nome', u.nome, 'papel', m.papel,
                                      'profile_id', m.profile_id, 'location_id', m.location_id),
    'responsavel_desde', n.responsavel_desde,
    'criado_em', n.criado_em, 'atualizado_na_kommo', n.atualizado_na_kommo, 'fechado_em', n.fechado_em,
    'apagado', n.apagado, 'tags', n.tags,
    'ultima_msg_cliente_em', n.ultima_msg_cliente_em, 'ultima_msg_loja_em', n.ultima_msg_loja_em,
    'pedido_tray', n.pedido_tray, 'motivo_compra', n.motivo_compra, 'origem_cliente', n.origem_cliente,
    'utm', jsonb_build_object('source', n.utm_source, 'medium', n.utm_medium, 'campaign', n.utm_campaign,
                              'content', n.utm_content, 'term', n.utm_term, 'id', n.utm_id),
    'meta', jsonb_build_object('ad_id', n.meta_ad_id, 'adset_id', n.meta_adset_id, 'campaign_id', n.meta_campaign_id),
    'contato', case when c.id is null then null else jsonb_build_object(
      'id', c.id, 'nome', c.nome,
      'telefone', case when v_cliente then c.telefone end,
      'email', case when v_cliente then c.email end) end,
    'link', 'https://kathleengfz.kommo.com/leads/detail/' || n.id
  ) into v
  from public.kommo_negocios n
  left join public.kommo_funis f on f.id = n.funil_id
  left join public.kommo_etapas e on e.funil_id = n.funil_id and e.id = n.etapa_id
  left join public.kommo_usuarios u on u.id = n.responsavel_id
  left join public.kommo_mapa m on m.usuario_id = n.responsavel_id
  left join public.kommo_contatos c on c.id = n.contato_id
  where n.id = p_id;
  return v;
end $$;

-- Quantos negócios abertos em cada funil e etapa agora, com o valor. Base do funil único (fase 46).
create or replace function public.kommo_funil_agora()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
begin
  if not (coalesce(public.is_admin(), false) or coalesce(public.tem_acesso('vendas'), false)) then
    return null;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'funil_id', f.id, 'funil', f.nome, 'etapa_id', e.id, 'etapa', e.nome, 'tipo', e.tipo, 'ordem', e.ordem,
      'abertos', x.abertos, 'valor', x.valor, 'parado_ha_dias', x.parado_ha_dias
    ) order by f.ordem, e.ordem)
    from public.kommo_funis f
    join public.kommo_etapas e on e.funil_id = f.id and e.tipo in ('aberta', 'entrada')
    cross join lateral (
      select count(*) as abertos, coalesce(sum(n.valor), 0) as valor,
             round(coalesce(percentile_cont(0.5) within group (order by extract(epoch from now() - n.etapa_desde) / 86400), 0)::numeric, 1) as parado_ha_dias
      from public.kommo_negocios n
      where n.funil_id = f.id and n.etapa_id = e.id and not n.apagado
    ) x
    where not f.arquivado
  ), '[]'::jsonb);
end $$;

-- Eventos não ficam para sempre: 180 dias bastam para tempo de resposta e histórico de etapa.
create or replace function public.kommo_limpar_eventos()
returns void
language sql
security definer
set search_path to ''
as $$
  delete from public.kommo_eventos where criado_em < now() - interval '180 days';
$$;

revoke execute on function public.kommo_estado_do_espelho(), public.kommo_mapa_lista(),
  public.kommo_mapa_salvar(bigint, text, uuid, uuid), public.kommo_negocio(bigint), public.kommo_funil_agora()
  from public, anon;
grant execute on function public.kommo_estado_do_espelho(), public.kommo_mapa_lista(),
  public.kommo_mapa_salvar(bigint, text, uuid, uuid), public.kommo_negocio(bigint), public.kommo_funil_agora()
  to authenticated;
revoke execute on function public.kommo_limpar_eventos(), public.kommo_negocio_marca_desde() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- O relógio: de dez em dez minutos, um minuto depois da leitura de pedidos.
-- ---------------------------------------------------------------------------
create or replace function public.disparar_leitura_da_kommo()
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
    url     := rtrim(v_url, '/') || '/api/cron/kommo',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_segredo),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end $$;

revoke execute on function public.disparar_leitura_da_kommo() from public, anon, authenticated;

select cron.schedule('ler-a-kommo', '2-59/10 * * * *', $$select public.disparar_leitura_da_kommo();$$);
select cron.schedule('limpar-eventos-da-kommo', '50 4 * * *', $$select public.kommo_limpar_eventos();$$);
