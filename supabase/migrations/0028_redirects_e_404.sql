-- Registro de 404 e a matéria-prima da tela de redirects.
--
-- POR QUE
--
-- A tabela `redirects` existe desde a primeira migration, o middleware a serve
-- em toda requisição pública, e ela está vazia. Não havia tela nenhuma para
-- cadastrar, então o mapa de redirect que o card P0 do Trello exige antes de
-- qualquer mexida em URL simplesmente não podia ser feito pelo painel.
--
-- Faltava também o outro lado: saber QUAIS endereços as pessoas estão pedindo e
-- não existem. Sem isso, cadastrar redirect vira adivinhação. O Search Console
-- mostra isso com semanas de atraso e só para o que o Google rastreou; aqui a
-- resposta é imediata e cobre link de WhatsApp, link antigo em impresso e
-- endereço digitado errado.
--
-- CONTRA LIXO
--
-- Registrar todo 404 sem critério enche a tabela com varredura de robô
-- procurando `/wp-admin` e `/.env`. A função abaixo descarta esses padrões e
-- agrupa por caminho, então cem tentativas do mesmo endereço viram uma linha
-- com contador, não cem linhas.

create table public.not_found_hits (
  path       text primary key,
  hits       integer not null default 1,
  referrer   text,
  first_seen timestamptz not null default now(),
  last_seen  timestamptz not null default now(),
  -- Marcado quando alguém já criou o redirect ou decidiu que não vale.
  resolved   boolean not null default false
);

create index not_found_hits_fila_idx
  on public.not_found_hits (hits desc, last_seen desc)
  where not resolved;

alter table public.not_found_hits enable row level security;

-- Só a equipe lê. A escrita não passa por policy: quem grava é a função abaixo,
-- que roda como dona da tabela.
create policy not_found_hits_staff_read on public.not_found_hits
  for select to authenticated using (public.is_staff());
create policy not_found_hits_staff_write on public.not_found_hits
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

/**
 * Anota um endereço que não existe.
 *
 * Chamada pela página 404 do site, que roda sem sessão. É `security definer`
 * para poder gravar com a chave anônima, e por isso ela mesma faz a triagem:
 * fora do formato esperado, não grava nada.
 */
create or replace function public.registrar_404(p_path text, p_referrer text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_path text;
begin
  v_path := split_part(split_part(coalesce(p_path, ''), '?', 1), '#', 1);

  -- Precisa parecer um caminho de página deste site.
  if v_path = '' or v_path = '/' or left(v_path, 1) <> '/' or length(v_path) > 200 then
    return;
  end if;

  -- Varredura de robô procurando outra plataforma. Não é conteúdo perdido da
  -- JK, é ruído, e enche a fila que deveria mostrar link quebrado de verdade.
  -- Sem lookahead: a expressão regular do Postgres é POSIX, não PCRE.
  if v_path ~* '(wp-|wordpress|xmlrpc|\.env|\.git|\.php|\.asp|\.jsp|/vendor/|/cgi-bin/|phpmyadmin)' then
    return;
  end if;

  insert into public.not_found_hits (path, referrer)
  values (v_path, left(nullif(p_referrer, ''), 500))
  on conflict (path) do update
    set hits = public.not_found_hits.hits + 1,
        last_seen = now(),
        -- Guarda a origem mais recente que trouxe alguém até o endereço morto.
        referrer = coalesce(left(nullif(excluded.referrer, ''), 500), public.not_found_hits.referrer),
        -- Voltou a ser pedido depois de resolvido: volta para a fila.
        resolved = case when public.not_found_hits.resolved and public.not_found_hits.last_seen < now() - interval '7 days'
                        then false else public.not_found_hits.resolved end;
end $$;

grant execute on function public.registrar_404(text, text) to anon, authenticated;

-- `redirects` já tinha RLS de escrita para staff desde 0020. O que faltava era
-- o motivo ser obrigatório na prática: redirect sem explicação vira mistério
-- seis meses depois, quando ninguém lembra por que aquele endereço aponta para
-- outro. Fica como texto livre, só não pode ser vazio.
alter table public.redirects
  add constraint redirects_motivo_preenchido
  check (reason is null or length(trim(reason)) > 0);
