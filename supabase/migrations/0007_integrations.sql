-- Integrações (GMB, Search Console, GA4, GTM, Tray, Resend) + métricas.
-- SEGREDOS (tokens/refresh) NÃO ficam aqui — vão em variáveis de ambiente /
-- Supabase Vault. Aqui só config NÃO-sensível e status. Requer 0003 (is_staff).

create table public.integrations (
  id           uuid primary key default gen_random_uuid(),
  provider     text not null unique,     -- gmb | gsc | ga4 | gtm | tray | resend
  display_name text,
  config       jsonb not null default '{}'::jsonb,  -- ex.: {measurement_id, property}
  status       text not null default 'disconnected', -- connected | disconnected | error
  connected_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger integrations_set_updated_at before update on public.integrations
  for each row execute function public.set_updated_at();

-- Snapshots de métricas (Search Console / GA4) para o painel mensal.
create table public.analytics_snapshots (
  id              uuid primary key default gen_random_uuid(),
  source          text not null,          -- gsc | ga4
  period_start    date not null,
  period_end      date not null,
  metric          text not null,          -- impressions | clicks | position | ctr | users
  dimension       text,                   -- query | page | ...
  dimension_value text,
  value           numeric,
  url             text,
  created_at      timestamptz not null default now()
);
create index analytics_source_period_idx
  on public.analytics_snapshots (source, period_start, period_end);

-- Semente com os IDs que já temos (Trello) — config PÚBLICA (vão no HTML mesmo).
insert into public.integrations (provider, display_name, config, status) values
  ('ga4', 'Google Analytics 4', '{"measurement_id":"G-9V89YVR635"}'::jsonb, 'disconnected'),
  ('gtm', 'Google Tag Manager',  '{"container_id":"GTM-WWT3T789"}'::jsonb,  'disconnected')
on conflict (provider) do nothing;

alter table public.integrations        enable row level security;
alter table public.analytics_snapshots enable row level security;

-- Integrações e métricas: internas, só staff (config pode ficar sensível).
create policy integrations_staff_all on public.integrations
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy analytics_staff_read on public.analytics_snapshots
  for select to authenticated using (public.is_staff());
create policy analytics_staff_insert on public.analytics_snapshots
  for insert to authenticated with check (public.is_staff());
