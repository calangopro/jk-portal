-- Portal editorial JK Alianças — schema inicial (camada de conteúdo).
-- A Tray continua fonte de verdade de preço/estoque/checkout; aqui só conteúdo.

create extension if not exists pgcrypto;

-- Tipos --------------------------------------------------------------------
create type content_type   as enum ('home', 'guia', 'artigo', 'loja', 'faq');
create type content_status as enum ('draft', 'in_review', 'published', 'archived');
create type redirect_kind  as enum ('301', '302', '410');
create type source_status  as enum ('pending', 'validated', 'rejected');

-- CONTENTS: guias/artigos editoriais -------------------------------------
create table public.contents (
  id               uuid primary key default gen_random_uuid(),
  type             content_type   not null,
  title            text           not null,
  slug             text           not null unique,
  search_intent    text,                         -- intenção de busca
  status           content_status not null default 'draft',
  author_name      text,                         -- autor (revisão humana exigida)
  reviewer_name    text,                         -- revisor
  canonical_url    text,                         -- canonical absoluto (override opcional)
  excerpt          text,
  answer           text,                         -- resposta direta no topo (GEO)
  body_md          text,
  meta_title       text,
  meta_description text,
  og_image_url     text,
  faqs             jsonb,                         -- [{question, answer}] p/ FAQPage
  published_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index contents_type_status_idx on public.contents (type, status);
create index contents_status_idx on public.contents (status);

-- CONTENT_LINKS: links internos e para categorias/produtos da Tray --------
create table public.content_links (
  id                uuid primary key default gen_random_uuid(),
  source_content_id uuid not null references public.contents(id) on delete cascade,
  target_content_id uuid references public.contents(id) on delete cascade,
  target_kind       text not null default 'content', -- content | tray_category | tray_product | external
  target_url        text,                             -- p/ Tray / externos
  anchor            text,
  rel               text,                             -- nofollow | sponsored...
  position          int,
  created_at        timestamptz not null default now(),
  check (target_content_id is not null or target_url is not null)
);
create index content_links_source_idx on public.content_links (source_content_id);

-- SOURCES: evidências das afirmações editoriais --------------------------
create table public.sources (
  id                uuid primary key default gen_random_uuid(),
  content_id        uuid references public.contents(id) on delete set null,
  file_url          text,
  source_url        text,
  captured_at       date,
  responsible       text,                             -- responsável pela evidência
  evidence          text,
  validation_status source_status not null default 'pending',
  created_at        timestamptz not null default now()
);
create index sources_content_idx on public.sources (content_id);

-- LOCATIONS: as lojas físicas (NAP + geo + horário) ----------------------
create table public.locations (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,             -- cidade-bairro
  name             text not null,
  address          text not null,
  address_locality text,
  address_region   text,
  postal_code      text,
  country          text default 'BR',
  phone            text,
  latitude         numeric(9, 6),
  longitude        numeric(9, 6),
  opening_hours    jsonb,                            -- OpeningHoursSpecification[]
  gbp_url          text,                             -- Google Business Profile
  gbp_place_id     text,
  utm              jsonb,
  services         text[],
  status           content_status not null default 'draft',
  published_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index locations_status_idx on public.locations (status);

-- REDIRECTS: nunca perder uma URL ----------------------------------------
create table public.redirects (
  id              uuid primary key default gen_random_uuid(),
  source_path     text not null unique,
  destination_url text not null,
  reason          text,
  status          redirect_kind not null default '301',
  created_at      timestamptz not null default now()
);

-- updated_at automático ---------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger contents_set_updated_at
  before update on public.contents
  for each row execute function public.set_updated_at();

create trigger locations_set_updated_at
  before update on public.locations
  for each row execute function public.set_updated_at();
