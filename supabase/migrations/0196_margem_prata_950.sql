-- Margem da prata 950 pelo grama e pelo milímetro (cartão 67, 20/11/2026).
--
-- Pedido do Filipe: a prata 950 deixa de ter custo produto a produto. O custo
-- do material sai de três números gerais, e a largura vem do nome do produto:
--   gramas = largura (mm) x gramas por mm x peças (par = 2)
--   custo  = gramas x preço médio do grama da prata + resto da peça
-- A conta mora em `src/lib/margem/calculo.ts` (custoDaPrata). O ouro continua
-- pelo grama, agora com o peso de cada produto (planilhas do Carlos), que já
-- cabia em `produto_custos.gramas`.
--
-- Só estrutura: os valores entram pela tela da Margem, nunca por migration
-- (custo é da empresa e o repositório é público).

alter table public.custo_parametros
  add column if not exists cotacao_prata numeric(10, 2) check (cotacao_prata > 0),
  add column if not exists prata_gramas_por_mm numeric(8, 4) check (prata_gramas_por_mm > 0),
  add column if not exists prata_resto numeric(10, 2) check (prata_resto >= 0);

comment on column public.custo_parametros.cotacao_prata is 'Preço médio do grama da prata 950 que a JK paga (R$).';
comment on column public.custo_parametros.prata_gramas_por_mm is 'Gramas de prata por milímetro de largura, numa aliança só (média).';
comment on column public.custo_parametros.prata_resto is 'Resto da peça de prata por produto (feitio, solitário de brinde, caixinha), em R$.';

-- O produto de prata 950 só ganha linha em produto_custos quando alguém grava
-- um peso ou um resto diferente da média; sem linha, a conta usa o nome.
alter table public.produto_custos drop constraint if exists produto_custos_material_check;
alter table public.produto_custos
  add constraint produto_custos_material_check
  check (material in ('ouro_18k', 'ouro_10k', 'prata_com_ouro', 'prata_950'));
