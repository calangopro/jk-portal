/**
 * Os melhores horários para postar, tirados do histórico da PRÓPRIA conta.
 * Conta pura, com teste em `scripts/teste-redes.mts`.
 *
 * COMO A CONTA É FEITA
 *
 * Cada publicação já vem comparada com o normal da conta (`fator`, em
 * `conteudos.ts`): 1 é o normal, 2 é o dobro. Isso tira da conta o formato e o
 * tamanho de cada rede, e sobra o que interessa aqui: a HORA. As publicações
 * são agrupadas em faixas de três horas, no horário de Brasília, e cada faixa
 * fica com a mediana dos fatores. A melhor faixa é a de mediana mais alta.
 *
 * O QUE ELA NÃO DIZ
 *
 * É correlação, não causa: a faixa onde a JK mais posta tem mais amostra, e um
 * post forte publicado de noite puxa a noite. Por isso uma faixa só entra com
 * `MINIMO_NA_FAIXA` publicações com número, e a tela diz em quantos posts a
 * sugestão se apoia. Story fica de fora: ele some em 24 horas e quase nunca
 * chega a ter número.
 */
import type { Conteudo } from "./conteudos.ts";
import type { RedeId } from "./redes.ts";

/** Faixas de três horas: 6h às 9h, 9h às 12h, e assim por diante. A madrugada fica de fora. */
export const FAIXAS = [6, 9, 12, 15, 18, 21] as const;
export type InicioDaFaixa = (typeof FAIXAS)[number];

/** Publicações com número que uma faixa precisa ter para entrar na conta. */
export const MINIMO_NA_FAIXA = 6;

export type Faixa = { inicio: InicioDaFaixa; posts: number; mediana: number };
export type HorariosDaRede = { rede: RedeId; faixas: Faixa[]; melhor: Faixa | null; amostra: number };

/** A hora do dia, de 0 a 23, no horário de Brasília. */
export function horaEmSaoPaulo(iso: string): number {
  return Number(new Date(iso).toLocaleString("en-US", { timeZone: "America/Sao_Paulo", hour: "2-digit", hourCycle: "h23" }));
}

function faixaDa(hora: number): InicioDaFaixa | null {
  if (hora < 6) return null;
  return FAIXAS[Math.min(FAIXAS.length - 1, Math.floor((hora - 6) / 3))];
}

function mediana(valores: number[]): number {
  const l = [...valores].sort((a, b) => a - b);
  const m = Math.floor(l.length / 2);
  return l.length % 2 ? l[m] : (l[m - 1] + l[m]) / 2;
}

/** As faixas de cada rede, com a melhor. Rede sem faixa com amostra fica com `melhor` nulo. */
export function melhoresHorarios(conteudos: Conteudo[]): HorariosDaRede[] {
  const porRede = new Map<RedeId, Map<InicioDaFaixa, number[]>>();
  for (const c of conteudos) {
    if (c.grupo === "story" || c.fator === null || !c.publicado_em) continue;
    const f = faixaDa(horaEmSaoPaulo(c.publicado_em));
    if (f === null) continue;
    const faixas = porRede.get(c.rede) ?? new Map<InicioDaFaixa, number[]>();
    faixas.set(f, [...(faixas.get(f) ?? []), c.fator]);
    porRede.set(c.rede, faixas);
  }
  return [...porRede.entries()].map(([rede, mapa]) => {
    const faixas = FAIXAS.filter((f) => (mapa.get(f)?.length ?? 0) >= MINIMO_NA_FAIXA).map((f) => ({ inicio: f, posts: mapa.get(f)!.length, mediana: mediana(mapa.get(f)!) }));
    const melhor = [...faixas].sort((a, b) => b.mediana - a.mediana || b.posts - a.posts)[0] ?? null;
    return { rede, faixas, melhor, amostra: [...mapa.values()].reduce((n, l) => n + l.length, 0) };
  });
}

/** "18h às 21h". */
export function faixaEmPalavra(inicio: number): string {
  return `${inicio}h às ${inicio + 3 === 24 ? "0" : inicio + 3}h`;
}

/**
 * Os próximos horários sugeridos, a partir de agora: a hora do meio de cada
 * faixa boa (19h para a faixa das 18h às 21h), no próximo dia em que ela
 * ainda não passou, com pelo menos meia hora de folga. Devolve no máximo
 * `quantos`, do mais perto para o mais longe, em ISO.
 */
export function proximosHorarios(faixas: InicioDaFaixa[], agora: number, quantos = 3): string[] {
  const saida: number[] = [];
  const hojeSP = new Date(agora).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  for (let dia = 0; dia < 4 && saida.length < quantos * 2; dia++) {
    for (const f of [...new Set(faixas)].sort((a, b) => a - b)) {
      const d = new Date(`${hojeSP}T12:00:00-03:00`);
      d.setUTCDate(d.getUTCDate() + dia);
      const data = d.toISOString().slice(0, 10);
      const t = Date.parse(`${data}T${String(f + 1).padStart(2, "0")}:00:00-03:00`);
      if (t >= agora + 30 * 60_000) saida.push(t);
    }
  }
  return [...new Set(saida)].sort((a, b) => a - b).slice(0, quantos).map((t) => new Date(t).toISOString());
}
