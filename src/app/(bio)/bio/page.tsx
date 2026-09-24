import type { Metadata, Viewport } from "next";
import { PaginaDaBio } from "@/components/bio/PaginaDaBio";
import { lerBio } from "@/lib/bio/ler";
import { temaDoDia } from "@/lib/bio/agenda";
import { corDaBarra } from "@/lib/bio/temas";
import { hojeEmSaoPaulo } from "@/lib/tray/preco";
import { buildMetadata } from "@/lib/seo/metadata";
import { SITE } from "@/lib/seo/site";

/**
 * Cinco minutos de ISR, e não uma hora como o resto do site.
 *
 * A bio troca de campanha à meia-noite e mostra preço ao vivo. Com uma hora, o
 * Esquenta entraria no ar à 1h da manhã e um preço de Black podia ficar uma hora
 * atrasado em relação à loja. Cinco minutos seguram o pico do Instagram com HTML
 * pronto e deixam as duas coisas quase em tempo real.
 */
export const revalidate = 300;

/**
 * `noindex, follow`, de propósito.
 *
 * A bio é uma porta de passagem, não uma resposta a busca: muda a cada
 * campanha, não tem texto próprio e repetiria o que a home da loja e o portal
 * já respondem. No índice ela só disputaria a busca pela marca com a home da
 * loja. O `follow` continua, para o rastreador seguir os links até as páginas
 * que importam.
 *
 * O canonical é `/bio`, o endereço que a pessoa vê, e não `/guias/bio`, que é
 * onde a página mora dentro do portal. Quem mascara o endereço é o Worker da
 * Cloudflare (`infra/cloudflare/worker.js`).
 */
export function generateMetadata(): Metadata {
  const base = buildMetadata({
    title: `${SITE.name}: ofertas, alianças e lojas`,
    description:
      "Ofertas da semana, alianças mais vendidas, medidor de tamanho grátis e o WhatsApp das 10 lojas da JK Alianças em São Paulo.",
    path: "/bio",
    canonical: `${SITE.origin}/bio`,
  });
  return { ...base, robots: { index: false, follow: true } };
}

export async function generateViewport(): Promise<Viewport> {
  const bio = await lerBio();
  return {
    width: "device-width",
    initialScale: 1,
    // No navegador do Instagram, a barra de cima vira a moldura da página.
    themeColor: corDaBarra(temaDoDia(bio, hojeEmSaoPaulo())),
  };
}

export default async function Bio() {
  const bio = await lerBio();
  return <PaginaDaBio bio={bio} hoje={hojeEmSaoPaulo()} />;
}
