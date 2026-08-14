-- Pauta como objeto de primeira classe.
--
-- POR QUE ESTA TABELA EXISTE
--
-- Hoje o editor começa em "Novo guia", com a tela em branco. Decidir sobre o
-- que escrever, conferir se já não existe página disputando a mesma intenção e
-- montar a estrutura são três trabalhos que acontecem antes da primeira linha,
-- e nenhum deles fica registrado em lugar nenhum. É o que trava a frequência de
-- publicação, não a escrita.
--
-- A pauta guarda essa decisão: qual consulta a página vai ganhar, qual a
-- intenção, de que cluster faz parte e o que o Search Console dizia no dia em
-- que a decisão foi tomada. Quando vira rascunho, o conteúdo nasce preenchido.
--
-- É o card "MODELO DE CARD PARA CONTEÚDO" e o "MAPA DE CONTEÚDOS" do Trello
-- virando tabela, sem obrigar ninguém a manter as duas coisas em dia.
--
-- SOBRE O BASELINE GRAVADO
--
-- `impressions`, `clicks`, `position` e `ctr` são uma FOTO do momento, não um
-- espelho vivo de `analytics_snapshots`. É de propósito: sem a foto não dá para
-- responder "esta página melhorou o quê", que é a pergunta do painel mensal.

create type public.briefing_status as enum ('ideia', 'pronta', 'escrevendo', 'publicada', 'descartada');

create table public.briefings (
  id            uuid primary key default gen_random_uuid(),

  -- A consulta que esta página quer ganhar. É a chave do trabalho inteiro:
  -- sem ela não dá para medir nada nem detectar canibalização.
  target_query  text not null,

  title         text,
  search_intent text,
  cluster       text,

  -- A dúvida principal e o objetivo da página, do jeito que o card do Trello
  -- pede. Texto livre porque é briefing, não formulário.
  notes         text,

  -- Qual modelo usar quando virar rascunho (pilar, artigo, comparativo, local).
  modelo        text,

  status        public.briefing_status not null default 'ideia',

  -- De onde a pauta veio: da fila do Search Console ou da cabeça de alguém.
  origem        text not null default 'manual' check (origem in ('gsc', 'manual')),

  -- Foto do Search Console no dia em que a pauta nasceu.
  impressions   numeric,
  clicks        numeric,
  position      numeric,
  ctr           numeric,

  -- Preenchido quando a pauta vira rascunho. `set null` porque apagar o
  -- conteúdo não pode apagar a decisão editorial que levou a ele.
  content_id    uuid references public.contents(id) on delete set null,

  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Uma pauta por consulta. É a regra que o Trello mais repete, "nunca duas
-- páginas disputando a mesma intenção", aplicada no ponto em que ainda é barato
-- corrigir: antes de existir texto.
create unique index briefings_consulta_unica on public.briefings (lower(target_query));

create index briefings_status_idx on public.briefings (status, created_at desc);
create index briefings_content_idx on public.briefings (content_id) where content_id is not null;

create trigger briefings_set_updated_at before update on public.briefings
  for each row execute function public.set_updated_at();

alter table public.briefings enable row level security;

-- Fila interna de trabalho. O site público não lê daqui.
create policy briefings_staff_read on public.briefings
  for select to authenticated using (public.is_staff());
create policy briefings_staff_write on public.briefings
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
