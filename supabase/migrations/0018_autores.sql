-- Autores e revisores como entidade própria, para E-E-A-T.
-- Requer 0001 (contents), 0003 (is_staff / is_admin) e 0004 (media).
--
-- Por que esta tabela existe:
-- A documentação do Google sobre conteúdo confiável pergunta, em ordem, quem
-- escreveu, como foi apurado e por que a página existe. Até aqui o portal
-- respondia o "quem" com um campo de TEXTO LIVRE em contents.author_name, que
-- não levava a lugar nenhum. O resultado prático: o Person do JSON-LD saía sem
-- `url`, e a documentação de dados estruturados de Article pede exatamente que
-- author.url aponte para uma página que identifique aquela pessoa.
--
-- author_name e reviewer_name CONTINUAM na tabela contents, de propósito. São
-- o caminho de sobra para conteúdo antigo e para colaborador eventual que não
-- vale cadastrar. A FK só entra quando existe pessoa de verdade cadastrada.

create table if not exists public.authors (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  -- Cargo e credencial: o que sustenta a assinatura. Ficam separados do nome
  -- porque a documentação de Article é explícita: author.name leva SÓ o nome,
  -- sem cargo, sem título honorífico e sem o nome do veículo.
  job_title     text,
  credentials   text,
  bio           text,
  photo_media_id uuid references public.media(id) on delete set null,
  -- Perfis externos que provam que a pessoa existe fora do site (sameAs).
  same_as       text[] not null default '{}',
  email         text,
  -- Vínculo opcional com a conta do admin, quando o autor também edita.
  profile_id    uuid references public.profiles(id) on delete set null,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.authors is
  'Pessoas que assinam ou revisam conteúdo. Alimenta /autor/[slug], o ProfilePage e o author.url do Article.';
comment on column public.authors.same_as is
  'Perfis públicos da pessoa (LinkedIn, Instagram). Vira sameAs no schema. Nunca inventar.';
comment on column public.authors.job_title is
  'Cargo. Fica FORA de author.name no JSON-LD, como manda a documentação de Article.';

create index if not exists authors_active_idx on public.authors (is_active);

drop trigger if exists authors_set_updated_at on public.authors;
create trigger authors_set_updated_at
  before update on public.authors
  for each row execute function public.set_updated_at();

-- Vínculo com o conteúdo -----------------------------------------------------

alter table public.contents
  add column if not exists author_id   uuid references public.authors(id) on delete set null,
  add column if not exists reviewer_id uuid references public.authors(id) on delete set null;

comment on column public.contents.author_id is
  'Autor cadastrado. Quando preenchido, tem prioridade sobre author_name (texto livre).';
comment on column public.contents.reviewer_id is
  'Revisor cadastrado. Quando preenchido, tem prioridade sobre reviewer_name.';

create index if not exists contents_author_idx   on public.contents (author_id);
create index if not exists contents_reviewer_idx on public.contents (reviewer_id);

-- RLS ------------------------------------------------------------------------

alter table public.authors enable row level security;

-- Leitura pública só de autor ativo. A página /autor/[slug] é pública e o
-- Article precisa resolver author.url sem sessão.
drop policy if exists authors_public_read on public.authors;
create policy authors_public_read on public.authors
  for select to anon, authenticated using (is_active);

drop policy if exists authors_staff_read on public.authors;
create policy authors_staff_read on public.authors
  for select to authenticated using (public.is_staff());

-- Escrita só de admin: assinatura é sinal de confiança, e quem pode criar uma
-- assinatura pode atribuir autoridade a um texto.
drop policy if exists authors_admin_write on public.authors;
create policy authors_admin_write on public.authors
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
