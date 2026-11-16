-- 0086: redes sociais, automações. Resposta pronta a comentário, por palavra.
--
-- O QUE É
--
-- Uma regra diz: "quando alguém comentar tal palavra nesta conta (ou só neste
-- post), responda embaixo com este texto". A resposta sai em público, no nome
-- da JK. É a única automação que a API deixa fazer hoje sem a análise do
-- aplicativo pela Meta: mandar direct para quem comentou pede essa análise.
--
-- AS TRAVAS, PORQUE ISTO FALA COM CLIENTE SEM NINGUÉM OLHAR
--
-- 1. Toda regra nasce DESLIGADA. Ligar é de administrador, dono e GM, e fica
--    gravado quem ligou e quando. A tela mostra o texto exato antes.
-- 2. A regra só responde comentário escrito DEPOIS de ela ser ligada: ligar
--    não dispara resposta para trás.
-- 3. Um comentário recebe no máximo UMA resposta automática, de uma regra só:
--    `redes_automacoes_envios` tem o comentário como chave única.
-- 4. A regra ESPERA antes de responder (meia hora por padrão), e não responde
--    se a conta já respondeu naquele fio. A JK usa o ManyChat: a espera dá a
--    ele a vez, e a leitura seguinte vê a resposta dele e desiste. Isso não
--    cobre resposta do ManyChat por direct, que o painel não enxerga: por isso
--    a tela avisa para não ligar aqui uma palavra que o ManyChat já atende.
-- 5. Há teto por hora, para um post que viraliza não virar centenas de
--    respostas iguais.
--
-- Escrita é só da chave de serviço, pelo núcleo (`src/lib/redes/automacoes.ts`).
-- Quem tem a área `redes` lê.

create table public.redes_automacoes (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null check (char_length(nome) between 2 and 80),
  conta_id       uuid not null references public.redes_contas(id) on delete cascade,
  -- Só neste post. Nulo: em qualquer post da conta.
  publicacao_id  uuid references public.redes_publicacoes(id) on delete cascade,
  -- As palavras que disparam. Basta uma aparecer no comentário, como palavra inteira, sem ligar para acento nem maiúscula.
  palavras       text[] not null check (cardinality(palavras) between 1 and 12),
  -- O texto EXATO da resposta pública.
  resposta       text not null check (char_length(resposta) between 2 and 500),
  -- Quantos minutos o comentário precisa ter antes de a regra responder. É a vez das outras ferramentas.
  espera_min     integer not null default 30 check (espera_min between 10 and 1440),
  limite_por_hora integer not null default 20 check (limite_por_hora between 1 and 60),
  ativa          boolean not null default false,
  ativada_por    uuid references public.profiles(id) on delete set null,
  ativada_em     timestamptz,
  criada_por     uuid references public.profiles(id) on delete set null,
  criada_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  -- Regra ligada tem data de ligação: é dela que sai "só comentário novo".
  constraint redes_automacoes_ligada_com_data check (not ativa or ativada_em is not null)
);

create index redes_automacoes_ativas on public.redes_automacoes (conta_id) where ativa;

comment on table public.redes_automacoes is
  'Resposta automática a comentário, por palavra. Nasce desligada; ligar é de administrador. Escrita só pela chave de serviço.';

alter table public.redes_automacoes enable row level security;

create policy redes_automacoes_select on public.redes_automacoes
  for select to authenticated using ((select public.tem_acesso('redes')));

revoke all on public.redes_automacoes from anon;

-- Cada resposta que uma regra deu (ou tentou dar). O comentário é chave única:
-- é o que garante uma resposta automática por comentário, mesmo com duas
-- rodadas ao mesmo tempo ou duas regras para a mesma palavra.
create table public.redes_automacoes_envios (
  comentario_id uuid primary key references public.redes_comentarios(id) on delete cascade,
  automacao_id  uuid not null references public.redes_automacoes(id) on delete cascade,
  estado        text not null check (estado in ('enviando', 'respondido', 'falhou')),
  erro          text check (char_length(erro) <= 300),
  criado_em     timestamptz not null default now()
);

create index redes_automacoes_envios_regra on public.redes_automacoes_envios (automacao_id, criado_em desc);

alter table public.redes_automacoes_envios enable row level security;

create policy redes_automacoes_envios_select on public.redes_automacoes_envios
  for select to authenticated using ((select public.tem_acesso('redes')));

revoke all on public.redes_automacoes_envios from anon;
