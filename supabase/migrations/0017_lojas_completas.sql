-- Lojas físicas completas: dados de unidade, mapa, avaliações e galeria de fotos.
-- Requer 0001 (locations), 0003 (is_staff) e 0004 (media).
--
-- Regra que atravessa este arquivo: nenhum dado institucional entra sem fonte.
-- Por isso horário, avaliação e história têm coluna de PROCEDÊNCIA ao lado.
-- Campo sem fonte fica nulo, e a página simplesmente não mostra aquele bloco,
-- em vez de exibir um número que ninguém consegue defender.

-- 1. Colunas novas -----------------------------------------------------------

alter table public.locations
  -- Identidade da unidade
  add column if not exists mall_name       text,        -- shopping onde fica
  add column if not exists unit_label      text,        -- "1º piso, loja 1022"
  add column if not exists opened_at       date,        -- inauguração da unidade
  add column if not exists about           text,        -- história/apresentação
  add column if not exists highlights      text[],      -- diferenciais da unidade
  add column if not exists faqs            jsonb,       -- [{question, answer}]

  -- Como chegar e como falar
  add column if not exists maps_url        text,        -- link curto do Google Maps
  add column if not exists waze_url        text,        -- link do Waze (opcional)
  add column if not exists whatsapp        text,        -- só dígitos, com DDI

  -- Horário: a fonte importa tanto quanto o valor
  add column if not exists hours_note      text,
  add column if not exists hours_source    text,

  -- Avaliações: NUNCA preencher sem origem verificável. Alimenta o bloco
  -- visual e, só então, o aggregateRating do schema.
  add column if not exists rating          numeric(2, 1),
  add column if not exists reviews_count   integer,
  add column if not exists reviews_source  text,
  add column if not exists reviews_checked_at date,

  add column if not exists sort_order      integer not null default 0;

comment on column public.locations.rating is
  'Nota média. Só preencher com origem real registrada em reviews_source. Nunca estimar.';
comment on column public.locations.reviews_count is
  'Quantidade de avaliações. Mesma regra do rating.';
comment on column public.locations.hours_source is
  'De onde veio o horário (site do shopping, ficha do Google). Sem isto, o horário não é publicado.';

create index if not exists locations_sort_idx on public.locations (sort_order, name);

-- Nota é média, então 0 a 5 com uma casa. Contagem não pode ser negativa.
alter table public.locations drop constraint if exists locations_rating_faixa;
alter table public.locations
  add constraint locations_rating_faixa
  check (rating is null or (rating >= 0 and rating <= 5));

alter table public.locations drop constraint if exists locations_reviews_positivo;
alter table public.locations
  add constraint locations_reviews_positivo
  check (reviews_count is null or reviews_count >= 0);

-- Nota sem origem é afirmação sem fonte, e o banco recusa.
alter table public.locations drop constraint if exists locations_rating_com_fonte;
alter table public.locations
  add constraint locations_rating_com_fonte
  check (
    (rating is null and reviews_count is null)
    or (reviews_source is not null and length(btrim(reviews_source)) > 0)
  );

-- 2. Galeria de fotos --------------------------------------------------------
-- Espelha content_media: a foto vive em `media` (com alt, crédito e dimensão)
-- e aqui fica só o vínculo com a loja e a ordem de exibição.

create table if not exists public.location_media (
  id               uuid primary key default gen_random_uuid(),
  location_id      uuid not null references public.locations(id) on delete cascade,
  media_id         uuid not null references public.media(id) on delete cascade,
  role             text not null default 'gallery',   -- hero | gallery
  position         int  not null default 0,
  alt_override     text,
  caption_override text,
  created_at       timestamptz not null default now()
);

create index if not exists location_media_loja_idx
  on public.location_media (location_id, role, position);
create unique index if not exists location_media_unico
  on public.location_media (location_id, media_id, role);

alter table public.location_media enable row level security;

drop policy if exists location_media_public_read on public.location_media;
create policy location_media_public_read on public.location_media
  for select to anon, authenticated using (
    exists (
      select 1 from public.locations l
      where l.id = location_media.location_id and l.status = 'published'
    )
  );

drop policy if exists location_media_staff_write on public.location_media;
create policy location_media_staff_write on public.location_media
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- 3. As 10 lojas -------------------------------------------------------------
-- Endereço, telefone e link do Maps saem de jkaliancas.com.br/lojas-fisicas.
-- Coordenadas e place id saem da resolução dos próprios links curtos do Maps.
-- Horário só entra onde existe fonte, e a fonte fica registrada na linha.

insert into public.locations (
  slug, name, mall_name, address, address_locality, address_region, postal_code,
  country, phone, whatsapp, latitude, longitude, maps_url, gbp_place_id,
  opening_hours, hours_source, services, status, published_at, sort_order
) values
  (
    'santana-parque-shopping', 'Santana Parque Shopping', 'Santana Parque Shopping',
    'Rua Conselheiro Moreira de Barros, 2780', 'São Paulo', 'SP', '02430-001', 'BR',
    null, '5511963005071', -23.4828892, -46.6450402,
    'https://maps.app.goo.gl/UuqTaHew5ED2VcuT9', '0x94cef62e3c56b2d9:0xa9b6c0bcba48eb52',
    '[{"dayOfWeek":["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],"opens":"10:00","closes":"22:00"},
      {"dayOfWeek":["Sunday"],"opens":"14:00","closes":"20:00"}]'::jsonb,
    'Site do Santana Parque Shopping, consultado em 12/08/2026',
    array['Alianças sob medida','Gravação','Aro de prova'], 'published', now(), 10
  ),
  (
    'shopping-uniao-osasco', 'Shopping União de Osasco', 'Shopping União de Osasco',
    'Avenida dos Autonomistas, 1400, Vila Yara', 'Osasco', 'SP', '06020-010', 'BR',
    null, '5511948942425', -23.5399348, -46.7656600,
    'https://maps.app.goo.gl/U46LTYBheaZhheq58', '0x94ceff41930a869f:0x7863bdce8737bd03',
    '[{"dayOfWeek":["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],"opens":"10:00","closes":"22:00"},
      {"dayOfWeek":["Sunday"],"opens":"14:00","closes":"20:00"}]'::jsonb,
    'Site do Shopping União de Osasco, consultado em 12/08/2026',
    array['Alianças sob medida','Gravação','Aro de prova'], 'published', now(), 20
  ),
  (
    'raposo-shopping', 'Raposo Shopping', 'Raposo Shopping',
    'Rodovia Raposo Tavares, km 14,5', 'São Paulo', 'SP', '05577-200', 'BR',
    null, '5511913695723', -23.5877090, -46.7509420,
    'https://maps.app.goo.gl/kaTn4A1aKeSvkLAf9', '0x94ce55d4eeb817d5:0xb04d7a70bca56bba',
    null, null,
    array['Alianças sob medida','Gravação','Aro de prova'], 'published', now(), 30
  ),
  (
    'shopping-granja-vianna', 'Shopping Granja Vianna', 'Shopping Granja Vianna',
    'Rodovia Raposo Tavares, 23.500, Lageadinho', 'Cotia', 'SP', '06709-015', 'BR',
    null, '5511976090358', -23.5925503, -46.8330476,
    'https://maps.app.goo.gl/jH4LWZmDjkQrCby88', '0x94cfaab0c7c832ff:0x1671478b0e5a54e3',
    null, null,
    array['Alianças sob medida','Gravação','Aro de prova'], 'published', now(), 40
  ),
  (
    'osasco-plaza-shopping', 'Osasco Plaza Shopping', 'Osasco Plaza Shopping',
    'Rua Tenente Avelar Pires de Azevedo, 81, Centro', 'Osasco', 'SP', '06016-060', 'BR',
    null, '5511945580512', -23.5294664, -46.7776765,
    'https://maps.app.goo.gl/vJvavL5A2HjwTxpN9', '0x94ceff053cc4c045:0xcaf9eb5eb01731ab',
    null, null,
    array['Alianças sob medida','Gravação','Aro de prova'], 'published', now(), 50
  ),
  (
    'shopping-interlagos', 'Shopping Interlagos', 'Shopping Interlagos',
    'Avenida Interlagos, 2255, Jardim Umuarama', 'São Paulo', 'SP', '04661-200', 'BR',
    null, '5511994169361', -23.6758989, -46.6770724,
    'https://maps.app.goo.gl/zuVRaDoumNgxT2pR9', '0x94ce510072579a8d:0xd1bfe4adcbcaf620',
    null, null,
    array['Alianças sob medida','Gravação','Aro de prova'], 'published', now(), 60
  ),
  (
    'grand-plaza-shopping', 'Grand Plaza Shopping', 'Grand Plaza Shopping',
    'Avenida Industrial, 600, Centro', 'Santo André', 'SP', '09080-510', 'BR',
    null, '5511948858123', -23.6467785, -46.5338646,
    'https://maps.app.goo.gl/gZB7hS1U9bc4HNd48', '0x94ce439ce3d87a93:0x4b533d7bbe0482c1',
    null, null,
    array['Alianças sob medida','Gravação','Aro de prova'], 'published', now(), 70
  ),
  (
    'shopping-aricanduva', 'Shopping Aricanduva', 'Shopping Aricanduva',
    'Avenida Aricanduva, 5555, Jardim Marília', 'São Paulo', 'SP', '03572-000', 'BR',
    null, '5511985495745', -23.5621232, -46.5030959,
    'https://maps.app.goo.gl/P6x1zFkXSS11McnD8', '0x94ce676a7c55af33:0xb4bf32e1c4756362',
    null, null,
    array['Alianças sob medida','Gravação','Aro de prova'], 'published', now(), 80
  ),
  (
    'internacional-shopping-guarulhos', 'Internacional Shopping Guarulhos', 'Internacional Shopping Guarulhos',
    'Rodovia Presidente Dutra, 225, Vila Itapegica', 'Guarulhos', 'SP', '07034-911', 'BR',
    '+5511913292906', null, -23.4897817, -46.5489643,
    'https://maps.app.goo.gl/Zi3mdoHrphVitfK36', '0x94ce5f2b137f661d:0xdff7c87baeb6557e',
    '[{"dayOfWeek":["Monday","Tuesday","Wednesday","Thursday","Friday"],"opens":"10:00","closes":"19:30"},
      {"dayOfWeek":["Saturday"],"opens":"10:00","closes":"17:30"}]'::jsonb,
    'Ficha da JK Alianças no site do Internacional Shopping Guarulhos, consultada em 12/08/2026',
    array['Alianças sob medida','Gravação','Aro de prova'], 'published', now(), 90
  ),
  (
    'shopping-tambore', 'Tamboré', 'Shopping Tamboré',
    'Avenida Piracema, 669, Tamboré', 'Barueri', 'SP', '06460-030', 'BR',
    '+5511991734391', null, null, null,
    null, null,
    null, null,
    array['Alianças sob medida','Gravação','Aro de prova'], 'published', now(), 100
  )
on conflict (slug) do update set
  name             = excluded.name,
  mall_name        = excluded.mall_name,
  address          = excluded.address,
  address_locality = excluded.address_locality,
  address_region   = excluded.address_region,
  postal_code      = excluded.postal_code,
  country          = excluded.country,
  phone            = excluded.phone,
  whatsapp         = excluded.whatsapp,
  latitude         = excluded.latitude,
  longitude        = excluded.longitude,
  maps_url         = excluded.maps_url,
  gbp_place_id     = excluded.gbp_place_id,
  opening_hours    = coalesce(excluded.opening_hours, public.locations.opening_hours),
  hours_source     = coalesce(excluded.hours_source, public.locations.hours_source),
  services         = excluded.services,
  sort_order       = excluded.sort_order,
  updated_at       = now();

-- As lojas de exemplo do scaffold saem de cena agora que existem as reais.
delete from public.locations where slug in ('guarulhos-centro', 'barueri-tambore');
