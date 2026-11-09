-- Avaliações do Google das lojas físicas, pela API do Perfil da Empresa.
--
-- Estas tabelas são CACHE, não arquivo. A política da API
-- (developers.google.com/my-business/content/policies, "Content storage") só
-- deixa guardar o conteúdo dela por pouco tempo, no máximo 30 dias, com
-- segurança e sem manipular nem agregar. Por isso:
--   - a sincronização diária regrava tudo e apaga o que o Google não devolveu;
--   - `limpar_avaliacoes_google()` derruba qualquer linha com mais de 25 dias
--     sem confirmação, mesmo que a sincronização pare de rodar;
--   - a nota e o total de cada loja são os que o Google dá (`averageRating` e
--     `totalReviewCount`), nunca uma média calculada aqui.
--
-- Sem policy nenhuma: só a service_role lê e escreve. O público vê pelo
-- endpoint `/api/avaliacoes`, que escolhe o que sai.
--
-- Quem fala com o Google é o portal, com o cliente OAuth e o refresh token
-- guardados em `integration_tokens` (provedores `google_cliente` e
-- `google_perfil`). O banco só chama a rota, igual à importação do Search
-- Console (0038).

create table public.google_locais (
  name             text primary key,                 -- "locations/123"
  conta            text not null,                    -- "accounts/456"
  titulo           text not null,
  endereco         text,
  maps_uri         text,
  avaliar_uri      text,                             -- link para deixar avaliação
  place_id         text,
  location_id      uuid references public.locations(id) on delete set null,
  nota_media       numeric(3, 2),                    -- averageRating, como veio
  total_avaliacoes integer,                          -- totalReviewCount, como veio
  sincronizado_em  timestamptz not null default now()
);

create table public.google_avaliacoes (
  name            text primary key,                  -- accounts/../locations/../reviews/..
  local           text not null references public.google_locais(name) on delete cascade,
  autor           text,
  autor_anonimo   boolean not null default false,
  nota            smallint not null check (nota between 1 and 5),
  comentario      text,
  resposta        text,
  criada_em       timestamptz,
  atualizada_em   timestamptz,
  sincronizado_em timestamptz not null default now()
);

create index google_avaliacoes_vitrine
  on public.google_avaliacoes (nota desc, criada_em desc)
  where comentario is not null;

create index google_avaliacoes_local on public.google_avaliacoes (local);

alter table public.google_locais enable row level security;
alter table public.google_avaliacoes enable row level security;

comment on table public.google_locais is
  'Cache das lojas no Perfil da Empresa do Google. No máximo 25 dias sem confirmação (política da API). Sem policy: só service_role.';
comment on table public.google_avaliacoes is
  'Cache das avaliações do Google. No máximo 25 dias sem confirmação (política da API). Sem policy: só service_role.';

-- Limpeza: o teto de 30 dias da política vale mesmo se a sincronização falhar
-- por semanas. 25 dias deixa folga.
create or replace function public.limpar_avaliacoes_google()
returns void
language sql
security definer
set search_path to 'public'
as $$
  delete from public.google_avaliacoes where sincronizado_em < now() - interval '25 days';
  delete from public.google_locais where sincronizado_em < now() - interval '25 days';
$$;

revoke execute on function public.limpar_avaliacoes_google() from public, anon, authenticated;

create or replace function public.disparar_sincronizacao_avaliacoes()
returns void
language plpgsql
security definer
set search_path to 'public', 'extensions', 'net'
as $$
declare
  v_url     text;
  v_segredo text;
begin
  select value->>'url' into v_url from public.site_settings where key = 'cron';
  select access_token into v_segredo from public.integration_tokens where provider = 'cron';

  if v_url is null or v_url = '' or v_segredo is null then
    return;
  end if;

  perform net.http_post(
    url     := rtrim(v_url, '/') || '/api/cron/avaliacoes',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_segredo),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end $$;

revoke execute on function public.disparar_sincronizacao_avaliacoes() from public, anon, authenticated;

-- Todo dia, 09h40 UTC (06h40 em Brasília): limpa o que venceu e pede a
-- sincronização. Avaliação nova aparece na loja no dia seguinte, no máximo.
select cron.schedule(
  'sincronizar-avaliacoes-google',
  '40 9 * * *',
  $$select public.limpar_avaliacoes_google(); select public.disparar_sincronizacao_avaliacoes();$$
);
