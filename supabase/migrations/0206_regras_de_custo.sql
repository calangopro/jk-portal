-- Custo das peças por REGRAS (cartão 82).
--
-- Até aqui o custo saía produto a produto (peso do Carlos, custo fixo) ou, na
-- prata 950, de um número só de gramas por milímetro. As regras novas moram
-- num objeto só na mesma linha de `custo_parametros`, que já é só de
-- administrador (0049): gramas por mm por material e tipo (aliança, anel),
-- fator por modelo, custo da zircônia por tamanho e quantas pedras vão na meia
-- volta e na volta completa, anel solitário de brinde, caixinha de alianças e
-- a folga de custo em %. O painel lê o nome do produto e calcula
-- (`src/lib/margem/calculo.ts`). Peso e custo gravados no produto continuam
-- vencendo.
--
-- Objeto e não colunas: as regras mudam de forma enquanto a JK manda os
-- números (por aro, por modelo), e quem confere o formato é o código, que
-- descarta o que não reconhece. Nenhum valor entra por aqui.

alter table public.custo_parametros
  add column if not exists regras_custo jsonb not null default '{}'::jsonb;

comment on column public.custo_parametros.regras_custo is
  'Regras do custo das peças (cartão 82): gramas por mm, fator por modelo, pedras, brinde, caixinha e folga. Formato em src/lib/margem/calculo.ts (RegrasDeCusto).';
