import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Montserrat } from "next/font/google";
import "./globals.css";
import { SITE } from "@/lib/seo/site";

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
  metadataBase: new URL(SITE.url),
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
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1a1815",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${corpo.variable}`}>
      <body>{children}</body>
    </html>
  );
}
