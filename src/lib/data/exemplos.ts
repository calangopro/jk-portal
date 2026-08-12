/**
 * Regra dos dados de exemplo.
 *
 * Exemplo é conveniência de quem está desenvolvendo, para a tela não ficar
 * vazia antes do banco existir. NUNCA é resposta de produção.
 *
 * Servir exemplo em produção já causou dano real: as páginas de loja
 * publicaram "Endereço a confirmar, PLACEHOLDER" dentro do JSON-LD
 * JewelryStore, que é exatamente o sinal em que o SEO local se apoia.
 *
 * Em produção:
 * - Banco vazio devolve vazio, e a página mostra estado vazio de verdade.
 * - Erro de banco é registrado e devolve vazio ou 404, nunca dado inventado.
 */
export function podeUsarExemplos(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.VERCEL_ENV !== "production";
}

/** Registra a falha com destaque, para não passar despercebida. */
export function registrarFalha(onde: string, erro: unknown): void {
  const detalhe = erro instanceof Error ? erro.message : String(erro);
  console.error(`[dados] falha em ${onde}: ${detalhe}`);
}
