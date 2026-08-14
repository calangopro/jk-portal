/**
 * Vocabulário da fila de pautas.
 *
 * Tipo e rótulo ficam aqui, longe do banco, para o formulário do cliente e a
 * ação do servidor falarem a mesma língua sem duplicar lista de strings.
 */

export const STATUS_DA_PAUTA = ["ideia", "pronta", "escrevendo", "publicada", "descartada"] as const;
export type StatusDaPauta = (typeof STATUS_DA_PAUTA)[number];

export type Pauta = {
  id: string;
  targetQuery: string;
  title: string | null;
  searchIntent: string | null;
  cluster: string | null;
  notes: string | null;
  modelo: string | null;
  status: StatusDaPauta;
  origem: "gsc" | "manual";
  impressions: number | null;
  clicks: number | null;
  position: number | null;
  ctr: number | null;
  contentId: string | null;
  /** Título do conteúdo que nasceu desta pauta, quando já existe. */
  conteudoTitulo?: string | null;
  conteudoSlug?: string | null;
  conteudoStatus?: string | null;
};

export const STATUS_DA_PAUTA_LABEL: Record<StatusDaPauta, string> = {
  ideia: "Ideia",
  pronta: "Pronta para escrever",
  escrevendo: "Escrevendo",
  publicada: "Publicada",
  descartada: "Descartada",
};

export function ehStatusDaPauta(v: string): v is StatusDaPauta {
  return (STATUS_DA_PAUTA as readonly string[]).includes(v);
}

/** Uma consulta do Search Console que ainda não virou pauta nem página. */
export type Oportunidade = {
  consulta: string;
  impressoes: number;
  cliques: number;
  posicao: number;
  ctr: number;
  /** Quanto vale atacar, de 0 a 100. Só para ordenar a fila. */
  nota: number;
  /** Por que esta consulta está no topo, em uma frase para o editor. */
  porque: string;
};

/**
 * Ordena a fila por oportunidade, não por volume.
 *
 * O volume sozinho engana: a consulta com mais impressões do portal é `aliança`,
 * com 304 mil impressões e CTR de 0,03%, e ela é grande demais para uma página
 * nova resolver. O que interessa é o cruzamento de três coisas:
 *
 *   1. Impressão suficiente para o ganho valer o trabalho.
 *   2. CTR baixo, que é o sintoma de "aparece e ninguém clica".
 *   3. Posição na faixa em que subir é possível. Abaixo de 3 já está ganho, e
 *      acima de 25 raramente sobe só com conteúdo novo.
 *
 * A escala é logarítmica na impressão de propósito: sem isso uma única consulta
 * gigante domina a lista inteira e esconde as dez que dariam resultado.
 */
export function notaDaOportunidade(o: {
  impressoes: number;
  ctr: number;
  posicao: number;
}): number {
  if (o.impressoes < 100) return 0;

  // 100 impressões vale 0, 100 mil vale 1.
  const volume = Math.min(1, Math.log10(o.impressoes / 100) / 3);

  // CTR de 0% vale 1, de 5% para cima vale 0. Acima disso a página já converte.
  const perda = Math.max(0, Math.min(1, 1 - o.ctr / 5));

  // Melhor faixa entre 4 e 15. Fora dela, cai.
  const p = o.posicao;
  const alcance = p < 3 ? 0.2 : p <= 15 ? 1 : p <= 25 ? 0.5 : 0.15;

  return Math.round(volume * perda * alcance * 100);
}

export function porqueDaOportunidade(o: {
  impressoes: number;
  ctr: number;
  posicao: number;
}): string {
  const imp = o.impressoes.toLocaleString("pt-BR");
  const pos = o.posicao.toFixed(1).replace(".", ",");

  if (o.posicao < 3) {
    return `Já está na posição ${pos} com ${imp} impressões. Aqui o ganho vem de melhorar título e resposta, não de página nova.`;
  }
  if (o.posicao <= 15 && o.ctr < 1) {
    return `${imp} impressões na posição ${pos}, e quase ninguém clica. A JK aparece e não é escolhida, que é o caso mais fácil de virar.`;
  }
  if (o.posicao <= 15) {
    return `${imp} impressões na posição ${pos}. Está perto da primeira página e responde ao empurrão de um conteúdo dedicado.`;
  }
  return `${imp} impressões, porém na posição ${pos}. Vai precisar de conteúdo bom e de links internos, não só de um texto.`;
}
