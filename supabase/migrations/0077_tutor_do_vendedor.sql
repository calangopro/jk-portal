-- 0077: o registro do tutor do vendedor.
--
-- O tutor responde a dúvida de quem atende usando só a Biblioteca JK e o
-- catálogo. Cada pergunta deixa uma linha aqui, por três motivos:
--
-- 1. A pergunta que o tutor NÃO soube responder é a lista do que falta
--    escrever na biblioteca. É o dado mais útil que ele produz.
-- 2. O teto por pessoa por dia, para a conta do modelo de linguagem não
--    escapar.
-- 3. Saber se o time usa.
--
-- O QUE NÃO ENTRA: a imagem do print e qualquer dado do cliente. A coluna
-- `pergunta` guarda a dúvida em uma frase, e quem escreve essa frase a partir
-- do print é instruído a não copiar nome, telefone nem documento.

create table public.tutor_perguntas (
  id         bigint generated always as identity primary key,
  quem       uuid not null references public.profiles (id) on delete cascade,
  pergunta   text not null check (char_length(pergunta) between 1 and 600),
  com_imagem boolean not null default false,
  respondeu  boolean not null,
  -- As respostas da biblioteca em que o tutor se apoiou.
  usou       uuid[] not null default '{}',
  criado_em  timestamptz not null default now()
);

comment on table public.tutor_perguntas is
  'Cada pergunta feita ao tutor: a dúvida em uma frase, se ele respondeu e em quais respostas da biblioteca se apoiou. Sem imagem e sem dado de cliente.';

create index tutor_perguntas_quem_idx on public.tutor_perguntas (quem, criado_em desc);
create index tutor_perguntas_sem_resposta_idx on public.tutor_perguntas (criado_em desc) where not respondeu;

alter table public.tutor_perguntas enable row level security;

-- Cada pessoa grava e lê as próprias perguntas. Administrador, dono e GM leem todas.
create policy tutor_perguntas_insert on public.tutor_perguntas
  for insert to authenticated
  with check (quem = (select auth.uid()) and (select public.tem_acesso('time')));

create policy tutor_perguntas_select on public.tutor_perguntas
  for select to authenticated
  using (quem = (select auth.uid()) or (select public.is_admin()));

revoke all on public.tutor_perguntas from anon;
