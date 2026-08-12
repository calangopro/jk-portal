-- Comentários com moderação. UGC ajuda SEO/GEO (frescor/engajamento), mas
-- precisa de anti-spam. Requer 0003 (is_staff).

create type comment_status as enum ('pending', 'approved', 'spam', 'rejected');

create table public.comments (
  id           uuid primary key default gen_random_uuid(),
  content_id   uuid not null references public.contents(id) on delete cascade,
  parent_id    uuid references public.comments(id) on delete cascade,  -- threads
  author_name  text not null,
  author_email text,                    -- não exibido publicamente
  body         text not null,
  status       comment_status not null default 'pending',
  ip           inet,                    -- sinal anti-spam
  user_agent   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index comments_content_idx on public.comments (content_id, status, created_at desc);

create trigger comments_set_updated_at before update on public.comments
  for each row execute function public.set_updated_at();

alter table public.comments enable row level security;

-- Público lê só comentários APROVADOS de conteúdo publicado.
create policy comments_public_read on public.comments
  for select to anon, authenticated using (
    status = 'approved'
    and exists (
      select 1 from public.contents c
      where c.id = comments.content_id and c.status = 'published'
    )
  );

-- Qualquer visitante pode ENVIAR (entra sempre como 'pending', em conteúdo publicado).
create policy comments_public_insert on public.comments
  for insert to anon, authenticated with check (
    status = 'pending'
    and exists (
      select 1 from public.contents c
      where c.id = content_id and c.status = 'published'
    )
  );

-- Staff modera (lê tudo, aprova/reprova, exclui).
create policy comments_staff_read on public.comments
  for select to authenticated using (public.is_staff());
create policy comments_staff_update on public.comments
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy comments_staff_delete on public.comments
  for delete to authenticated using (public.is_staff());
