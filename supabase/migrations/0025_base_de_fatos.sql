-- Base de fatos aprovados, e a ligação dela com as fontes do conteúdo.
--
-- POR QUE ESTA TABELA EXISTE
--
-- A regra fundadora do projeto diz que nenhuma afirmação institucional vai ao
-- ar sem fonte aprovada, e a publicação já trava sem pelo menos uma linha em
-- `sources`. Só que `sources` é POR CONTEÚDO: o mesmo fato ("a JK tem fábrica
-- própria") precisava ser redigitado, com a mesma URL e a mesma data, em cada
-- guia novo. Na prática ninguém faz isso, e foi por isso que a tabela ficou
-- zerada enquanto a regra seguia no papel.
--
-- `facts` é a camada que faltava: o fato é escrito UMA vez, com origem, data,
-- responsável e status, e o editor apenas escolhe. Ao inserir o fato no texto,
-- a linha correspondente de `sources` nasce sozinha, apontando para cá.
--
-- É o card "BASE MESTRA DE CONHECIMENTO JK" do Trello virando tabela.
--
-- MÓDULO E STATUS
--
-- Os módulos são os do card. O status é o ciclo de vida da evidência, também do
-- card: `extraido` (saiu de algum lugar), `validar` (esperando a JK confirmar),
-- `aprovado` (pode ir ao ar) e `desatualizado` (não usar mais, porém preservado
-- porque conteúdo publicado ainda aponta para ele).
--
-- Só fato `aprovado` pode ser inserido em conteúdo. A trava está na aplicação,
-- e o índice parcial abaixo existe para essa consulta ser barata.

create type public.fact_status as enum ('extraido', 'validar', 'aprovado', 'desatualizado');

create table public.facts (
  id           uuid primary key default gen_random_uuid(),

  -- A afirmação escrita para ser CITADA, não para ser resumida depois. Frase
  -- que se sustenta fora do contexto, que é exatamente o que a IA extrai.
  claim        text not null,

  -- Contexto que o editor precisa e o leitor não vê: ressalva, recorte,
  -- o que a afirmação NÃO diz.
  detail       text,

  -- Módulos do card BASE MESTRA. Check em vez de enum porque a lista tende a
  -- crescer, e acrescentar valor a enum trava a tabela.
  module       text not null default 'empresa'
               check (module in (
                 'empresa', 'produtos', 'materiais', 'fabricacao',
                 'lojas', 'garantias', 'atendimento', 'vocabulario'
               )),

  source_url   text,
  file_url     text,
  captured_at  date,
  responsible  text,
  status       public.fact_status not null default 'extraido',

  -- Fato sem origem nenhuma é opinião. Aprovar exige pelo menos um caminho de
  -- volta: link, arquivo ou a descrição de onde veio.
  constraint facts_aprovado_tem_origem check (
    status <> 'aprovado'
    or source_url is not null
    or file_url is not null
    or detail is not null
  ),

  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index facts_module_idx on public.facts (module, status);
-- Índice parcial: a consulta quente é "fatos que posso inserir agora".
create index facts_aprovados_idx on public.facts (updated_at desc) where status = 'aprovado';

create trigger facts_set_updated_at before update on public.facts
  for each row execute function public.set_updated_at();

alter table public.facts enable row level security;

-- Base interna de conhecimento. O site público não lê daqui, lê do conteúdo já
-- escrito, então não existe policy para `anon`.
create policy facts_staff_read on public.facts
  for select to authenticated using (public.is_staff());
create policy facts_staff_write on public.facts
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- LIGAÇÃO COM `sources`
--
-- A fonte continua sendo por conteúdo (é ela que a trava de publicação conta).
-- O que muda é que ela passa a poder apontar para o fato de origem, e assim
-- dá para responder duas perguntas que hoje ficam sem resposta: "quais guias
-- dependem deste fato" e "este fato caducou, o que preciso revisar".
alter table public.sources
  add column fact_id uuid references public.facts(id) on delete set null;

-- O mesmo fato não entra duas vezes no mesmo conteúdo. Índice parcial porque a
-- imensa maioria das fontes é avulsa, com `fact_id` nulo, e nulo não colide.
create unique index sources_conteudo_fato_unico
  on public.sources (content_id, fact_id)
  where fact_id is not null;

create index sources_fact_idx on public.sources (fact_id) where fact_id is not null;

-- SEMENTE
--
-- Os fatos que hoje estão escritos à mão em `src/lib/content/institucional.ts`,
-- com a mesma origem e a mesma data de conferência que já constam no arquivo.
-- A base não pode nascer vazia: tabela vazia é feature que ninguém usa, e este
-- projeto já tem exemplos demais disso.
insert into public.facts (claim, detail, module, source_url, captured_at, responsible, status) values
  (
    'A JK Alianças foi fundada em 8 de novembro de 2003.',
    'Data declarada pela própria marca na página Sobre Nós. Serve para calcular anos de mercado, nunca para afirmar "a mais tradicional" ou coisa parecida.',
    'empresa',
    'https://www.jkaliancas.com.br/sobre-nos',
    '2026-08-12',
    'equipe do portal',
    'aprovado'
  ),
  (
    'A JK Alianças tem 10 lojas físicas.',
    'Contagem declarada pela marca. Tamboré é quiosque novo, por isso aparece com poucas avaliações. Reconferir sempre que abrir ou fechar unidade.',
    'lojas',
    'https://www.jkaliancas.com.br/sobre-nos',
    '2026-08-12',
    'equipe do portal',
    'aprovado'
  ),
  (
    'As alianças da JK Alianças são produzidas e personalizadas em fábrica própria, sem depender de terceiros para ajuste e gravação.',
    'Afirmação da própria marca. É o diferencial mais forte da JK e pode ser citado, desde que atribuído à marca.',
    'fabricacao',
    'https://www.jkaliancas.com.br/sobre-nos',
    '2026-08-12',
    'equipe do portal',
    'aprovado'
  ),
  (
    'A JK Alianças garante por tempo indeterminado o teor dos materiais usados na peça.',
    'Garantia declarada pela marca. Não confundir com garantia contra desgaste, arranhão ou perda, que são outra coisa e ainda precisam ser confirmadas com a JK.',
    'garantias',
    'https://www.jkaliancas.com.br/sobre-nos',
    '2026-08-12',
    'equipe do portal',
    'aprovado'
  ),
  (
    'As lojas da JK Alianças oferecem aro de prova e ajuste no dedo no atendimento presencial.',
    'Base do convite "prove no dedo" que o portal repete. Vale para as unidades físicas, não para a compra online.',
    'atendimento',
    'https://www.jkaliancas.com.br/lojas-fisicas',
    '2026-08-12',
    'equipe do portal',
    'aprovado'
  ),
  (
    'No padrão brasileiro de numeração, a circunferência interna do anel em milímetros é o número do aro somado a 40.',
    'Convenção de numeração usada no Brasil, não uma afirmação institucional da JK. É a fórmula implementada em src/lib/medidor/aros.ts e a que sustenta o medidor e a tabela de aros.',
    'produtos',
    null,
    '2026-08-12',
    'equipe do portal',
    'aprovado'
  );
