/**
 * Configuração única do site. Base para metadata, canonical, sitemap,
 * robots, llms.txt e schema. Nada de dado inventado da JK aqui:
 * o que ainda não veio da marca está marcado como TODO.
 */
export const SITE = {
  /** URL base de produção. Configurável por ambiente. */
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  name: "JK Alianças",
  // TODO: confirmar a razão social com a JK. Não está publicada em nenhuma
  // página da loja, e inventar isso quebraria a regra de não afirmar sem fonte.
  legalName: "JK Alianças",
  /**
   * Forma curta da marca, para o `alternateName` do WebSite. Era igual ao
   * `name`, e alternativa idêntica ao principal não serve de alternativa: o
   * Google usa este campo justamente quando o nome cheio não cabe.
   */
  shortName: "JK",
  description:
    "Guias, comparativos e páginas das lojas da JK Alianças: informação confiável sobre alianças de casamento e namoro.",
  locale: "pt_BR",
  /**
   * Perfis oficiais, conferidos no rodapé da loja em 12/08/2026.
   *
   * Isto é o que liga o portal, a loja e as redes como UMA entidade só aos
   * olhos do Google e de um modelo de linguagem. Sem sameAs, cada endereço
   * parece uma marca diferente.
   */
  sameAs: [
    "https://www.instagram.com/jkaliancas",
    "https://pt-br.facebook.com/jkaliancasoficial",
    "https://www.youtube.com/@jk.aliancas",
    "https://www.tiktok.com/@jkaliancas",
  ] as string[],
  /** Contato público, como aparece no topo da loja. */
  telefone: "+5511963005071",
  email: "marketing@jkaliancas.com.br",
  /** Endereço da loja oficial, para onde o portal manda quem quer comprar. */
  lojaUrl: "https://www.jkaliancas.com.br",
  // Sem `defaultOgImage`: apontava para /og/default.png, arquivo que nunca
  // existiu, e nada no código lia a constante. A imagem padrão de
  // compartilhamento é gerada por app/opengraph-image.tsx.
} as const;

/** Constrói uma URL absoluta a partir de um caminho relativo. */
export function absoluteUrl(path: string): string {
  return new URL(path, SITE.url).toString();
}

/** true quando rodando no ambiente de produção da Vercel. */
export function isProduction(): boolean {
  return process.env.VERCEL_ENV === "production";
}
