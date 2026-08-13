-- Fecha um buraco por onde qualquer estranho escrevia no CMS.
--
-- Cadeia completa, medida em 12/08/2026 no projeto de produção:
--   1. O cadastro público estava LIGADO no Supabase (`disable_signup: false`),
--      e a chave anônima vai no HTML de qualquer visitante. Ou seja, qualquer
--      pessoa criava conta e recebia um JWT com papel `authenticated`.
--   2. `handle_new_user()` inseria o profile sem dizer nada sobre `is_active`,
--      e o default da coluna é `true`. Conta nova nascia ATIVA.
--   3. `is_staff()` é apenas "tem profile ativo", então a conta nova virava
--      staff para efeito de RLS.
--   4. E as policies de escrita de 0002 nem exigiam isso: eram
--      `for all to authenticated using (true) with check (true)`.
--
-- Efeito prático, reproduzido com um JWT sem profile nenhum: lia os rascunhos
-- não publicados, dava `update` em todos os `contents` e inseria linha em
-- `redirects`. Esse último é o pior: `src/middleware.ts` serve essa tabela em
-- toda requisição, então dava para apontar a home do portal para outro domínio.
--
-- Falta ainda, fora do banco: desligar o cadastro público no painel do Supabase
-- (Authentication -> Sign In / Providers -> "Allow new users to sign up").
-- É defesa em profundidade e não dá para fazer por migration.

-- 1. Conta que não veio de convite nasce inativa -----------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, is_active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.email,
    -- `inviteUserByEmail` preenche `invited_at`. Cadastro espontâneo não
    -- preenche, e cai inativo: existe no auth, mas não é staff para a RLS.
    new.invited_at is not null
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- 2. Escrita e leitura interna passam a exigir is_staff() --------------------
-- As policies antigas usavam `using (true)`, o que dava acesso a qualquer JWT.
drop policy if exists contents_auth_write      on public.contents;
drop policy if exists content_links_auth_write on public.content_links;
drop policy if exists sources_auth_write       on public.sources;
drop policy if exists sources_auth_read        on public.sources;
drop policy if exists locations_auth_write     on public.locations;
drop policy if exists redirects_auth_write     on public.redirects;

create policy contents_staff_write on public.contents
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy content_links_staff_write on public.content_links
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- `sources` é evidência interna: nunca teve leitura pública, e agora a leitura
-- autenticada também exige staff.
create policy sources_staff_all on public.sources
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy locations_staff_write on public.locations
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy redirects_staff_write on public.redirects
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- A leitura pública continua como estava: `contents` e `locations` só
-- publicados, `content_links` só com origem publicada, `redirects` liberado
-- porque o middleware precisa dele em toda requisição.
