import type { NextConfig } from "next";

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
        source: "/:path*",
        headers: [
          // HSTS: depois da primeira visita, o navegador nem tenta HTTP. O
          // Google trata HTTPS como sinal de qualidade de página, e um salto
          // por HTTP é onde a sessão pode ser interceptada.
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
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
