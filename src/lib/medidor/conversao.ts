/**
 * Conversão entre as numerações de anel usadas no mundo.
 *
 * A base de tudo é a circunferência interna em milímetros, que é a única
 * medida física de verdade. Cada país inventou uma escala em cima dela:
 *
 *   Brasil e Itália  aro = circunferência − 40
 *   ISO 8653         o número É a circunferência em milímetros (França,
 *                    Alemanha, Espanha e a maior parte da Europa)
 *   Estados Unidos   escala própria, com passo de 2,5535 mm por número
 *
 * Nada aqui é afirmação institucional da JK: são convenções de numeração, e as
 * fórmulas estão escritas na página para quem quiser conferir. O padrão
 * americano vem da definição usada pela indústria, circunferência em milímetros
 * igual a 36,537 mais 2,5535 vezes o número, que reproduz a tabela publicada
 * (número 7 dá 54,41 mm, número 3 dá 44,20 mm).
 *
 * Tudo em milímetros, como no resto do medidor.
 */

import { circunferenciaDoAro, diametroDoAro, ARO_MINIMO, ARO_MAXIMO } from "./aros";

/** Constantes da escala americana. */
const EUA_BASE = 36.537;
const EUA_PASSO = 2.5535;

export function euaPorCircunferencia(circunferenciaMm: number): number {
  return (circunferenciaMm - EUA_BASE) / EUA_PASSO;
}

export function circunferenciaPorEua(numero: number): number {
  return EUA_BASE + EUA_PASSO * numero;
}

/**
 * Número americano arredondado para a meia medida mais próxima.
 *
 * Os Estados Unidos vendem em meios, e mostrar "7,02" seria informação falsa
 * de precisão: ninguém compra esse anel.
 */
export function euaComercial(circunferenciaMm: number): number {
  return Math.round(euaPorCircunferencia(circunferenciaMm) * 2) / 2;
}

/** Número do padrão ISO 8653, que é a própria circunferência arredondada. */
export function isoPorCircunferencia(circunferenciaMm: number): number {
  return Math.round(circunferenciaMm);
}

export type LinhaDeConversao = {
  aro: number;
  circunferencia: number;
  diametro: number;
  /** ISO 8653, usado na França, Alemanha, Espanha e boa parte da Europa. */
  iso: number;
  /** Número americano na meia medida mais próxima. */
  eua: number;
  /** Diferença entre o número americano exato e o comercial, em milímetros. */
  folgaEua: number;
};

/** Uma linha por aro brasileiro, do menor ao maior. */
export function tabelaDeConversao(): LinhaDeConversao[] {
  const linhas: LinhaDeConversao[] = [];
  for (let aro = ARO_MINIMO; aro <= ARO_MAXIMO; aro++) {
    const circunferencia = circunferenciaDoAro(aro);
    const eua = euaComercial(circunferencia);
    linhas.push({
      aro,
      circunferencia,
      diametro: Number(diametroDoAro(aro).toFixed(2)),
      iso: isoPorCircunferencia(circunferencia),
      eua,
      folgaEua: Number((circunferencia - circunferenciaPorEua(eua)).toFixed(2)),
    });
  }
  return linhas;
}

/** Da circunferência para o aro brasileiro, dentro dos limites da tabela. */
export function aroPorCircunferencia(circunferenciaMm: number): number {
  const bruto = Math.round(circunferenciaMm - 40);
  return Math.min(ARO_MAXIMO, Math.max(ARO_MINIMO, bruto));
}

/** Do diâmetro para o aro brasileiro. */
export function aroPorDiametro(diametroMm: number): number {
  return aroPorCircunferencia(diametroMm * Math.PI);
}

/** Do número americano para o aro brasileiro. */
export function aroPorEua(numero: number): number {
  return aroPorCircunferencia(circunferenciaPorEua(numero));
}

/** Do número ISO para o aro brasileiro. É subtração direta. */
export function aroPorIso(numero: number): number {
  return aroPorCircunferencia(numero);
}

export const UNIDADES = ["aro", "circunferencia", "diametro", "iso", "eua"] as const;
export type Unidade = (typeof UNIDADES)[number];

export const UNIDADE_LABEL: Record<Unidade, string> = {
  aro: "Aro brasileiro",
  circunferencia: "Circunferência interna (mm)",
  diametro: "Diâmetro interno (mm)",
  iso: "Europa, padrão ISO",
  eua: "Estados Unidos",
};

/** Explica em uma linha o que cada escala é, para quem nunca viu. */
export const UNIDADE_AJUDA: Record<Unidade, string> = {
  aro: "O número que a joalheria brasileira usa. É a circunferência menos 40.",
  circunferencia: "A volta completa por dentro do anel, medida em milímetros.",
  diametro: "A largura do furo do anel, de um lado ao outro.",
  iso: "O número é a própria circunferência em milímetros. Vale na França, Alemanha e Espanha.",
  eua: "Escala própria, vendida em números inteiros e meios.",
};

/**
 * Converte qualquer entrada para o aro brasileiro, que é a medida de referência
 * do portal. Devolve null quando o valor não faz sentido.
 */
export function paraAro(valor: number, unidade: Unidade): number | null {
  if (!Number.isFinite(valor) || valor <= 0) return null;

  switch (unidade) {
    case "aro":
      return Math.min(ARO_MAXIMO, Math.max(ARO_MINIMO, Math.round(valor)));
    case "circunferencia":
      return aroPorCircunferencia(valor);
    case "diametro":
      return aroPorDiametro(valor);
    case "iso":
      return aroPorIso(valor);
    case "eua":
      return aroPorEua(valor);
  }
}

/** Todas as medidas de um aro, para mostrar o resultado de uma vez. */
export function medidasDoAro(aro: number): LinhaDeConversao {
  const circunferencia = circunferenciaDoAro(aro);
  const eua = euaComercial(circunferencia);
  return {
    aro,
    circunferencia,
    diametro: Number(diametroDoAro(aro).toFixed(2)),
    iso: isoPorCircunferencia(circunferencia),
    eua,
    folgaEua: Number((circunferencia - circunferenciaPorEua(eua)).toFixed(2)),
  };
}
