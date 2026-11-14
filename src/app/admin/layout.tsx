import type { Metadata, Viewport } from "next";
import { comBasePath } from "@/lib/seo/base-path";
import { MoverCookieDeSessao } from "./MoverCookieDeSessao";

/**
 * Layout raiz do /admin: metadata e a ficha de aplicativo. NÃO exige sessão,
 * porque a página de login vive aqui dentro. A proteção fica no grupo (painel).
 */
export const metadata: Metadata = {
  title: { default: "Painel JK", template: "%s | Painel JK" },
  robots: { index: false, follow: false },
};

/**
 * O painel é claro, então a barra do navegador acompanha o marfim (o site
 * público usa o carvão do tema). `viewportFit: cover` é o que faz o iPhone
 * informar a faixa do gesto de baixo, que a barra de abas respeita.
 */
export const viewport: Viewport = {
  themeColor: "#f7f3ec",
  viewportFit: "cover",
};

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* O React leva estas tags para o <head>. Estão escritas à mão, e não em
          `metadata`, por causa do endereço: `metadata` monta URL absoluta com
          o domínio de produção, e na prévia da Vercel a ficha viria de outro
          domínio. Com caminho relativo ao próprio host, vale em qualquer um. */}
      <link rel="manifest" href={comBasePath("/api/painel/manifest")} />
      <link rel="apple-touch-icon" href={comBasePath("/painel-icone-180.png")} />
      <meta name="mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-title" content="Painel JK" />
      <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      <MoverCookieDeSessao />
      {children}
    </>
  );
}
