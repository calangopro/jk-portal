import { BASE_PATH, comBasePath } from "./base-path";

/**
 * A ORIGEM pública, sem caminho nenhum.
 *
 * Convenção: `NEXT_PUBLIC_SITE_URL` guarda só o esquema mais o host
 * (`https://www.jkaliancas.com.br`), NUNCA o `/guias`. O prefixo é
 * responsabilidade do `basePath`, e mora em um lugar só (`base-path.ts`).
 *
 * O motivo é mecânico, não estético: `new URL("/ouro-10k", base)` joga fora o
 * caminho da base, porque caminho que começa com barra volta para a raiz. Com
 * `/guias` dentro da variável, todo canonical do site sairia sem o prefixo e
 * apontaria para dentro da loja da Tray. A limpeza abaixo é o cinto: se alguém
 * configurar a variável com o prefixo assim mesmo, ele é retirado aqui em vez
 * de virar `/guias/guias` lá na frente.
 */
function origemPublica(): string {
  const bruto = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  try {
    const u = new URL(bruto);
    return u.origin;
  } catch {
    return bruto.replace(/\/+$/, "");
  }
}

/**
 * Configuração única do site. Base para metadata, canonical, sitemap,
 * robots, llms.txt e schema. Nada de dado inventado da JK aqui:
 * o que ainda não veio da marca está marcado como TODO.
 */
export const SITE = {
  /** Só esquema e host, sem o prefixo do portal. Ex.: convite do Supabase. */
  origin: origemPublica(),
  /**
   * Endereço público do portal, COM o prefixo: é o que o Google indexa e o
   * que vale como `metadataBase`. Ex.: https://www.jkaliancas.com.br/guias
   */
  url: `${origemPublica()}${BASE_PATH}`,
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
    "Como escolher aliança, joia e semijoia: tamanho, largura, material e preço, explicado por quem fabrica. Ferramentas gratuitas e lojas em São Paulo.",
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

/**
 * URL pública absoluta a partir de um caminho INTERNO do App Router.
 *
 * Quem chama passa o caminho como o Next o conhece (`/ouro-10k`), e o
 * `/guias` entra aqui. É por isso que nenhuma das dezenas de chamadas espalhadas
 * pelo projeto precisou mudar, e é por isso que não existe risco de prefixo em
 * dobro: o prefixo é somado em um ponto só, e `comBasePath` recusa somar de novo
 * num caminho que já o tem.
 */
export function absoluteUrl(path: string): string {
  return new URL(comBasePath(path), SITE.origin).toString();
}

/** true quando rodando no ambiente de produção da Vercel. */
export function isProduction(): boolean {
  return process.env.VERCEL_ENV === "production";
}
