/**
 * "Em alta": o que cada publicação rendeu, comparado com o NORMAL da própria
 * conta. Conta pura, com teste em `scripts/teste-redes.mts`.
 *
 * POR QUE COMPARAR COM A PRÓPRIA CONTA, E POR FORMATO
 *
 * O número absoluto engana: um Reels do Instagram da JK passa de 20 mil
 * visualizações num dia comum, e um vídeo do YouTube dela fica em dezenas.
 * Pôr os dois na mesma régua faria o YouTube nunca aparecer, e um Reels comum
 * parecer viral. Por isso cada publicação é comparada com a MEDIANA das
 * publicações da mesma conta e do mesmo tipo (vídeo, foto, story) nos últimos
 * 90 dias. "Acima do normal" é render pelo menos o dobro dessa mediana.
 *
 * Mediana, e não média, porque um único post que explodiu puxaria a média
 * para cima e esconderia todos os outros.
 *
 * Grupo com poucas publicações não tem "normal": abaixo de `MINIMO_DO_GRUPO`
 * a comparação não aparece.
 */
import type { RedeId } from "./redes.ts";

export type PublicacaoCrua = {
  id: string;
  conta_id: string;
  rede: RedeId;
  id_na_rede: string;
  formato: string | null;
  legenda: string | null;
  link: string | null;
  miniatura_url: string | null;
  publicado_em: string | null;
  curtidas: number | null;
  comentarios: number | null;
  salvos: number | null;
  compartilhamentos: number | null;
  alcance: number | null;
  visualizacoes: number | null;
  metricas_em: string | null;
};

/** Vídeo, foto e story têm réguas diferentes: um Reels sempre tem mais visualização que uma foto. */
export type GrupoDeFormato = "video" | "foto" | "story" | "texto";

export const NOME_DO_GRUPO: Record<GrupoDeFormato, string> = { video: "Vídeos e Reels", foto: "Fotos e carrosséis", story: "Stories", texto: "Só texto" };

export type Criterio = "visualizacoes" | "interacoes" | "taxa" | "comentarios" | "compartilhamentos" | "salvos";

export const CRITERIOS: { id: Criterio; nome: string; curto: string }[] = [
  { id: "visualizacoes", nome: "Mais vistos", curto: "visualizações" },
  { id: "interacoes", nome: "Mais interações", curto: "interações" },
  { id: "taxa", nome: "Maior engajamento", curto: "a cada 100" },
  { id: "comentarios", nome: "Mais comentados", curto: "comentários" },
  { id: "compartilhamentos", nome: "Mais compartilhados", curto: "compartilhamentos" },
  { id: "salvos", nome: "Mais salvos", curto: "salvos" },
];

export type Conteudo = PublicacaoCrua & {
  grupo: GrupoDeFormato;
  /** Curtidas, comentários, salvos e compartilhamentos somados. Nulo quando a rede não informou nenhum. */
  interacoes: number | null;
  /** Quantas vezes foi visto: as visualizações, ou o alcance na rede que não as informa. */
  vistos: number | null;
  /** Interações a cada 100 pessoas que viram. Nulo abaixo de `MINIMO_PARA_TAXA` vistos: taxa de poucos é acaso. */
  taxa: number | null;
  /** Quantas vezes o normal da conta neste tipo, na mesma régua. Nulo sem normal (grupo pequeno ou sem número). */
  fator: number | null;
  /** Por qual número a publicação foi comparada. */
  regua: "visualizacoes" | "alcance" | "interacoes" | null;
  acima: boolean;
};

/** Publicações do mesmo tipo e da mesma conta que precisam existir para haver um "normal". */
export const MINIMO_DO_GRUPO = 5;
/** Quantas vezes o normal conta como "acima do normal". */
export const FATOR_ACIMA = 2;
/** Abaixo disto de vistos, a taxa de engajamento não aparece. */
export const MINIMO_PARA_TAXA = 50;

export function grupoDoFormato(formato: string | null): GrupoDeFormato {
  if (formato === "video_curto" || formato === "video") return "video";
  if (formato === "post" || formato === "carrossel") return "foto";
  if (formato === "story") return "story";
  return "texto";
}

const numero = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** A mediana: o do meio, com a lista em ordem. Lista vazia não tem. */
export function mediana(valores: number[]): number | null {
  if (!valores.length) return null;
  const l = [...valores].sort((a, b) => a - b);
  const m = Math.floor(l.length / 2);
  return l.length % 2 ? l[m] : (l[m - 1] + l[m]) / 2;
}

function interacoesDe(p: PublicacaoCrua): number | null {
  const partes = [p.curtidas, p.comentarios, p.salvos, p.compartilhamentos].map(numero).filter((v): v is number => v !== null);
  return partes.length ? partes.reduce((a, b) => a + b, 0) : null;
}

/**
 * A régua de cada publicação: as visualizações; sem elas, o alcance; sem os
 * dois, as interações (o post de texto ainda assim tem régua).
 *
 * Cada publicação só é comparada com publicações medidas pela MESMA régua. Na
 * primeira leitura de verdade (Facebook, 16/11/2026) só um sexto dos posts já
 * tinha visualizações lidas; o resto entrava pelas interações, a mediana saía
 * em poucas dezenas, e um post com milhares de visualizações aparecia como
 * "477× o normal".
 */
type Regua = "visualizacoes" | "alcance" | "interacoes";
function reguaDe(p: PublicacaoCrua, interacoes: number | null): { regua: Regua; valor: number } | null {
  const v = numero(p.visualizacoes);
  if (v !== null) return { regua: "visualizacoes", valor: v };
  const a = numero(p.alcance);
  if (a !== null) return { regua: "alcance", valor: a };
  return interacoes !== null ? { regua: "interacoes", valor: interacoes } : null;
}

/**
 * Cada publicação com as contas feitas. `base` é a lista que define o normal
 * (90 dias de cada conta); quem é analisado pode ser só uma parte dela.
 */
export function analisarConteudos(lista: PublicacaoCrua[], base: PublicacaoCrua[] = lista): Conteudo[] {
  const preparar = (p: PublicacaoCrua) => {
    const vistos = numero(p.visualizacoes) ?? numero(p.alcance);
    const interacoes = interacoesDe(p);
    return { grupo: grupoDoFormato(p.formato), vistos, interacoes };
  };

  const normal = new Map<string, number | null>();
  const grupos = new Map<string, number[]>();
  for (const p of base) {
    const x = preparar(p);
    const r = reguaDe(p, x.interacoes);
    if (r === null) continue;
    const chave = `${p.conta_id}|${x.grupo}|${r.regua}`;
    grupos.set(chave, [...(grupos.get(chave) ?? []), r.valor]);
  }
  for (const [chave, valores] of grupos) normal.set(chave, valores.length >= MINIMO_DO_GRUPO ? mediana(valores) : null);

  return lista.map((p) => {
    const x = preparar(p);
    const r = reguaDe(p, x.interacoes);
    const n = r ? normal.get(`${p.conta_id}|${x.grupo}|${r.regua}`) ?? null : null;
    const fator = r !== null && n !== null && n > 0 ? r.valor / n : null;
    return {
      ...p,
      ...x,
      taxa: x.interacoes !== null && x.vistos !== null && x.vistos >= MINIMO_PARA_TAXA ? (x.interacoes / x.vistos) * 100 : null,
      fator,
      regua: r?.regua ?? null,
      acima: fator !== null && fator >= FATOR_ACIMA,
    };
  });
}

export function valorDoCriterio(c: Conteudo, criterio: Criterio): number | null {
  switch (criterio) {
    case "visualizacoes":
      return c.vistos;
    case "interacoes":
      return c.interacoes;
    case "taxa":
      return c.taxa;
    case "comentarios":
      return numero(c.comentarios);
    case "compartilhamentos":
      return numero(c.compartilhamentos);
    case "salvos":
      return numero(c.salvos);
  }
}

/** Do maior para o menor. Quem não tem o número vai para o fim, na ordem de publicação. */
export function ordenarConteudos(lista: Conteudo[], criterio: Criterio): Conteudo[] {
  return [...lista].sort((a, b) => {
    const va = valorDoCriterio(a, criterio);
    const vb = valorDoCriterio(b, criterio);
    if (va === null && vb === null) return Date.parse(b.publicado_em ?? "") - Date.parse(a.publicado_em ?? "") || 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    return vb - va;
  });
}

/** "2,4×", "12×": o fator do jeito que se lê. */
export function fatorEmPalavra(fator: number): string {
  return `${fator.toLocaleString("pt-BR", { maximumFractionDigits: fator < 10 ? 1 : 0 })}×`;
}
