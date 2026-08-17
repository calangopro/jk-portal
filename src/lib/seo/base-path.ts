/**
 * O prefixo público do portal, em UM lugar só.
 *
 * O portal editorial não é dono do domínio. `www.jkaliancas.com.br` continua
 * apontando para a Tray, e um proxy na frente manda só `/guias/*` para cá. Por
 * isso a aplicação roda de verdade sob esse prefixo, pelo `basePath` oficial do
 * Next, e não por rewrite fingindo um caminho que não existe.
 *
 * Este arquivo não importa nada de propósito: ele é lido tanto pelo código da
 * aplicação quanto pelo `next.config.ts`, e o config não pode carregar
 * biblioteca pesada sem travar o dev e o build.
 *
 * O que o `basePath` do Next já resolve sozinho, e onde NÃO se mexe:
 *   - `next/link`, `useRouter().push/replace`, `redirect()` de servidor;
 *   - `next/image`, `next/font`, os arquivos de `public/`, `/_next/*`;
 *   - `source` de `headers()`, `redirects()` e `rewrites()`;
 *   - o `matcher` do middleware, que casa com o caminho JÁ sem o prefixo.
 *
 * O que sobra para as funções abaixo é o que o Next não enxerga: URL montada à
 * mão para SEO, `fetch` escrito por extenso no navegador, HTML cru que não passa
 * por componente React e caminho lido de `window.location`.
 */
export const BASE_PATH = "/guias";

/**
 * Caminho interno (o que o App Router conhece, ex.: `/ouro-10k`) para o
 * caminho público (`/guias/ouro-10k`).
 *
 * Se o caminho JÁ vier com o prefixo, ele volta intacto. É essa guarda que
 * garante que nada vire `/guias/guias/...` mesmo se alguém prefixar duas vezes.
 */
export function comBasePath(caminho: string): string {
  // Endereço externo, âncora pura ou caminho relativo não são nossos.
  if (!caminho.startsWith("/")) return caminho;
  // `//host/algo` é URL sem esquema, não caminho interno.
  if (caminho.startsWith("//")) return caminho;

  if (caminho === BASE_PATH || caminho.startsWith(`${BASE_PATH}/`)) return caminho;

  // A home é `/guias`, sem barra no fim: é exatamente o endereço que o Next
  // serve. Devolver `/guias/` faria o canonical apontar para uma URL que
  // responde 308, que é o oposto do que canonical existe para fazer.
  if (caminho === "/") return BASE_PATH;

  return `${BASE_PATH}${caminho}`;
}

/**
 * Caminho público (o que o navegador mostra) de volta para o caminho interno.
 *
 * Serve para tudo que é lido de `window.location` e depois comparado com rota
 * do App Router ou com dado gravado no banco. A tabela `redirects` guarda
 * caminho INTERNO, e é assim que ela sobrevive a uma eventual mudança de
 * prefixo sem precisar de migration.
 */
export function semBasePath(caminho: string): string {
  if (caminho === BASE_PATH) return "/";
  if (caminho.startsWith(`${BASE_PATH}/`)) return caminho.slice(BASE_PATH.length);
  return caminho;
}
