-- 0089: redes sociais, banco de ideias do Social Media.
--
-- O QUE É
--
-- O lugar onde quem cuida das redes guarda o que quer postar: uma frase, uma
-- nota, o formato, as redes e, se tiver, o dia pretendido. A ideia anda por
-- quatro estados (ideia, produzindo, agendada, publicada) ou é descartada.
--
-- De onde vem: de quem escreve (manual), do que rendeu acima do normal
-- ("fazer de novo", com a publicação de referência), de uma pergunta que
-- apareceu nos comentários, de uma data que vem aí, ou do conector do Claude.
--
-- A IDEIA ACOMPANHA O POST SOZINHA
--
-- "Virar post" abre o compositor com a ideia ao lado, e o rascunho que nascer
-- dali fica ligado a ela (`post_id`). Daí em diante o estado da ideia segue o
-- do post por gatilho: agendado vira "agendada", publicado vira "publicada",
-- cancelado ou com erro volta a "produzindo". Ideia descartada não é mexida.
--
-- COMENTÁRIO NÃO ENTRA AQUI
--
-- Uma pergunta dos comentários vira ideia pelo texto que a PESSOA do painel
-- escreve (a tela sugere o começo), sem o nome de quem comentou. O comentário
-- em si continua sendo apagado em 90 dias (0085); a ideia é texto da casa.
--
-- Escrita só pela chave de serviço, pelo núcleo (`src/lib/redes/ideias.ts`).
-- Quem tem a área `redes` lê.

create table public.redes_ideias (
  id           uuid primary key default gen_random_uuid(),
  titulo       text not null check (char_length(titulo) between 2 and 160),
  notas        text check (char_length(notas) <= 4000),
  formato      text check (formato in ('post', 'carrossel', 'video_curto', 'story', 'video', 'texto')),
  redes        text[] not null default '{}' check (redes <@ array['instagram', 'facebook', 'youtube', 'threads', 'tiktok', 'pinterest', 'linkedin', 'x']::text[]),
  -- O dia pretendido, sem hora. Nulo: sem data ainda.
  quando       date,
  estado       text not null default 'ideia' check (estado in ('ideia', 'produzindo', 'agendada', 'publicada', 'descartada')),
  origem       text not null default 'manual' check (origem in ('manual', 'em_alta', 'comentario', 'data', 'conector')),
  -- A publicação que inspirou ("fazer de novo"). Some se a publicação sair do banco.
  publicacao_id uuid references public.redes_publicacoes(id) on delete set null,
  post_id      uuid references public.redes_posts(id) on delete set null,
  criada_por   uuid references public.profiles(id) on delete set null,
  criada_em    timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index redes_ideias_estado on public.redes_ideias (estado, quando);
create index redes_ideias_post on public.redes_ideias (post_id) where post_id is not null;

comment on table public.redes_ideias is
  'Banco de ideias do Social Media. O estado segue o post ligado (gatilho em redes_posts). Escrita só pela chave de serviço.';

alter table public.redes_ideias enable row level security;

create policy redes_ideias_select on public.redes_ideias
  for select to authenticated using ((select public.tem_acesso('redes')));

revoke all on public.redes_ideias from anon;

-- O estado da ideia acompanha o do post ligado a ela.
create or replace function public.redes_ideia_segue_o_post()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    update public.redes_ideias
       set estado = case
             when new.status in ('agendado', 'publicando') then 'agendada'
             when new.status in ('publicado', 'parcial') then 'publicada'
             else 'produzindo'
           end,
           atualizado_em = now()
     where post_id = new.id and estado <> 'descartada';
  end if;
  return new;
end $$;

revoke execute on function public.redes_ideia_segue_o_post() from public, anon, authenticated;

create trigger redes_ideia_segue_o_post
  after update of status on public.redes_posts
  for each row execute function public.redes_ideia_segue_o_post();
