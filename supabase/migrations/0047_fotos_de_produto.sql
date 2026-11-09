-- Fotos novas dos produtos da loja: quem faz, quem aprova e o que já foi para a Tray.
--
-- POR QUE
--
-- A JK vai refazer as fotos do catálogo com IA (Magnific), pelo Claude no
-- claude.ai e pelo painel. São mais de mil produtos e mais de uma pessoa
-- trabalhando, então o "qual foi feito e qual falta" precisa morar no banco,
-- produto a produto, e não na memória de quem estava gerando.
--
-- COMO
--
-- `produto_fotos` guarda cada imagem nova, com a decisão sobre ela:
--   aguardando  -> chegou, ninguém olhou ainda
--   aprovada    -> pode ir para a loja
--   recusada    -> refazer (o motivo fica em `nota`, e o Claude lê na próxima)
--   na_loja     -> a loja já mostra (a sincronização percebe sozinha)
--   substituida -> outra foto do mesmo tipo foi aprovada depois
--
-- `produto_foto_fila` é o estado do PRODUTO, uma linha por produto que já
-- entrou no trabalho (sem linha = falta). Quem mantém o estado é o gatilho
-- abaixo, e não cada porta de entrada: são três portas (painel, conector e
-- sincronização da Tray) e o estado tem que sair igual de todas.
-- `dispensada` é a única decisão manual: produto que não precisa de foto nova.
--
-- A reserva (`reservado_ate`) existe para duas pessoas gerando ao mesmo tempo
-- pelo claude.ai não pegarem o mesmo produto. Vence sozinha, e cai quando a
-- foto chega.
--
-- "Na loja" se confere pela imagem principal que a busca pública da Tray
-- devolve: a foto exportada guarda a imagem que a loja mostrava naquele
-- momento, e quando a sincronização traz outra, a foto nova entrou.
--
-- `foto_padroes` é o padrão escrito de cada categoria (ou o geral, com
-- category_id nulo), que o Claude lê antes de gerar. Fica no banco para a
-- equipe ajustar o padrão sem deploy.
--
-- Tudo só para a equipe. Nada disso aparece no site.

create table public.produto_fotos (
  id                         uuid primary key default gen_random_uuid(),
  product_id                 uuid not null references public.products(id) on delete cascade,
  tipo                       text not null default 'principal'
                             check (tipo in ('principal', 'ambientada', 'detalhe')),
  status                     text not null default 'aguardando'
                             check (status in ('aguardando', 'aprovada', 'recusada', 'na_loja', 'substituida')),
  url                        text not null check (url ~ '^https://'),
  storage_path               text not null,
  largura                    int,
  altura                     int,
  bytes                      int,
  nota                       text check (char_length(nota) <= 500),
  como_foi_feita             text check (char_length(como_foi_feita) <= 2000),
  origem                     text not null default 'painel' check (origem in ('painel', 'conector')),
  enviada_por                uuid references public.profiles(id) on delete set null,
  revisada_por               uuid references public.profiles(id) on delete set null,
  revisada_em                timestamptz,
  exportada_em               timestamptz,
  imagem_da_loja_ao_exportar text,
  na_loja_em                 timestamptz,
  criada_em                  timestamptz not null default now()
);

create index produto_fotos_produto_idx on public.produto_fotos (product_id, criada_em desc);
create index produto_fotos_pendentes_idx on public.produto_fotos (status)
  where status in ('aguardando', 'aprovada');
create index produto_fotos_enviada_por_idx on public.produto_fotos (enviada_por);
create index produto_fotos_revisada_por_idx on public.produto_fotos (revisada_por);

create table public.produto_foto_fila (
  product_id     uuid primary key references public.products(id) on delete cascade,
  status         text not null default 'falta'
                 check (status in ('falta', 'aguardando', 'refazer', 'aprovada', 'na_loja', 'dispensada')),
  nota           text check (char_length(nota) <= 500),
  reservado_por  uuid references public.profiles(id) on delete set null,
  reservado_ate  timestamptz,
  atualizado_por uuid references public.profiles(id) on delete set null,
  atualizado_em  timestamptz not null default now()
);

create index produto_foto_fila_status_idx on public.produto_foto_fila (status);
create index produto_foto_fila_reservado_por_idx on public.produto_foto_fila (reservado_por);
create index produto_foto_fila_atualizado_por_idx on public.produto_foto_fila (atualizado_por);

create table public.foto_padroes (
  id             uuid primary key default gen_random_uuid(),
  category_id    uuid unique references public.categories(id) on delete cascade,
  instrucoes     text not null check (char_length(instrucoes) between 10 and 4000),
  referencia_url text check (referencia_url is null or referencia_url ~ '^https://'),
  atualizado_por uuid references public.profiles(id) on delete set null,
  atualizado_em  timestamptz not null default now()
);

-- Um padrão geral só (category_id nulo não colide no unique comum).
create unique index foto_padroes_um_geral on public.foto_padroes ((true)) where category_id is null;
create index foto_padroes_atualizado_por_idx on public.foto_padroes (atualizado_por);

-- ------------------------------------------------------------------ estado do produto

/**
 * O estado que as fotos dizem, na ordem de quem precisa agir primeiro:
 * tem foto esperando olhar > tem foto pronta para a loja > já está na loja >
 * só sobrou recusa. Nulo quando não há foto (a fila guarda falta ou dispensada).
 */
create or replace function public.foto_status_do_produto(p uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when bool_or(f.status = 'aguardando') then 'aguardando'
    when bool_or(f.status = 'aprovada') then 'aprovada'
    when bool_or(f.status = 'na_loja') then 'na_loja'
    when bool_or(f.status = 'recusada') then 'refazer'
  end
  from public.produto_fotos f
  where f.product_id = p and f.status <> 'substituida'
$$;

create or replace function public.produto_fotos_atualiza_fila()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  novo text;
  motivo text;
begin
  novo := public.foto_status_do_produto(new.product_id);
  if novo is null then
    return new;
  end if;

  if novo = 'refazer' then
    select f.nota into motivo
    from public.produto_fotos f
    where f.product_id = new.product_id and f.status = 'recusada'
    order by coalesce(f.revisada_em, f.criada_em) desc
    limit 1;
  end if;

  insert into public.produto_foto_fila as q (product_id, status, nota, atualizado_em)
  values (new.product_id, novo, motivo, now())
  on conflict (product_id) do update
    set status = excluded.status,
        nota = excluded.nota,
        atualizado_em = now(),
        -- A foto chegou: a reserva de quem estava gerando acabou.
        reservado_por = null,
        reservado_ate = null;

  return new;
end
$$;

create trigger produto_fotos_fila
  after insert or update of status on public.produto_fotos
  for each row execute function public.produto_fotos_atualiza_fila();

/**
 * Chamada pela sincronização da Tray: foto exportada cuja imagem principal da
 * loja mudou desde a exportação entrou na loja. Devolve quantas.
 */
create or replace function public.conferir_fotos_na_loja()
returns int
language sql
set search_path = ''
as $$
  with mudaram as (
    update public.produto_fotos f
       set status = 'na_loja', na_loja_em = now()
      from public.products p
     where f.product_id = p.id
       and f.status = 'aprovada'
       and f.exportada_em is not null
       and p.main_image_url is distinct from f.imagem_da_loja_ao_exportar
    returning 1
  )
  select count(*)::int from mudaram
$$;

revoke execute on function public.conferir_fotos_na_loja() from public, anon, authenticated;

-- ------------------------------------------------------------------ RLS

alter table public.produto_fotos enable row level security;
alter table public.produto_foto_fila enable row level security;
alter table public.foto_padroes enable row level security;

create policy produto_fotos_staff_select on public.produto_fotos
  for select to authenticated using ((select public.is_staff()));
create policy produto_fotos_staff_insert on public.produto_fotos
  for insert to authenticated with check ((select public.is_staff()));
create policy produto_fotos_staff_update on public.produto_fotos
  for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
-- Sem delete: foto errada se recusa, e o histórico fica.

create policy produto_foto_fila_staff_select on public.produto_foto_fila
  for select to authenticated using ((select public.is_staff()));
create policy produto_foto_fila_staff_insert on public.produto_foto_fila
  for insert to authenticated with check ((select public.is_staff()));
create policy produto_foto_fila_staff_update on public.produto_foto_fila
  for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));

create policy foto_padroes_staff_select on public.foto_padroes
  for select to authenticated using ((select public.is_staff()));
create policy foto_padroes_staff_insert on public.foto_padroes
  for insert to authenticated with check ((select public.is_staff()));
create policy foto_padroes_staff_update on public.foto_padroes
  for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));

comment on table public.produto_fotos is
  'Fotos novas dos produtos (IA ou envio manual) e a decisão sobre cada uma. Só equipe.';
comment on table public.produto_foto_fila is
  'Estado de foto de cada produto. Sem linha = falta. Mantido pelo gatilho de produto_fotos, exceto dispensada.';
comment on table public.foto_padroes is
  'Padrão escrito de foto por categoria (category_id nulo = geral), lido pelo Claude antes de gerar.';

-- ------------------------------------------------------------------ padrão inicial

insert into public.foto_padroes (category_id, instrucoes) values (null,
'FOTO PRINCIPAL (posição 1 na loja)
- Parta SEMPRE da foto atual do produto. A peça não muda: mesma largura, mesmas pedras no mesmo lugar, mesma cor de metal, mesmo acabamento (polido, fosco, diamantado, trabalhado).
- Fundo claro e limpo, branco quente quase marfim (perto de #F7F4EE), sem textura e sem objetos.
- Peça centralizada, ocupando cerca de 70% do quadro, luz de estúdio difusa e sombra suave embaixo.
- Quadrada, 2000 x 2000 px.
- Sem texto, sem logo, sem marca d''água.

FOTO AMBIENTADA (posição 2, opcional)
- A mesma peça em cena: mão, caixinha de joia ou superfície clara de linho ou mármore, luz natural.
- Só vale se a peça continuar idêntica à foto real.

RECUSE E REFAÇA SE
- a pedra mudou de tamanho, de cor ou de lugar, ou apareceu pedra que não existe;
- a largura parece outra, a peça entortou ou o reflexo ficou estranho;
- a cor do metal mudou (prata virou ouro branco, amarelo virou rosé).');
