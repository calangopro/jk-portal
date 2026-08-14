import { diametroDoAro } from "./aros";

/**
 * Largura da aliança, em milímetros.
 *
 * Largura é a segunda dúvida mais cara de errar, depois do aro, e é a que texto
 * nenhum resolve: "3 mm é fina" não diz nada para quem nunca comparou. O que
 * resolve é ver em tamanho real, no próprio dedo.
 *
 * As larguras aqui são as que EXISTEM no catálogo sincronizado da Tray, não uma
 * lista bonita inventada. Oferecer 2 a 5 mm quando a JK vende de 1,5 a 10 mm
 * seria esconder metade do que ela fabrica.
 *
 * Só entra aqui o que é geometria, ou seja, o que se calcula da própria medida.
 * Nada de "a de 5 mm combina com mão grande": isso é afirmação sobre produto e
 * precisa de fonte aprovada, então mora na base de fatos e entra pelo texto.
 */

/** Larguras com volume real no catálogo, da mais fina à mais larga. */
export const LARGURAS_COMUNS = [2, 3, 4, 5, 6, 8] as const;
export type LarguraComum = (typeof LARGURAS_COMUNS)[number];

/**
 * Quanto da largura visível do dedo a aliança ocupa.
 *
 * De frente, a parte visível do dedo tem a largura de um diâmetro. Uma aliança
 * de 5 mm num aro 12 (16,55 mm de diâmetro) cobre pouco mais de 30% disso. É
 * pura proporção, e é o número que torna a comparação concreta.
 */
export function proporcaoNoDedo(larguraMm: number, aro: number): number {
  const diametro = diametroDoAro(aro);
  if (diametro <= 0) return 0;
  return larguraMm / diametro;
}

/** A mesma proporção em porcentagem inteira, para a tela. */
export function porcentagemNoDedo(larguraMm: number, aro: number): number {
  return Math.round(proporcaoNoDedo(larguraMm, aro) * 100);
}

/** Descrição da proporção, derivada do número e não de opinião. */
export function comoFicaNoDedo(larguraMm: number, aro: number): string {
  const p = porcentagemNoDedo(larguraMm, aro);
  const largura = larguraMm.toLocaleString("pt-BR");
  return `Num aro ${aro}, a aliança de ${largura} mm cobre cerca de ${p}% da largura visível do dedo.`;
}
