-- Margem: a taxa do gateway em partes e a tarifa fixa por venda (cartão 77).
--
-- Até aqui `custo_parametros.taxa` era um percentual único, e a Appmax cobra
-- percentuais diferentes por meio de pagamento, uma tarifa fixa por venda e a
-- antecipação, que muda com a rotina do caixa. As colunas novas guardam as
-- partes; a taxa que a conta usa sai delas (`taxaEfetiva`, em
-- `src/lib/margem/calculo.ts`). Todas começam vazias: nenhum valor é
-- inventado aqui, quem preenche é a diretoria na tela da Margem. Com todas as
-- partes vazias continua valendo a coluna `taxa` de antes.
--
-- Só colunas novas e nulas, nada é trocado nem apagado.

alter table public.custo_parametros
  add column taxa_cartao          numeric(6, 4) check (taxa_cartao >= 0 and taxa_cartao <= 1),
  add column taxa_pix             numeric(6, 4) check (taxa_pix >= 0 and taxa_pix <= 1),
  add column taxa_antecipacao_mes numeric(6, 4) check (taxa_antecipacao_mes >= 0 and taxa_antecipacao_mes <= 1),
  add column fracao_antecipada    numeric(6, 4) check (fracao_antecipada >= 0 and fracao_antecipada <= 1),
  add column prazo_medio_meses    numeric(5, 2) check (prazo_medio_meses >= 0 and prazo_medio_meses <= 24),
  add column proporcao_cartao     numeric(6, 4) check (proporcao_cartao >= 0 and proporcao_cartao <= 1),
  add column tarifa_fixa          numeric(10, 2) check (tarifa_fixa >= 0);

comment on column public.custo_parametros.tarifa_fixa is 'Reais por venda (tarifa do gateway), descontados em reais e não em percentual.';

notify pgrst, 'reload schema';
