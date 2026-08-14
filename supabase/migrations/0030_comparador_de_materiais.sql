-- Comparador de materiais: o que dá para afirmar e de onde vem cada número.
--
-- POR QUE ASSIM
--
-- Comparar materiais é o ativo de GEO mais forte que a JK pode ter, porque
-- tabela com dado verificável é o formato que os sistemas de IA citam. Também é
-- o lugar mais fácil de escorregar: teor, durabilidade e o que a garantia cobre
-- são afirmações sobre produto, e a regra do projeto não deixa publicar nenhuma
-- sem fonte aprovada.
--
-- A saída é separar por ORIGEM, e não por assunto:
--
--   1. Teor é definição metrológica. Prata 925 tem 92,5% de prata porque é isso
--      que o número significa, em qualquer joalheria do mundo. Entra aprovado,
--      como já entrou a fórmula do aro.
--   2. Faixa de preço sai do catálogo sincronizado da Tray. É dado, não
--      afirmação, e se atualiza sozinho.
--   3. Durabilidade, manutenção e garantia são da JK. Entram como `validar`, e
--      a página simplesmente NÃO mostra a linha enquanto ninguém aprovar.
--
-- Assim a ferramenta nasce útil e verdadeira no mesmo dia, e cresce quando o
-- cliente responder, sem código novo.

-- Assunto e atributo, para o comparador ler a base de fatos como uma tabela.
-- Sem isto, "prata 950 tem 95% de prata" seria uma frase solta que só serve
-- para ler, e não para montar coluna e linha.
alter table public.facts
  add column subject   text,
  add column attribute text;

create index facts_assunto_idx on public.facts (subject, attribute)
  where subject is not null;

comment on column public.facts.subject is
  'Do que o fato fala, em slug. No comparador, o material: prata-925, ouro-18k.';
comment on column public.facts.attribute is
  'Qual característica. No comparador: teor, durabilidade, manutencao, garantia.';

/**
 * Alianças agrupadas por material, com a faixa de preço real.
 *
 * O material NÃO vem de `product_variants.material`, que está vazio e é
 * reescrito pela sincronização a cada rodada. Vem do nome e da descrição, com
 * precedência: "banhada a ouro 18k" é banhada, não ouro maciço, então o teste
 * de banho tem que vir ANTES do teste de ouro. Invertido, dois terços do
 * catálogo de prata banhada seriam anunciados como ouro.
 *
 * `security_invoker` liga a RLS de quem consulta: sem isso a view entregaria
 * produto inativo para a chave anônima, furando a policy de `products`.
 */
create view public.aliancas_por_material
with (security_invoker = true)
as
with classificado as (
  select
    p.id,
    p.price,
    case
      when p.name ilike '%banhad%' or p.description ilike '%banhad%' then 'prata-banhada'
      when p.name ilike '%prata com ouro%' or p.description ilike '%prata com ouro%' then 'prata-com-ouro'
      when p.name ilike '%ouro 18k%' or p.description ilike '%ouro 18k%' then 'ouro-18k'
      when p.name ilike '%ouro 10k%' or p.description ilike '%ouro 10k%' then 'ouro-10k'
      when p.name ilike '%prata 950%' or p.description ilike '%prata 950%' then 'prata-950'
      when p.name ilike '%prata 925%' or p.description ilike '%prata 925%' then 'prata-925'
      else null
    end as material
  from public.products p
  where p.is_active
    and p.price is not null
    and p.price > 0
    -- Só aliança: anel e brinco entrariam na conta e falseariam a faixa.
    and (p.name ilike '%alian%' or p.description ilike '%alian%')
)
select
  material,
  count(*)                                                          as produtos,
  min(price)                                                        as menor_preco,
  max(price)                                                        as maior_preco,
  percentile_cont(0.5) within group (order by price)                as preco_mediano
from classificado
where material is not null
group by material;

grant select on public.aliancas_por_material to anon, authenticated;

-- SEMENTE: teor, que é definição e não opinião.
insert into public.facts (claim, detail, module, subject, attribute, source_url, captured_at, responsible, status) values
  (
    'A prata 925 tem 92,5% de prata pura, e o restante são outros metais que dão firmeza à peça.',
    'É o que o número 925 significa, em qualquer joalheria do mundo. Definição metrológica, não afirmação da JK.',
    'materiais', 'prata-925', 'teor', null, '2026-08-13', 'equipe do portal', 'aprovado'
  ),
  (
    'A prata 950 tem 95% de prata pura, um teor mais alto que o da prata 925.',
    'Mesma lógica do 925: o número é a proporção de prata em mil partes.',
    'materiais', 'prata-950', 'teor', null, '2026-08-13', 'equipe do portal', 'aprovado'
  ),
  (
    'O ouro 18k tem 75% de ouro puro, o equivalente a 18 partes de ouro em 24.',
    'O quilate mede a proporção de ouro em vinte e quatro avos. Definição, não claim.',
    'materiais', 'ouro-18k', 'teor', null, '2026-08-13', 'equipe do portal', 'aprovado'
  ),
  (
    'O ouro 10k tem cerca de 41,7% de ouro puro, o equivalente a 10 partes de ouro em 24.',
    'Menos ouro que o 18k, e por isso mais barato e mais duro.',
    'materiais', 'ouro-10k', 'teor', null, '2026-08-13', 'equipe do portal', 'aprovado'
  ),
  (
    'Na prata banhada a ouro, a peça é de prata e recebe uma camada de ouro por cima.',
    'O teor de ouro depende da espessura do banho, que varia por fabricante. A espessura usada pela JK ainda precisa ser confirmada.',
    'materiais', 'prata-banhada', 'teor', null, '2026-08-13', 'equipe do portal', 'aprovado'
  ),
  (
    'Na aliança de prata com ouro, as duas ligas aparecem na mesma peça, cada uma em uma parte dela.',
    'Diferente do banho: aqui o ouro é parte da estrutura, não uma camada.',
    'materiais', 'prata-com-ouro', 'teor', null, '2026-08-13', 'equipe do portal', 'aprovado'
  );

-- SEMENTE: o que depende da JK. Fica `validar`, e a página não mostra.
insert into public.facts (claim, detail, module, subject, attribute, captured_at, responsible, status) values
  ('ESCREVER: como a prata 925 se comporta com o uso diário.', 'Perguntar à JK: escurece em quanto tempo, risca com que facilidade, precisa de polimento a cada quanto.', 'materiais', 'prata-925', 'durabilidade', null, 'a confirmar com a JK', 'validar'),
  ('ESCREVER: como a prata 950 se comporta com o uso diário.', 'Mesma pergunta do 925, e a diferença entre as duas na prática.', 'materiais', 'prata-950', 'durabilidade', null, 'a confirmar com a JK', 'validar'),
  ('ESCREVER: como o ouro 18k se comporta com o uso diário.', 'Perguntar à JK: risca mais ou menos que o 10k, precisa de manutenção.', 'materiais', 'ouro-18k', 'durabilidade', null, 'a confirmar com a JK', 'validar'),
  ('ESCREVER: como o ouro 10k se comporta com o uso diário.', 'Perguntar à JK: a dureza maior compensa o teor menor no dia a dia.', 'materiais', 'ouro-10k', 'durabilidade', null, 'a confirmar com a JK', 'validar'),
  ('ESCREVER: quanto dura o banho de ouro e o que acontece quando ele sai.', 'Perguntar à JK: espessura do banho, prazo médio, se refaz o banho e se isso é cobrado.', 'materiais', 'prata-banhada', 'durabilidade', null, 'a confirmar com a JK', 'validar'),
  ('ESCREVER: como cuidar da peça de prata com ouro.', 'Perguntar à JK: pode usar o mesmo produto de limpeza nas duas partes.', 'materiais', 'prata-com-ouro', 'durabilidade', null, 'a confirmar com a JK', 'validar'),
  ('ESCREVER: o que a garantia da JK cobre em cada material.', 'A garantia vitalícia do teor já está confirmada. Falta o que vale para desgaste, banho, pedra e ajuste de aro.', 'materiais', 'todos', 'garantia', null, 'a confirmar com a JK', 'validar');
