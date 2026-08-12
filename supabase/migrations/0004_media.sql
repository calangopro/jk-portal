-- Mídia: imagens com SEO/GEO (alt, legenda, crédito) + vínculo com conteúdo.
-- Requer 0003 (is_staff). Bucket público 'media' para imagens exibidas no site.

insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

create table public.media (
  id             uuid primary key default gen_random_uuid(),
  bucket         text not null default 'media',
  storage_path   text not null,
  url            text,                     -- URL pública derivada
  -- SEO / GEO da imagem:
  alt            text,                     -- texto alternativo (exigido ao publicar)
  title          text,
  caption        text,
  credit         text,                     -- crédito / fonte
  lang           text default 'pt-BR',
  -- técnicos:
  mime           text,
  width          int,
  height         int,
  bytes          bigint,
  focal_x        numeric(4, 3),            -- ponto focal p/ corte (0..1)
  focal_y        numeric(4, 3),
  placeholder    text,                     -- LQIP / blurhash
  created_by     uuid references auth.users(id) on delete set null,
  deactivated_at timestamptz,              -- soft-delete
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index media_active_idx on public.media (deactivated_at);

create trigger media_set_updated_at
  before update on public.media
  for each row execute function public.set_updated_at();

-- Vínculo conteúdo <-> mídia (hero, inline, galeria, og) -----------------
create table public.content_media (
  id               uuid primary key default gen_random_uuid(),
  content_id       uuid not null references public.contents(id) on delete cascade,
  media_id         uuid not null references public.media(id) on delete cascade,
  role             text not null default 'inline',  -- hero | inline | gallery | og
  position         int  not null default 0,
  alt_override     text,                              -- alt no contexto (SEO/GEO)
  caption_override text,
  created_at       timestamptz not null default now()
);
create index content_media_content_idx on public.content_media (content_id, position);
create unique index content_media_unique on public.content_media (content_id, media_id, role);

-- RLS --------------------------------------------------------------------
alter table public.media         enable row level security;
alter table public.content_media enable row level security;

create policy media_public_read on public.media
  for select to anon, authenticated using (deactivated_at is null);
create policy media_staff_write on public.media
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy content_media_public_read on public.content_media
  for select to anon, authenticated using (
    exists (
      select 1 from public.contents c
      where c.id = content_media.content_id and c.status = 'published'
    )
  );
create policy content_media_staff_write on public.content_media
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- Storage: leitura pública do bucket 'media'; escrita/gestão só staff.
create policy "media objects public read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'media');
create policy "media objects staff write" on storage.objects
  for all to authenticated
  using (bucket_id = 'media' and public.is_staff())
  with check (bucket_id = 'media' and public.is_staff());
