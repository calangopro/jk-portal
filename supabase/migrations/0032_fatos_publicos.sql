-- Os fatos aprovados que o site precisa mostrar.
--
-- O QUE QUEBROU
--
-- O comparador de materiais lia `facts` direto e trazia "a confirmar" em todas
-- as linhas, inclusive nas de teor, que estão aprovadas desde a semente. Motivo:
-- a RLS de `facts` só libera leitura para `authenticated` com perfil ativo, e o
-- site público lê com a chave anônima. A base é interna por natureza e continua
-- sendo, então o certo não é afrouxar a tabela.
--
-- A saída é uma janela estreita: uma view que devolve apenas o que a página
-- imprime, e apenas do que está aprovado.
--
-- `security_invoker` fica DESLIGADO aqui de propósito, ao contrário da view de
-- materiais. Ligado, a view herdaria a RLS de `facts` e continuaria vazia para o
-- anônimo, que é exatamente o problema. Desligado, ela roda com os direitos do
-- dono, e por isso o filtro de `status` mora dentro dela: é a view, e não a
-- policy, que garante que rascunho de evidência nunca vaze.
--
-- O que fica de fora: `detail` (contexto interno de quem escreve, incluindo
-- lembretes de perguntar à JK), `responsible`, `file_url` e tudo mais.

create view public.fatos_publicos
with (security_invoker = false)
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
  'Janela pública da base de fatos: só afirmação aprovada, e só as colunas que a página imprime. O contexto interno de cada fato não passa por aqui.';
