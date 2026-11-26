/**
 * A revisão de um post das redes, só as contas puras: a versão do conteúdo que
 * foi visto, a conferência das notas e o estado que a tela mostra.
 *
 * Sem banco, sem tela e sem módulo do Node, para o teste rodar solto
 * (`npm run verificar:redes`) e a tela importar o rótulo sem puxar nada pesado.
 * Quem grava e lê é `revisao.ts`.
 */

/** Uma anotação da pessoa que revisou. `card` é a posição da mídia (1, 2, 3...); nulo é observação geral. */
export type NotaDeRevisao = {
  card: number | null;
  /** Onde a pessoa tocou na imagem, de 0 a 1, da esquerda e de cima. Nulo: ela só comentou o card. */
  x: number | null;
  y: number | null;
  texto: string;
};

export type RevisaoNaTela = {
  id: string;
  decisao: "aprovado" | "recusado";
  notas: NotaDeRevisao[];
  por: string | null;
  em: string;
};

/**
 * Onde o post está na revisão.
 * `pendente`: ninguém revisou. `aprovado` e `recusado`: valem para o conteúdo de agora.
 * `ajustado`: foi revisado, mas o conteúdo mudou depois (quem mexeu quer que se confira de novo).
 */
export type EstadoDaRevisao = "pendente" | "aprovado" | "recusado" | "ajustado";

export type RevisaoDoPost = {
  estado: EstadoDaRevisao;
  /** A última decisão, mesmo velha. Quando é `ajustado`, é o que foi pedido para ajustar. */
  ultima: RevisaoNaTela | null;
};

export const MAX_NOTAS = 40;
export const MAX_TEXTO_DA_NOTA = 1000;

/**
 * O resumo do que a pessoa viu: título, legenda, formato, as mídias na ordem e
 * as opções. Mudou qualquer uma, a versão muda e a revisão antiga deixa de
 * valer. O endereço da mídia basta (arquivo novo tem endereço novo).
 */
/** Resumo de 53 bits (cyrb53). Não é segurança: só precisa mudar quando o texto muda. */
function resumo(texto: string, semente: number): string {
  let h1 = 0xdeadbeef ^ semente;
  let h2 = 0x41c6ce57 ^ semente;
  for (let i = 0; i < texto.length; i++) {
    const c = texto.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0");
}

export function versaoDoPost(p: { titulo: string | null; legenda: string; formato: string; midias: { url: string }[]; opcoes: Record<string, unknown> }): string {
  const opcoes = Object.keys(p.opcoes ?? {}).sort().map((k) => [k, p.opcoes[k]]);
  const corpo = JSON.stringify([p.titulo ?? "", p.legenda, p.formato, p.midias.map((m) => m.url), opcoes]);
  return resumo(corpo, 0) + resumo(corpo, 7);
}

const entre01 = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, Math.round(v * 1000) / 1000)) : null);

/**
 * Confere as notas que vieram da tela ou do conector: só os campos conhecidos,
 * texto aparado e não vazio, `card` dentro das mídias que o post tem. Nota sem
 * texto some (a tela deixa campo em branco ao marcar um ponto).
 */
export function lerNotas(bruto: unknown, totalDeCards: number): { notas: NotaDeRevisao[] } | { erro: string } {
  if (!Array.isArray(bruto)) return { notas: [] };
  const notas: NotaDeRevisao[] = [];
  for (const item of bruto.slice(0, MAX_NOTAS)) {
    if (!item || typeof item !== "object") continue;
    const n = item as Record<string, unknown>;
    const texto = String(n.texto ?? "").replace(/\r\n/g, "\n").trim().slice(0, MAX_TEXTO_DA_NOTA);
    if (!texto) continue;
    const bruto_card = n.card;
    let card: number | null = null;
    if (bruto_card !== null && bruto_card !== undefined) {
      if (typeof bruto_card !== "number" || !Number.isInteger(bruto_card) || bruto_card < 1 || bruto_card > Math.max(totalDeCards, 1)) {
        return { erro: `A nota fala do card ${String(bruto_card)}, mas o post tem ${totalDeCards} ${totalDeCards === 1 ? "mídia" : "mídias"}.` };
      }
      card = bruto_card;
    }
    // O ponto só vale com os dois eixos e com um card: ponto solto, sem card, não tem onde ficar.
    const x = card === null ? null : entre01(n.x);
    const y = card === null ? null : entre01(n.y);
    notas.push({ card, x: x !== null && y !== null ? x : null, y: x !== null && y !== null ? y : null, texto });
  }
  return { notas };
}

/** A regra da decisão: aprovar vai sem nota; recusar pede ao menos uma, porque recusa muda não ensina nada. */
export function conferirDecisao(decisao: unknown, notas: NotaDeRevisao[]): string | null {
  if (decisao !== "aprovado" && decisao !== "recusado") return "Decisão desconhecida.";
  if (decisao === "recusado" && notas.length === 0) return "Diga o que está errado: escreva ao menos uma nota, no card ou em geral.";
  return null;
}

/** O estado do post na revisão, dada a última decisão e a versão que o post tem agora. */
export function estadoDaRevisao(ultima: (RevisaoNaTela & { versao: string }) | null, versaoAtual: string): RevisaoDoPost {
  if (!ultima) return { estado: "pendente", ultima: null };
  const { versao, ...visivel } = ultima;
  if (versao !== versaoAtual) return { estado: "ajustado", ultima: visivel };
  return { estado: ultima.decisao, ultima: visivel };
}

/** "Card 3" ou "Geral": o rótulo de uma nota. */
export const rotuloDaNota = (n: Pick<NotaDeRevisao, "card">): string => (n.card === null ? "Geral" : `Card ${n.card}`);
