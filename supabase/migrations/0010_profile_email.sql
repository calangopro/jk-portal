-- Guarda o e-mail no profile para a tela de usuários do admin poder listar
-- sem depender da service_role (auth.users não é legível via RLS).

alter table public.profiles add column if not exists email text;

-- Backfill dos usuários já existentes.
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is null;

-- Passa a preencher email (e full_name) na criação do usuário.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public;
