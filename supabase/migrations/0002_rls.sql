-- RLS: leitura pública só do conteúdo PUBLICADO; escrita só autenticada.
-- A service_role (usada só no servidor) ignora RLS para operações de admin.

alter table public.contents      enable row level security;
alter table public.content_links enable row level security;
alter table public.sources       enable row level security;
alter table public.locations     enable row level security;
alter table public.redirects     enable row level security;

-- Leitura pública -----------------------------------------------------------
create policy contents_public_read on public.contents
  for select to anon, authenticated
  using (status = 'published');

create policy locations_public_read on public.locations
  for select to anon, authenticated
  using (status = 'published');

-- Links só quando o conteúdo de origem está publicado
create policy content_links_public_read on public.content_links
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.contents c
      where c.id = content_links.source_content_id
        and c.status = 'published'
    )
  );

-- Redirects: caminhos operacionais, não sensíveis — leitura liberada
create policy redirects_public_read on public.redirects
  for select to anon, authenticated
  using (true);

-- sources: evidência INTERNA — SEM leitura pública (só autenticado)
create policy sources_auth_read on public.sources
  for select to authenticated
  using (true);

-- Escrita: só autenticado ---------------------------------------------------
create policy contents_auth_write on public.contents
  for all to authenticated using (true) with check (true);

create policy content_links_auth_write on public.content_links
  for all to authenticated using (true) with check (true);

create policy sources_auth_write on public.sources
  for all to authenticated using (true) with check (true);

create policy locations_auth_write on public.locations
  for all to authenticated using (true) with check (true);

create policy redirects_auth_write on public.redirects
  for all to authenticated using (true) with check (true);
