-- Configuração do site editável pelo admin: tema, menus e dicionário de textos.
--
-- São duas tabelas de propósito diferente, e a separação é deliberada:
--
--   `site_settings` guarda OBJETOS por assunto (tema, menu do cabeçalho, menu
--   do rodapé). Poucas linhas, cada uma com um jsonb dentro.
--
--   `site_strings` guarda o DICIONÁRIO de textos, uma linha por chave. São
--   centenas de chaves, e a tela do admin precisa listar, buscar e reverter uma
--   a uma. Se isso morasse num jsonb único, cada troca de headline reescreveria
--   o objeto inteiro, e duas pessoas editando textos de páginas diferentes
--   sobrescreveriam uma à outra.
--
-- Nomes de coluna em inglês para acompanhar o resto do schema.

create table public.site_settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  -- Válvula para configuração futura que NÃO possa ir ao público. Hoje tudo
  -- aqui é público por natureza (cor, fonte, menu), mas sem esta coluna a
  -- primeira configuração sensível viraria vazamento silencioso, que foi
  -- exatamente o que aconteceu com `integrations`.
  is_public  boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table public.site_strings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create trigger site_settings_set_updated_at before update on public.site_settings
  for each row execute function public.set_updated_at();
create trigger site_strings_set_updated_at before update on public.site_strings
  for each row execute function public.set_updated_at();

alter table public.site_settings enable row level security;
alter table public.site_strings  enable row level security;

-- Leitura pública: o site renderiza sem sessão, então precisa ler tema, menu e
-- texto com a chave anônima.
create policy site_settings_public_read on public.site_settings
  for select to anon, authenticated using (is_public);

create policy site_strings_public_read on public.site_strings
  for select to anon, authenticated using (true);

-- Escrita só para quem tem perfil ativo.
create policy site_settings_staff_write on public.site_settings
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy site_strings_staff_write on public.site_strings
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- Semente do tema, com exatamente os valores que hoje estão no globals.css.
--
-- Só entram tokens que SOBREVIVEM no CSS gerado. O Tailwind v4 remove do
-- `:root` todo token de `@theme` que nenhuma utilidade consome, e hoje
-- `--color-header`, `--color-surface`, `--color-surface-alt`, `--color-glow` e
-- `--color-wine-soft` simplesmente não existem no arquivo final. Oferecer um
-- deles no painel seria entregar um controle que não muda nada na tela.
insert into public.site_settings (key, value) values (
  'tema',
  jsonb_build_object(
    'versao', 1,
    'cores', jsonb_build_object(
      'brand',        '#be9b60',
      'brand-light',  '#d8b877',
      'brand-nav',    '#84663c',
      'brand-strong', '#76582b',
      'wine',         '#7a2230',
      'wine-deep',    '#5c1922',
      'background',   '#f7f3ec',
      'foreground',   '#141414',
      'ink',          '#171512',
      'charcoal',     '#1a1815',
      'muted',        '#5f594f',
      'border',       '#e8e2d8'
    ),
    'raios', jsonb_build_object(
      'sm', '10px', 'md', '14px', 'lg', '20px', 'xl', '28px'
    ),
    'fonte', jsonb_build_object('par', 'cormorant-montserrat')
  )
) on conflict (key) do nothing;
