-- 0036 — Resposta da equipe no comentário
--
-- A coluna `parent_id` existe desde 0006 e nunca foi usada: comentário era uma
-- lista plana, e a dúvida do cliente ficava sem resposta na página. Quem
-- pergunta "essa de 3 mm marca o dedo?" e não recebe resposta leva a dúvida
-- para outro site.
--
-- Responder é da EQUIPE, não do público. Duas travas, e as duas no banco:
--
--   1. a policy pública de inserção passa a exigir `parent_id is null`. Ela
--      aceitava qualquer valor ali, então bastava uma chamada direta com a
--      chave anônima (que vai no HTML) para pendurar texto como se fosse
--      resposta da loja.
--   2. a inserção de resposta exige `is_admin()`, exige que a linha seja
--      assinada por quem está logado e exige que o pai seja um comentário de
--      primeiro nível do mesmo conteúdo. Fio de conversa com um nível só é
--      decisão de produto, e ela vive aqui para não depender da tela.

alter table public.comments
  add column author_profile_id uuid references public.profiles(id) on delete set null;

-- O site público precisa saber que a resposta é da casa para desenhar o selo,
-- mas não precisa saber QUEM respondeu. Coluna gerada resolve os dois: o
-- booleano é público e o id fica para a prestação de contas interna.
alter table public.comments
  add column is_staff_reply boolean
  generated always as (author_profile_id is not null) stored;

create index comments_parent_idx on public.comments (parent_id, created_at);

-- Conferir o pai dentro da policy de `comments` levantaria recursão de RLS na
-- própria tabela. Função de dono resolve, e devolve só um booleano.
create or replace function public.comentario_e_raiz(p_id uuid, p_content_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.comments c
    where c.id = p_id
      and c.parent_id is null
      and c.content_id = p_content_id
  );
$$;

revoke execute on function public.comentario_e_raiz(uuid, uuid) from public, anon;
grant execute on function public.comentario_e_raiz(uuid, uuid) to authenticated;

-- (1) Público envia comentário de primeiro nível, e nada mais.
drop policy comments_public_insert on public.comments;
create policy comments_public_insert on public.comments
  for insert to anon, authenticated with check (
    status = 'pending'
    and parent_id is null
    and author_profile_id is null
    and exists (
      select 1 from public.contents c
      where c.id = content_id and c.status = 'published'
    )
  );

-- (2) Resposta da equipe: só admin ativo, assinada, e sempre pendurada num
--     comentário de primeiro nível do mesmo conteúdo.
create policy comments_admin_reply on public.comments
  for insert to authenticated with check (
    public.is_admin()
    and author_profile_id = auth.uid()
    and parent_id is not null
    and public.comentario_e_raiz(parent_id, content_id)
  );

comment on column public.comments.author_profile_id is
  'Quem da equipe escreveu a resposta. Nulo em comentário de visitante.';
comment on column public.comments.is_staff_reply is
  'Derivada: a linha é resposta oficial da loja. É o que o site público lê.';
