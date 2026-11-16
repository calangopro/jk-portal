-- 0085: redes sociais, comentários. Ler num lugar só e responder em nome da JK.
--
-- COMO CHEGAM
--
-- Pela rotina de leitura, por consulta: a cada rodada ela olha as publicações
-- recentes cujo total de comentários mudou e busca os comentários novos. Aviso
-- em tempo real (webhook) pede a análise do aplicativo pela Meta, e não é por
-- ele que se começa.
--
-- O QUE SE GUARDA, E POR QUANTO TEMPO
--
-- Comentário é dado de terceiro. Fica o mínimo para responder: o texto, o nome
-- público de quem escreveu (o @, que já é público na rede) e a data. Nada de
-- foto, de perfil nem de outro dado da pessoa. E some sozinho: comentário com
-- mais de 90 dias é apagado pela própria rotina (`redes_limpar_comentarios`).
--
-- O ESTADO
--
-- `novo` até alguém responder (pelo painel, pelo aplicativo ou por outra
-- ferramenta: a resposta da conta aparece na leitura seguinte e fecha o
-- comentário sozinha), até alguém marcar que não precisa de resposta (`visto`)
-- ou ocultar (`oculto`). A resposta dada pelo painel grava QUEM respondeu.
--
-- Escrita é só da chave de serviço, pelo núcleo (`src/lib/redes/comentarios.ts`).
-- Quem tem a área `redes` lê.

create table public.redes_comentarios (
  id                  uuid primary key default gen_random_uuid(),
  conta_id            uuid not null references public.redes_contas(id) on delete cascade,
  publicacao_id       uuid not null references public.redes_publicacoes(id) on delete cascade,
  rede                text not null,
  id_na_rede          text not null check (char_length(id_na_rede) <= 160),
  -- Resposta: o id do comentário de cima. Comentário de primeiro nível: nulo.
  pai_id_na_rede      text check (char_length(pai_id_na_rede) <= 160),
  -- O nome público de quem escreveu (o @). Pode vir vazio: a rede nem sempre informa.
  autor               text not null default '' check (char_length(autor) <= 120),
  autor_id            text check (char_length(autor_id) <= 80),
  texto               text not null default '' check (char_length(texto) <= 3000),
  quando              timestamptz,
  -- Escrito pela própria conta da JK (resposta da casa, por qualquer ferramenta).
  nosso               boolean not null default false,
  curtidas            integer,
  estado              text not null default 'novo' check (estado in ('novo', 'respondido', 'visto', 'oculto')),
  -- Preenchidos quando a resposta saiu PELO PAINEL.
  respondido_por      uuid references public.profiles(id) on delete set null,
  respondido_em       timestamptz,
  resposta_id_na_rede text check (char_length(resposta_id_na_rede) <= 160),
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now(),
  unique (conta_id, id_na_rede)
);

-- A fila da tela: o que é de terceiro e ainda está sem resposta, do mais novo para o mais antigo.
create index redes_comentarios_fila on public.redes_comentarios (quando desc) where estado = 'novo' and not nosso;
create index redes_comentarios_fio on public.redes_comentarios (publicacao_id, pai_id_na_rede);
create index redes_comentarios_idade on public.redes_comentarios (quando);

comment on table public.redes_comentarios is
  'Comentários das publicações das redes, lidos pela rotina. Dado de terceiro: só o texto, o nome público e a data, e some com 90 dias. Escrita só pela chave de serviço.';

alter table public.redes_comentarios enable row level security;

create policy redes_comentarios_select on public.redes_comentarios
  for select to authenticated using ((select public.tem_acesso('redes')));

revoke all on public.redes_comentarios from anon;

-- Para a rotina saber quais publicações têm comentário novo sem perguntar por todas:
-- quantos comentários a publicação tinha na última vez em que foram lidos, e quando.
alter table public.redes_publicacoes
  add column comentarios_vistos integer,
  add column comentarios_lidos_em timestamptz;

-- Quantos comentários esperam resposta, para o número do menu. Roda com os
-- direitos de quem chama: sem a área, a RLS devolve zero.
create or replace function public.redes_comentarios_esperando()
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*)::integer from public.redes_comentarios where estado = 'novo' and not nosso
$$;

revoke execute on function public.redes_comentarios_esperando() from public, anon;
grant execute on function public.redes_comentarios_esperando() to authenticated;

-- Fecha os comentários de um fio quando a conta respondeu DEPOIS deles, por
-- qualquer caminho (painel, aplicativo, outra ferramenta). A rotina chama
-- depois de gravar o que leu. Só a chave de serviço executa.
create or replace function public.redes_fechar_respondidos(p_conta uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fechados integer;
begin
  update public.redes_comentarios c
     set estado = 'respondido', atualizado_em = now()
   where c.conta_id = p_conta
     and c.estado = 'novo'
     and not c.nosso
     and exists (
       select 1 from public.redes_comentarios r
        where r.conta_id = c.conta_id
          and r.publicacao_id = c.publicacao_id
          and r.nosso
          -- A resposta da casa está no mesmo fio: embaixo deste comentário, ou embaixo do mesmo comentário de cima.
          and coalesce(r.pai_id_na_rede, r.id_na_rede) = coalesce(c.pai_id_na_rede, c.id_na_rede)
          and r.pai_id_na_rede is not null
          and coalesce(r.quando, r.criado_em) >= coalesce(c.quando, c.criado_em)
     );
  get diagnostics v_fechados = row_count;
  return v_fechados;
end $$;

revoke execute on function public.redes_fechar_respondidos(uuid) from public, anon, authenticated;

-- Comentário não é arquivo: com mais de 90 dias, sai. A rotina chama a cada rodada.
create or replace function public.redes_limpar_comentarios()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_apagados integer;
begin
  delete from public.redes_comentarios where coalesce(quando, criado_em) < now() - interval '90 days';
  get diagnostics v_apagados = row_count;
  return v_apagados;
end $$;

revoke execute on function public.redes_limpar_comentarios() from public, anon, authenticated;
