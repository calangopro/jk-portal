-- Faixa de preço por percentil, e não por mínimo e máximo.
--
-- POR QUE A CORREÇÃO
--
-- Mínimo e máximo são reféns de um único caso fora da curva. O material
-- `ouro-18k` saía com faixa "de R$ 300,00 a R$ 33.279,87" porque um produto cita
-- ouro 18k na descrição sem ser ouro maciço, enquanto a mediana do grupo é
-- R$ 9.899,90. Anunciar "a partir de R$ 300" seria verdade técnica e mentira
-- prática, exatamente o tipo de número que o projeto proíbe publicar.
--
-- Percentil 10 e 90 descrevem onde o catálogo realmente está, e a mediana
-- continua sendo o número que resume o grupo.
--
-- O `having` também é novo: material com menos de três produtos dá uma faixa que
-- não descreve nada, e é melhor não mostrar a linha do que mostrar ruído.
--
-- Recriada em vez de substituída porque o Postgres não deixa renomear coluna de
-- view por `create or replace`.

drop view public.aliancas_por_material;

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
    and (p.name ilike '%alian%' or p.description ilike '%alian%')
)
select
  material,
  count(*)                                              as produtos,
  percentile_cont(0.10) within group (order by price)   as preco_tipico_min,
  percentile_cont(0.90) within group (order by price)   as preco_tipico_max,
  percentile_cont(0.50) within group (order by price)   as preco_mediano
from classificado
where material is not null
group by material
having count(*) >= 3;

grant select on public.aliancas_por_material to anon, authenticated;
