/**
 * Premissas da conta de anúncio, enquanto o dono não preenche a margem real.
 *
 * Os dois números vêm da análise de 09/11/2026 ("onde o tráfego erra e o plano
 * de dezembro"), feita pela equipe. São PREMISSAS, não medidas: a tela mostra
 * cada uma por extenso ao lado da conta que ela sustenta, para ninguém ler
 * "empate" como fato. Quando a margem de cada peça existir em Margem, a conta
 * do empate deve passar a sair de lá.
 *
 * Arquivo puro.
 */

/** Margem de contribuição de referência sobre a venda paga. Com 30%, o empate é 1 / 0,30 = R$ 3,33 de venda por real de anúncio. */
export const MARGEM_DE_REFERENCIA = 0.3;

/**
 * Imposto que a fatura do Meta soma em cima do gasto do Gerenciador (cerca de
 * 13,8%). A API e o Gerenciador mostram o gasto SEM ele. O Google Ads já
 * mostra o custo como é cobrado.
 */
export const IMPOSTO_DA_FATURA: Record<string, number> = { meta: 0.138, google: 0 };

/** Quanto de venda paga cada real de anúncio precisa trazer para a conta empatar. */
export const voltaParaEmpatar = (margem = MARGEM_DE_REFERENCIA) => (margem > 0 ? 1 / margem : Infinity);
