/**
 * Grade de cartões que não anuncia o que falta.
 *
 * Uma grade de três colunas com um cartão dentro desenha duas colunas vazias ao
 * lado, e quem chega lê "aqui deveria ter mais coisa e não tem" antes de ler
 * qualquer palavra. Enquanto o acervo é pequeno, o número de colunas acompanha
 * o número de itens.
 *
 * O teto de largura é a outra metade do arranjo, e sozinho nenhum dos dois
 * resolve: uma coluna só, sem teto, estica o cartão pelos 72 rem do container e
 * troca o buraco lateral por um banner deitado, que fica pior.
 *
 * As classes vão escritas por extenso porque o Tailwind varre o código-fonte
 * para decidir o CSS que gera: nome de classe montado por concatenação não
 * chega ao ar.
 *
 * @param itens  quantos cartões a lista tem de verdade
 * @param maximo teto de colunas quando a lista está cheia
 */
export function grade(itens: number, maximo: 3 | 4): string {
  if (itens <= 1) return "max-w-[27rem]";
  if (itens === 2) return "max-w-[54rem] sm:grid-cols-2";
  if (itens === 3 || maximo === 3) return "sm:grid-cols-2 lg:grid-cols-3";
  return "sm:grid-cols-2 lg:grid-cols-4";
}
