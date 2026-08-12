/**
 * Conversão entre aro brasileiro e medidas reais.
 *
 * Regra da tabela brasileira (base ABNT), verificada contra tabelas de
 * joalheria: a circunferência interna em milímetros é o número do aro mais 40.
 *
 *   circunferência (mm) = aro + 40
 *   diâmetro (mm)       = circunferência / π
 *
 * Conferindo: aro 18 dá 58 mm de circunferência e 18,46 mm de diâmetro, que é
 * exatamente o que as tabelas publicadas trazem.
 *
 * Tudo aqui trabalha em MILÍMETROS. Pixel serve só para desenhar na tela.
 */

export const ARO_MINIMO = 7;
export const ARO_MAXIMO = 35;

/** Circunferência interna, em milímetros, de um aro. */
export function circunferenciaDoAro(aro: number): number {
  return aro + 40;
}

/** Diâmetro interno, em milímetros, de um aro. */
export function diametroDoAro(aro: number): number {
  return circunferenciaDoAro(aro) / Math.PI;
}

/** Aro exato (com casas decimais) para um diâmetro em milímetros. */
export function aroExatoPorDiametro(diametroMm: number): number {
  return diametroMm * Math.PI - 40;
}

/**
 * Aro recomendado para um diâmetro.
 *
 * A JK orienta que, ficando entre dois números, vale escolher o maior, porque
 * a aliança precisa passar pela articulação do dedo. Por isso arredondamos
 * para cima quando a medida passa de 0,35 do intervalo.
 */
export function aroRecomendado(diametroMm: number): number {
  const exato = aroExatoPorDiametro(diametroMm);
  const base = Math.floor(exato);
  const sobra = exato - base;
  const escolhido = sobra >= 0.35 ? base + 1 : base;
  return Math.min(ARO_MAXIMO, Math.max(ARO_MINIMO, escolhido));
}

/** Tabela completa, usada na página e no schema. */
export function tabelaDeAros(): { aro: number; diametro: number; circunferencia: number }[] {
  const linhas = [];
  for (let aro = ARO_MINIMO; aro <= ARO_MAXIMO; aro++) {
    linhas.push({
      aro,
      diametro: Number(diametroDoAro(aro).toFixed(2)),
      circunferencia: circunferenciaDoAro(aro),
    });
  }
  return linhas;
}

/** Objetos de referência aceitos na calibração, com medida oficial. */
export const REFERENCIAS = {
  moeda: {
    id: "moeda" as const,
    nome: "Moeda de R$ 1",
    medidaMm: 27,
    formato: "circulo" as const,
    dica: "A moeda de 1 real tem 27 mm de diâmetro, medida oficial do Banco Central.",
  },
  cartao: {
    id: "cartao" as const,
    nome: "Cartão de banco",
    medidaMm: 85.6,
    formato: "retangulo" as const,
    /** Proporção do padrão ID-1, usada em todo cartão de crédito e débito. */
    alturaMm: 53.98,
    dica: "Todo cartão de crédito ou débito tem 85,60 mm de largura, por norma internacional.",
  },
} as const;

export type ReferenciaId = keyof typeof REFERENCIAS;
