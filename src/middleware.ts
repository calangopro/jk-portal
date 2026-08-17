import { NextResponse, type NextRequest } from "next/server";
import { acharRedirect } from "@/lib/redirects/servir";
import { paginaRemovidaHtml } from "@/lib/redirects/pagina-removida";
import { comBasePath } from "@/lib/seo/base-path";

/**
 * O middleware faz UMA coisa: servir a tabela `redirects` nas rotas públicas.
 *
 * Ele NÃO cuida de sessão nem de autorização do admin, de propósito. Quem
 * protege o /admin é o `requireStaff()` no layout do painel, que lê o perfil no
 * banco e sempre funcionou. Ao tentar também renovar a sessão aqui, o token do
 * Supabase passava a ser rotacionado em toda requisição, inclusive nos POSTs
 * das ações, e a corrida entre a renovação do middleware e a da ação derrubava
 * o login no meio de um salvamento.
 *
 * Detalhe importante: com a pasta `src/`, este arquivo precisa ficar em
 * `src/middleware.ts`. Na raiz do projeto o Next o ignora em silêncio.
 *
 * Sobre o `basePath` de /guias, duas coisas que o Next já faz e que NÃO devem
 * ser refeitas aqui (conferido no código do Next 15.5, não por suposição):
 *
 *   1. `request.nextUrl.pathname` chega SEM o prefixo. Quem separa é
 *      `getNextPathnameInfo`, que tira o basePath e o guarda em
 *      `nextUrl.basePath`. Ou seja, a comparação com `redirects.source_path`
 *      continua sendo entre caminhos internos, e a tabela segue portátil: se o
 *      prefixo mudar um dia, nenhuma linha do banco precisa ser reescrita.
 *
 *   2. O `matcher` abaixo recebe o prefixo no build (`getMiddlewareMatchers`
 *      monta `/guias/(...)`), então as exclusões de `admin`, `api`,
 *      `_next/static` e afins continuam valendo, agora relativas ao prefixo.
 *      Escrever `/guias` no matcher à mão geraria `/guias/guias`.
 */
export async function middleware(request: NextRequest) {
  const redirect = await acharRedirect(request.nextUrl.pathname);

  if (!redirect) return NextResponse.next();

  // 410 significa que a página saiu de vez, e não que mudou de lugar. O status
  // continua sendo 410 (é o que faz o Google tirar a URL do índice mais rápido
  // que um 404), mas agora com página de marca e com saídas.
  if (redirect.status === "410") {
    return new NextResponse(paginaRemovidaHtml(), {
      status: 410,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  // Destino relativo é caminho INTERNO no banco, então ganha o prefixo aqui:
  // o navegador precisa do endereço público. Sem `comBasePath`, o `new URL`
  // com caminho começando em barra descartaria o /guias e o redirect jogaria a
  // pessoa na raiz do domínio, que em produção é a loja da Tray.
  const destino = redirect.destination_url.startsWith("http")
    ? redirect.destination_url
    : new URL(comBasePath(redirect.destination_url), request.url).toString();

  return NextResponse.redirect(destino, redirect.status === "302" ? 302 : 301);
}

export const config = {
  /**
   * Rotas públicas apenas. O /admin fica de fora porque a proteção dele é do
   * layout, e porque tocar na sessão aqui quebra o salvamento.
   * Arquivos estáticos e rotas de imagem também ficam de fora.
   */
  matcher: [
    "/((?!admin|api|_next/static|_next/image|favicon.ico|icon|opengraph-image|robots.txt|sitemap.xml|llms.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt)$).*)",
  ],
};
