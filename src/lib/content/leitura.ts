/**
 * Metadados de leitura do artigo: tempo estimado e datas legíveis.
 *
 * São sinais pequenos, mas é o conjunto deles que faz uma página parecer
 * publicação com redação por trás em vez de texto solto.
 */

/** Velocidade média de leitura em português, palavras por minuto. */
const PALAVRAS_POR_MINUTO = 200;

/**
 * Tempo de leitura em minutos, a partir do HTML do corpo.
 *
 * Conta só o texto: tags, comentários e o conteúdo de script somem antes.
 * Nunca devolve zero, porque "0 min de leitura" não ajuda ninguém.
 */
export function tempoDeLeitura(html: string | null | undefined): number {
  if (!html) return 1;

  const texto = html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;|&#\d+;/gi, " ")
    .trim();

  if (!texto) return 1;

  const palavras = texto.split(/\s+/).length;
  return Math.max(1, Math.round(palavras / PALAVRAS_POR_MINUTO));
}

const FORMATO_LONGO = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});

/** Data por extenso ("12 de agosto de 2026"). Fuso de São Paulo, como o admin. */
export function dataLonga(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return FORMATO_LONGO.format(d);
}

/**
 * A atualização só vira informação quando é bem depois da publicação.
 * Sem isso, todo artigo nasce com "atualizado hoje", o que não diz nada.
 */
export function mostrarAtualizacao(
  publishedAt: string | null | undefined,
  updatedAt: string | null | undefined,
): boolean {
  if (!publishedAt || !updatedAt) return false;
  const p = new Date(publishedAt).getTime();
  const u = new Date(updatedAt).getTime();
  if (Number.isNaN(p) || Number.isNaN(u)) return false;
  const umDia = 24 * 60 * 60 * 1000;
  return u - p > umDia;
}
