-- Admin: papéis, perfis, histórico e auditoria.
-- Usuários vivem em auth.users (Supabase Auth); aqui guardamos o PAPEL e o
-- histórico. Convém: cadastro só por convite (signup público desabilitado).

create type app_role as enum ('admin', 'editor', 'reviewer', 'author');

-- PROFILES: 1:1 com auth.users, guarda papel e status --------------------
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  role       app_role not null default 'author',
  is_active  boolean  not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Cria o profile automaticamente quando um usuário nasce no Auth.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helpers de papel para RLS (SECURITY DEFINER evita recursão de RLS) ------
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active
  );
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active and p.role = 'admin'
  );
$$;

-- REVISIONS: histórico de versões do conteúdo ----------------------------
create table public.revisions (
  id         uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.contents(id) on delete cascade,
  editor_id  uuid references auth.users(id) on delete set null,
  snapshot   jsonb not null,               -- cópia completa do conteúdo
  note       text,
  created_at timestamptz not null default now()
);
create index revisions_content_idx on public.revisions (content_id, created_at desc);

-- AUDIT_LOGS: quem fez o quê ---------------------------------------------
create table public.audit_logs (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid references auth.users(id) on delete set null,
  action     text not null,                -- create | update | publish | delete | login
  entity     text,                         -- contents | media | products...
  entity_id  uuid,
  meta       jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_entity_idx on public.audit_logs (entity, entity_id);
create index audit_logs_actor_idx  on public.audit_logs (actor_id, created_at desc);

-- RLS --------------------------------------------------------------------
alter table public.profiles   enable row level security;
alter table public.revisions  enable row level security;
alter table public.audit_logs enable row level security;

-- Perfil: cada um lê/edita o seu; admin gerencia todos.
create policy profiles_self_read on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
create policy profiles_self_update on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
create policy profiles_admin_manage on public.profiles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy revisions_staff_read on public.revisions
  for select to authenticated using (public.is_staff());
create policy revisions_staff_insert on public.revisions
  for insert to authenticated with check (public.is_staff());

create policy audit_staff_read on public.audit_logs
  for select to authenticated using (public.is_staff());
create policy audit_staff_insert on public.audit_logs
  for insert to authenticated with check (public.is_staff());
