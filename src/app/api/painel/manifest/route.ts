import { comBasePath } from "@/lib/seo/base-path";

/**
 * Ficha do painel como aplicativo instalável ("Instalar app" no Chrome,
 * "Adicionar à Tela de Início" no iPhone).
 *
 * Mora em `/api`, e não em `/admin`, porque o navegador busca este arquivo SEM
 * os cookies da sessão: dentro do painel ele seria mandado para o login. Não é
 * o `app/manifest.ts` de convenção do Next porque aquele vale para o site
 * inteiro, e quem deve virar aplicativo é só o painel: o `scope` abaixo prende
 * o app em `/guias/admin`, e link para o site ou para a loja abre no navegador.
 *
 * Não tem service worker, de propósito. O Chrome não exige mais um para
 * oferecer a instalação, e um service worker guardando páginas de um painel
 * que mostra faturamento do dia seria a receita para número velho na tela.
 */
export const dynamic = "force-static";

export function GET() {
  const ficha = {
    name: "Painel JK Alianças",
    short_name: "Painel JK",
    description: "O escritório da JK Alianças: vendas, tráfego, loja e conteúdo.",
    lang: "pt-BR",
    id: comBasePath("/admin"),
    start_url: comBasePath("/admin"),
    scope: comBasePath("/admin"),
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7f3ec",
    theme_color: "#f7f3ec",
    icons: [
      { src: comBasePath("/painel-icone-192.png"), sizes: "192x192", type: "image/png", purpose: "any" },
      { src: comBasePath("/painel-icone-512.png"), sizes: "512x512", type: "image/png", purpose: "any" },
      { src: comBasePath("/painel-icone-mascara-512.png"), sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Toque longo no ícone do app, no Android: os três lugares mais usados.
    shortcuts: [
      { name: "Registrar venda", url: comBasePath("/admin/registrar-venda") },
      { name: "Pedidos da loja", url: comBasePath("/admin/vendas") },
      { name: "Fila de recuperação", url: comBasePath("/admin/recuperacao") },
    ],
  };
  return new Response(JSON.stringify(ficha), {
    headers: {
      "content-type": "application/manifest+json; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
