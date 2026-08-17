import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Montserrat } from "next/font/google";
import "./globals.css";
import { SITE } from "@/lib/seo/site";
import { lerTema } from "@/lib/tema/ler";
import { cssDoTema, hashDoTema } from "@/lib/tema/css";

/**
 * Fontes auto-hospedadas pelo next/font.
 *
 * Antes vinham por <link rel="stylesheet"> do Google, o que bloqueia a
 * renderização e cria uma cadeia de dois saltos (CSS num domínio, arquivo da
 * fonte em outro). Assim o arquivo sai do nosso próprio domínio, com preload
 * automático e sem requisição a terceiros.
 *
 * Só os pesos realmente usados: Cormorant em 500 nos títulos, Montserrat de
 * 400 a 700 no corpo e na interface.
 */
const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--fonte-display",
  display: "swap",
});

const corpo = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--fonte-corpo",
  display: "swap",
});

/**
 * Layout raiz: só o documento e as fontes. O cabeçalho e o rodapé do site
 * público ficam em (site)/layout.tsx, e o /admin tem o seu próprio.
 */
export const metadata: Metadata = {
  /**
   * ORIGEM, sem o /guias. Isto não é descuido, é o contrário.
   *
   * O `metadataBase` só é usado para resolver URL RELATIVA de metadata, e a
   * principal delas é a imagem de compartilhamento gerada por convenção
   * (`opengraph-image.tsx`). O Next monta o caminho dessa imagem já COM o
   * basePath (`/guias/ouro-10k/opengraph-image-…`) e depois junta com o caminho
   * do `metadataBase`. Com `/guias` nos dois lados, o og:image saía como
   * `.../guias/guias/ouro-10k/opengraph-image`, que foi exatamente o que o build
   * mostrou antes desta correção.
   *
   * O canonical e o og:url não dependem daqui: `buildMetadata` já entrega os
   * dois como URL absoluta, montada por `absoluteUrl()`, que é quem soma o
   * prefixo. Ver src/lib/seo/site.ts.
   */
  metadataBase: new URL(SITE.origin),
  title: {
    default: `${SITE.name}: guia de alianças`,
    template: `%s | ${SITE.name}`,
  },
  description: SITE.description,
  // Verificação de propriedade no Search Console. Fica por variável de ambiente
  // porque o valor muda por propriedade e não deve ir para o repositório.
  ...(process.env.GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } }
    : {}),
};

/**
 * O Next só emite a meta tag de viewport quando ela é declarada, e não existia
 * nenhuma aqui. Sem `width=device-width` o celular renderiza a página numa
 * viewport virtual de 980px e reduz tudo, o que é exatamente o oposto do que a
 * indexação mobile-first (o padrão do Google hoje) espera encontrar.
 */
export async function generateViewport(): Promise<Viewport> {
  // A cor da barra do navegador no celular acompanha o painel escuro do tema.
  // Era fixa em "#1a1815", o que deixaria a barra na cor antiga depois de
  // alguém trocar a paleta no admin.
  const tema = await lerTema();
  return {
    width: "device-width",
    initialScale: 1,
    themeColor: tema.cores.charcoal ?? "#1a1815",
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const tema = await lerTema();
  const css = cssDoTema(tema);

  return (
    <html lang="pt-BR" className={`${display.variable} ${corpo.variable}`}>
      {/*
        Tema vindo do banco, aplicado por cima dos tokens do Tailwind.

        O seletor gerado é `:root:root`, e não `:root`, porque repetir o
        seletor dobra a especificidade e faz este bloco vencer SEM depender da
        ordem no documento. Ordem seria frágil demais aqui: muda com o hoisting
        de <style> do React 19 e com a injeção de estilo do HMR em dev.

        O `href` carrega o hash do CSS porque o React deduplica estilo içado por
        `href`. Com um href fixo, trocar o tema não reinseriria nada e a
        mudança simplesmente não apareceria.

        Sai no HTML do servidor, então não existe piscada de cor antiga.
      */}
      <style
        href={`jk-tema-${hashDoTema(css)}`}
        precedence="tema"
        dangerouslySetInnerHTML={{ __html: css }}
      />
      <body>{children}</body>
    </html>
  );
}
