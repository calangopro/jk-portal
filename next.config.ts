import type { NextConfig } from "next";
import { BASE_PATH } from "./src/lib/seo/base-path";

/**
 * IMPORTANTE: não importar bibliotecas pesadas (ex.: @supabase/supabase-js)
 * aqui. O Next precisa empacotar o next.config para carregá-lo, e isso trava
 * o dev e o build.
 *
 * `distDir` configurável: rodar `next build` enquanto o `next dev` está no ar
 * faz os dois escreverem na MESMA pasta .next e corrompe o cache, com erros do
 * tipo "Cannot find module './873.js'" e página sem estilo. Para conferir o
 * build sem derrubar o dev, use:
 *
 *   BUILD_DIR=.next-build npm run build
 */

/**
 * Host do Supabase Storage, tirado da própria variável de ambiente para não
 * fixar o projeto no código. Sem isto o `next/image` recusa a imagem remota,
 * e a capa dos guias (que vem do bucket `media`) não renderiza.
 */
function hostDoSupabase(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

const host = hostDoSupabase();

const nextConfig: NextConfig = {
  /**
   * O portal roda dentro de /guias porque o domínio não é dele: a loja da Tray
   * continua respondendo por www.jkaliancas.com.br e um proxy na frente manda
   * só /guias/* para a Vercel. Com o `basePath` oficial, TODA rota, todo
   * arquivo de `public/` e todo bundle de `/_next/*` já nascem sob o prefixo,
   * então a origem nunca pede nada na raiz do domínio (que é da Tray).
   *
   * O valor mora em src/lib/seo/base-path.ts para o config e a aplicação
   * lerem a mesma constante.
   */
  basePath: BASE_PATH,
  distDir: process.env.BUILD_DIR || ".next",
  images: {
    remotePatterns: [
      ...(host
        ? [
            {
              protocol: "https" as const,
              hostname: host,
              pathname: "/storage/v1/object/public/**",
            },
          ]
        : []),
      // CDN da Tray: é de lá que vêm as fotos do catálogo espelhado. Sem esta
      // entrada o next/image recusa a imagem remota e a vitrine da home fica
      // com os quadros vazios.
      { protocol: "https" as const, hostname: "images.tcdn.com.br", pathname: "/**" },
    ],
    // Larguras que o portal realmente usa: coluna de leitura, capa e miniatura.
    imageSizes: [96, 160, 256, 384],
    deviceSizes: [420, 640, 828, 1080, 1280, 1600, 1920],
    // AVIF antes de WebP. O padrão do Next é só WebP, e o AVIF costuma entregar
    // o mesmo visual com arquivo bem menor, o que conta direto no LCP. A
    // conversão é feita no servidor, então o custo de codificar não pesa no
    // navegador de quem lê (que era o motivo de o upload continuar em WebP).
    formats: ["image/avif", "image/webp"],
  },
  // O cabeçalho X-Powered-By: Next.js não serve para nada além de anunciar a
  // stack para quem procura alvo.
  poweredByHeader: false,
  async headers() {
    return [
      {
        // `source` do Next já recebe o basePath sozinho: isto cobre
        // /guias/:path*, que é tudo que esta aplicação serve.
        source: "/:path*",
        headers: [
          // SEM Strict-Transport-Security aqui, de propósito.
          //
          // HSTS não é política de pasta, é política de HOST: o navegador
          // aplica ao domínio inteiro, não ao caminho que mandou o cabeçalho.
          // Como o portal serve só /guias e o dono de www.jkaliancas.com.br é a
          // loja na Tray, emitir daqui seria este aplicativo decidindo pelo
          // domínio todo. Com `includeSubDomains` alcançaria subdomínios que
          // nem conhecemos, e `preload` é porta de mão única: a lista vai
          // compilada dentro do navegador e sair dela leva meses.
          //
          // O lugar certo é a borda, ligado por quem é dono do domínio. O
          // Cloudflare, que já vai ficar na frente, tem isso em uma chave só e
          // aplica à zona inteira, de forma coerente com a loja.
          //
          // Não perdemos nada hoje: Vercel e Cloudflare já servem só HTTPS.
          //
          // Impede o navegador de adivinhar o tipo do arquivo, que é como um
          // upload vira script executável.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Mantém o referenciador entre páginas do site e ao sair para outro
          // domínio manda só a origem, sem o caminho.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default nextConfig;
