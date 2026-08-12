import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Endereço de preview do rascunho, assinado.
 *
 * O token não é coluna no banco de propósito: não ocupa linha, não vaza numa
 * leitura de tabela e some todo de uma vez se o segredo for trocado. Ele só
 * prova que quem tem o link recebeu o link de alguém do admin, o que basta
 * para mostrar rascunho a quem revisa sem exigir conta.
 */

function segredo(): string {
  const s = process.env.PREVIEW_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error("Sem segredo para assinar o preview.");
  return s;
}

function assinar(id: string): string {
  return createHmac("sha256", segredo()).update(`preview:${id}`).digest("hex").slice(0, 32);
}

export function tokenDePreview(id: string): string {
  return `${id}.${assinar(id)}`;
}

/** Devolve o id quando a assinatura confere, e nulo em qualquer outro caso. */
export function idDoToken(token: string): string | null {
  const corte = token.lastIndexOf(".");
  if (corte <= 0) return null;
  const id = token.slice(0, corte);
  const recebida = Buffer.from(token.slice(corte + 1));
  const esperada = Buffer.from(assinar(id));
  // Comparação de tempo constante: uma comparação comum vaza, pelo tempo de
  // resposta, quantos caracteres do início já estavam certos.
  if (recebida.length !== esperada.length) return null;
  return timingSafeEqual(recebida, esperada) ? id : null;
}
