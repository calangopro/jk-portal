-- Catálogo — sincronização SÓ-LEITURA da Tray. A Tray é fonte de verdade de
-- preço/estoque/checkout; aqui guardamos uma cópia para conteúdo, links e SEO.
-- Requer 0003 (is_staff). Nunca escrever preço/estoque de volta na Tray.

create table public.categories (
  id             uuid primary key default gen_random_uuid(),
  tray_id        text unique,
  name           text not null,
  canonical_name text,
  slug           text unique,
  parent_id      uuid references public.categories(id) on delete set null,
  intent         text,                 -- transacional | informacional
  url            text,                 -- URL na Tray
  position       int,
  is_active      boolean not null default true,
  last_synced_at timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger categories_set_updated_at before update on public.categories
  for each row execute function public.set_updated_at();

create table public.products (
  id             uuid primary key default gen_random_uuid(),
  tray_id        text unique not null,
  name           text not null,
  slug           text unique,
  url            text,                 -- URL do produto na Tray (checkout lá)
  category_id    uuid references public.categories(id) on delete set null,
  status         text,                 -- active | inactive | visible (na Tray)
  main_image_url text,
  description    text,
  brand          text default 'JK Alianças',
  is_champion    boolean not null default false,  -- "produto campeão"
  is_active      boolean not null default true,
  raw            jsonb,                -- payload bruto da Tray (preservado)
  last_synced_at timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index products_category_idx on public.products (category_id);
create index products_active_idx   on public.products (is_active, is_champion);
create trigger products_set_updated_at before update on public.products
  for each row execute function public.set_updated_at();

create table public.product_variants (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references public.products(id) on delete cascade,
  tray_variant_id text,
  sku             text,
  ring_size       text,               -- aro
  material        text,               -- prata 925, ouro 18k...
  color           text,
  width_mm        numeric(5, 2),      -- largura
  price           numeric(12, 2),     -- espelho (a Tray manda)
  stock           int,
  is_active       boolean not null default true,
  raw             jsonb,
  last_synced_at  timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index product_variants_product_idx on public.product_variants (product_id);
create trigger product_variants_set_updated_at before update on public.product_variants
  for each row execute function public.set_updated_at();

-- Um produto pode estar em várias categorias (extra ao category_id principal).
create table public.product_categories (
  product_id  uuid not null references public.products(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  primary key (product_id, category_id)
);

-- Vínculo conteúdo <-> produto (relacionados / campeão dentro do artigo) ---
create table public.content_products (
  id         uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.contents(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  relation   text not null default 'related',  -- related | champion | mentioned
  position   int  not null default 0,
  created_at timestamptz not null default now(),
  unique (content_id, product_id)
);
create index content_products_content_idx on public.content_products (content_id, position);

-- Logs da sincronização com a Tray ---------------------------------------
create table public.sync_logs (
  id          uuid primary key default gen_random_uuid(),
  source      text not null default 'tray',
  operation   text,                    -- products | categories | variants...
  status      text not null default 'success', -- success | error | partial
  attempted   int default 0,
  succeeded   int default 0,
  failed      int default 0,
  error       text,
  payload     jsonb,
  started_at  timestamptz,
  finished_at timestamptz,
  created_at  timestamptz not null default now()
);
create index sync_logs_created_idx on public.sync_logs (created_at desc);

-- RLS --------------------------------------------------------------------
alter table public.categories         enable row level security;
alter table public.products           enable row level security;
alter table public.product_variants   enable row level security;
alter table public.product_categories enable row level security;
alter table public.content_products   enable row level security;
alter table public.sync_logs          enable row level security;

-- Catálogo ativo é público (aparece no site); escrita só staff.
create policy categories_public_read on public.categories
  for select to anon, authenticated using (is_active);
create policy products_public_read on public.products
  for select to anon, authenticated using (is_active);
create policy product_variants_public_read on public.product_variants
  for select to anon, authenticated using (is_active);
create policy product_categories_public_read on public.product_categories
  for select to anon, authenticated using (true);
create policy content_products_public_read on public.content_products
  for select to anon, authenticated using (
    exists (
      select 1 from public.contents c
      where c.id = content_products.content_id and c.status = 'published'
    )
  );

create policy categories_staff_write on public.categories
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy products_staff_write on public.products
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy product_variants_staff_write on public.product_variants
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy product_categories_staff_write on public.product_categories
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy content_products_staff_write on public.content_products
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- sync_logs: interno, só staff.
create policy sync_logs_staff_read on public.sync_logs
  for select to authenticated using (public.is_staff());
create policy sync_logs_staff_insert on public.sync_logs
  for insert to authenticated with check (public.is_staff());
