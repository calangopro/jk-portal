import { comBasePath } from "@/lib/seo/base-path";

/**
 * Soma o prefixo do portal aos links internos do corpo do artigo.
 *
 * O corpo do guia é HTML servido de uma vez, com `dangerouslySetInnerHTML`, e
 * ali não existe `next/link` para somar o basePath. O editor grava link interno
 * como caminho do App Router (`/ouro-10k-ou-18k`, `/medidor-de-aliancas`),
 * que é o certo: caminho interno no banco é portátil e sobrevive a uma troca de
 * prefixo. O prefixo entra na hora de servir, aqui.
 *
 * Sem isto, todo link entre guias sairia para a raiz do domínio, que em produção
 * é a loja da Tray, e o Google leria isso como link quebrado dentro do portal.
 *
 * Fica de fora, porque `comBasePath` recusa: endereço absoluto (`https://...`),
 * URL sem esquema (`//host/...`), âncora (`#quanto-custa`) e caminho que já veio
 * com o prefixo. É essa última guarda que garante que nada vire `/guias/guias`.
 *
 * A troca é por expressão regular, e não por parser, pela mesma razão de
 * `aplicarPrecos`: o HTML é montado pelo nosso editor, não é entrada de
 * terceiro, e um parser aqui custaria caro em toda renderização de página.
 */
const LINK_INTERNO = /\s(href|src)="(\/[^"]*)"/gi;

export function comBasePathNosLinks(html: string): string {
  if (!html) return html;
  return html.replace(
    LINK_INTERNO,
    (_todo, atributo: string, caminho: string) =>
      ` ${atributo}="${comBasePath(caminho)}"`,
  );
}
