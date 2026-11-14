/**
 * Verde, âmbar e vermelho do painel: bom, atenção e ruim.
 *
 * São as ÚNICAS cores de estado, e ficam reservadas para isso. Setor tem a cor
 * dele (`setores.ts`), gráfico tem as dele, e nenhum dos dois usa estas três.
 * Cada tom tem o texto e o fundo claro que vai por baixo, e os pares foram
 * medidos: texto sobre o próprio fundo passa de 5,5:1, e sobre branco, de 6:1.
 * Toda cor de estado vem com ícone e palavra, nunca sozinha.
 *
 * Arquivo puro: serve ao servidor, ao navegador e ao teste.
 */

export type Tom = "bom" | "atencao" | "ruim" | "neutro";

export const COR_DO_TOM: Record<Tom, { texto: string; fundo: string }> = {
  bom: { texto: "#046c4e", fundo: "#e3f4ec" },
  atencao: { texto: "#9a4a07", fundo: "#fcefd9" },
  ruim: { texto: "#b01919", fundo: "#fde8e8" },
  neutro: { texto: "var(--color-ink)", fundo: "#fff" },
};

/**
 * Quanto dos pedidos criados no período foi cancelado, em cor.
 *
 * É a mesma régua dos sinais da Visão geral (`sinais.ts`): com 20 pedidos ou
 * mais, de 30% para cima o painel já chama de problema. Entre 20% e 30% fica
 * em atenção. Com poucos pedidos não há cor.
 */
export function tomDoCancelamento(cancelados: number, criados: number, minimo = 20): Tom {
  if (criados < minimo) return "neutro";
  const taxa = cancelados / criados;
  if (taxa >= 0.3) return "ruim";
  if (taxa >= 0.2) return "atencao";
  return "neutro";
}

/**
 * O cancelamento de UM meio de pagamento, em cor. Também é a régua dos sinais:
 * de 80% para cima quase ninguém termina a compra por ali (problema), de 30%
 * para cima vale olhar (atenção). Com menos de 5 pedidos não há cor: "1 de 1
 * cancelado" é 100% e não quer dizer nada.
 */
export function tomDoMeioDePagamento(cancelados: number, criados: number): Tom {
  if (criados < 5) return "neutro";
  const taxa = cancelados / criados;
  if (taxa >= 0.8) return "ruim";
  if (taxa >= 0.3) return "atencao";
  return "neutro";
}
