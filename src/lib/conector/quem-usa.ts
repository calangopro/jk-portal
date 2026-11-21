/**
 * Quem usa o conector do Claude, e com quais operações. Arquivo puro, com
 * teste em `scripts/teste-redes.mts`.
 *
 * As operações do conector rodam com a chave de serviço (o conector não tem a
 * sessão da pessoa no banco), então a RLS não segura nada ali: a trava de
 * nível mora aqui e é conferida em quatro lugares.
 *
 * - `identificar` (chaves.ts): chave de quem não usa o conector não entra;
 * - `visiveis` (mcp.ts): o Claude só enxerga o que o nível pode usar;
 * - `executarOperacao` (executar.ts): a porta única recusa o resto;
 * - `requireConector` (session.ts): as telas de ligar e de criar chave.
 *
 * A equipe de conteúdo usa todas as operações, com as travas de administrador
 * de cada uma. Vendas e fábrica não usam o conector. O nível Social media
 * (0090) usa só as das redes e o "quem sou eu".
 */

/**
 * Níveis que não usam o conector. É a lista de fora da equipe de conteúdo
 * (`FORA_DO_CONTEUDO`, em `auth/acessos.ts`) menos quem usa em parte; o teste
 * confere que as duas andam juntas. Não é import porque módulo puro só importa
 * TIPO de outro arquivo (o teste roda com `.ts` no caminho e o `tsc` recusa).
 */
const NAO_USAM: readonly string[] = ["vendas", "fabrica", "loja"];

/** Nível que usa o conector só em parte: o nome exato da operação, ou a área inteira terminada em ponto. */
const SO_ESTAS: Readonly<Record<string, readonly string[]>> = {
  social: ["redes.", "painel.eu"],
};

const temLista = (papel: string) => Object.prototype.hasOwnProperty.call(SO_ESTAS, papel);

export function podeUsarConector(papel: string | null | undefined): boolean {
  return Boolean(papel) && !NAO_USAM.includes(papel!);
}

export function operacaoLiberada(papel: string | null | undefined, operacao: string): boolean {
  if (!podeUsarConector(papel)) return false;
  if (temLista(papel!)) return SO_ESTAS[papel!].some((p) => (p.endsWith(".") ? operacao.startsWith(p) : operacao === p));
  return true;
}

/** Os níveis que usam o conector só em parte (para o teste). */
export const USAM_EM_PARTE: readonly string[] = Object.keys(SO_ESTAS);

/** O que dizer na tela de ligar e na do conector, para quem usa só em parte. Nulo: usa tudo. */
export function limiteEmPalavras(papel: string | null | undefined): string | null {
  return papel === "social" ? "No seu nível, o Claude usa só o Social Media: posts, stories, agenda, comentários, ideias e os números das redes." : null;
}
