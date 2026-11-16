/**
 * A regra de uma automação, na parte que é conta pura: ler as palavras,
 * conferir a regra e decidir se um comentário casa com ela. Com teste em
 * `scripts/teste-redes.mts`.
 *
 * O casamento é por PALAVRA INTEIRA, sem ligar para acento nem maiúscula:
 * "preco" casa com "Preço?" e não casa com "apreço". É de propósito mais
 * estreito do que parece cômodo: resposta automática em comentário que só
 * continha a palavra por acaso é pior do que não responder.
 */

export const LIMITES_DA_REGRA = { palavras: 12, letrasPorPalavra: [2, 40] as const, resposta: 500, nome: 80, esperaMin: [10, 1440] as const, porHora: [1, 60] as const };

/** Sem acento, em minúscula, com os espaços juntos. */
export function normalizar(t: string): string {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** "preço, valor; quanto custa" vira ["preço", "valor", "quanto custa"]. Tira repetida, vazia e o que passa do limite. */
export function lerPalavras(bruto: string | string[]): string[] {
  const partes = Array.isArray(bruto) ? bruto : bruto.split(/[,;\n]/);
  const vistas = new Set<string>();
  const saida: string[] = [];
  for (const p of partes) {
    const limpa = String(p).replace(/^#/, "").replace(/\s+/g, " ").trim();
    const chave = normalizar(limpa);
    if (chave.length < LIMITES_DA_REGRA.letrasPorPalavra[0] || chave.length > LIMITES_DA_REGRA.letrasPorPalavra[1] || vistas.has(chave)) continue;
    vistas.add(chave);
    saida.push(limpa);
    if (saida.length >= LIMITES_DA_REGRA.palavras) break;
  }
  return saida;
}

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A palavra da regra que aparece no comentário, como palavra inteira. Nenhuma: null. */
export function palavraQueCasa(texto: string, palavras: string[]): string | null {
  const alvo = normalizar(texto);
  if (!alvo) return null;
  for (const p of palavras) {
    const chave = normalizar(p);
    if (chave.length < 2) continue;
    // Limite de palavra feito à mão: o \b do JavaScript não entende letra acentuada, e aqui o texto já está sem acento.
    if (new RegExp(`(^|[^a-z0-9])${escapar(chave)}($|[^a-z0-9])`).test(alvo)) return p;
  }
  return null;
}

export type DadosDaRegra = { nome: string; palavras: string[]; resposta: string; esperaMin: number; limitePorHora: number };

/** Confere uma regra. Devolve o problema em uma frase, ou null. */
export function conferirRegra(r: DadosDaRegra): string | null {
  const nome = r.nome.trim();
  if (nome.length < 2) return "Dê um nome à regra, para achar depois.";
  if (nome.length > LIMITES_DA_REGRA.nome) return "O nome da regra passou de 80 caracteres.";
  if (r.palavras.length === 0) return "Escreva pelo menos uma palavra que dispara a resposta.";
  const resposta = r.resposta.trim();
  if (resposta.length < 2) return "Escreva a resposta.";
  if (resposta.length > LIMITES_DA_REGRA.resposta) return `A resposta passou de ${LIMITES_DA_REGRA.resposta} caracteres.`;
  if (/[—–]/.test(resposta) || /[—–]/.test(nome)) return "Troque o travessão por vírgula ou ponto: a casa não usa travessão.";
  if (!Number.isFinite(r.esperaMin) || r.esperaMin < LIMITES_DA_REGRA.esperaMin[0] || r.esperaMin > LIMITES_DA_REGRA.esperaMin[1]) return "A espera antes de responder vai de 10 minutos a 24 horas.";
  if (!Number.isFinite(r.limitePorHora) || r.limitePorHora < LIMITES_DA_REGRA.porHora[0] || r.limitePorHora > LIMITES_DA_REGRA.porHora[1]) return "O limite vai de 1 a 60 respostas por hora.";
  return null;
}

export type ComentarioParaARegra = { texto: string; quando: string | null; nosso: boolean; ehResposta: boolean; estado: string };

/**
 * A regra deve responder este comentário AGORA? Devolve a palavra que casou,
 * ou null. As quatro condições que não dependem do banco moram aqui:
 * comentário de terceiro, de primeiro nível, ainda sem resposta, escrito
 * depois de a regra ser ligada e já com a idade da espera.
 */
export function deveResponder(c: ComentarioParaARegra, regra: { palavras: string[]; ativadaEm: string; esperaMin: number }, agora: number): string | null {
  if (c.nosso || c.ehResposta || c.estado !== "novo" || !c.quando) return null;
  const quando = Date.parse(c.quando);
  if (!Number.isFinite(quando) || quando < Date.parse(regra.ativadaEm)) return null;
  if (agora - quando < regra.esperaMin * 60_000) return null;
  return palavraQueCasa(c.texto, regra.palavras);
}
