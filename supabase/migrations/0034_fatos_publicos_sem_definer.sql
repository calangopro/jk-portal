-- Refaz a janela pública da base de fatos sem `security definer`.
--
-- O QUE ESTAVA ERRADO
--
-- A view de 0032 rodava com os direitos do dono, e o advisor do Supabase marca
-- isso como ERRO, com razão: uma view assim contorna a RLS inteira, e a única
-- coisa que separa o público do privado passa a ser o `where` que alguém
-- escreveu. Funciona, e é frágil por natureza.
--
-- O JEITO CERTO
--
-- Três travas independentes, e nenhuma delas sozinha basta:
--
--   1. RLS: `anon` só enxerga fato APROVADO e com assunto preenchido. Rascunho
--      de evidência e lembrete de perguntar à JK continuam invisíveis.
--   2. Permissão por COLUNA: `anon` nem pode pedir `detail`, `responsible`,
--      `file_url` ou `created_by`. É o contexto interno de quem escreve, e ele
--      não sai do painel nem por engano.
--   3. A view com `security_invoker = true`, que agora herda as duas de cima em
--      vez de contorná-las.
--
-- Assim o pior caso de um erro futuro no `where` da view é mostrar um fato
-- aprovado a mais, e não vazar a base inteira.

-- 1. Leitura pública, só do que está aprovado.
create policy facts_publico_le_aprovado on public.facts
  for select to anon
  using (status = 'aprovado' and subject is not null);

-- 2. E só das colunas que a página imprime. `revoke` primeiro porque o Supabase
-- concede `select` na tabela inteira por padrão.
revoke select on public.facts from anon;
grant select (subject, attribute, claim, module, source_url, captured_at)
  on public.facts to anon;

-- 3. A view volta a respeitar quem consulta.
drop view public.fatos_publicos;

create view public.fatos_publicos
with (security_invoker = true)
as
select
  f.subject,
  f.attribute,
  f.claim,
  f.module,
  f.source_url,
  f.captured_at
from public.facts f
where f.status = 'aprovado'
  and f.subject is not null;

grant select on public.fatos_publicos to anon, authenticated;

comment on view public.fatos_publicos is
  'Janela pública da base de fatos. A view respeita a RLS de quem consulta, e a policy de anon já limita a fato aprovado com assunto. O contexto interno de cada fato não é nem selecionável por anon.';
