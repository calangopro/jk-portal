import type { Metadata, Viewport } from "next";
import { PaginaDoGrupo } from "@/components/bio/PaginaDoGrupo";
import { lerBio } from "@/lib/bio/ler";
import { corDaBarra } from "@/lib/bio/temas";
import { lerGrupo } from "@/lib/grupo/ler";
import { paginaDoGrupoNoDia } from "@/lib/grupo/montar";
import { hojeEmSaoPaulo } from "@/lib/tray/preco";
import { buildMetadata } from "@/lib/seo/metadata";
import { SITE } from "@/lib/seo/site";

/**
 * jkaliancas.com.br/grupo, a página do anúncio do grupo de ofertas.
 *
 * Mora em /guias/grupo, e quem mostra no endereço curto é o Worker da
 * Cloudflare, como na bio. Cinco minutos de ISR pelo mesmo motivo da bio: a
 * campanha vira à meia-noite e o tema vira junto.
 */
export const revalidate = 300;

/**
 * `noindex, follow`: é porta de anúncio, não resposta de busca. Muda a cada
 * campanha e não tem texto que valha uma posição no Google.
 */
export function generateMetadata(): Metadata {
  const base = buildMetadata({
    title: `Grupo de ofertas no WhatsApp | ${SITE.name}`,
    description:
      "Entre no grupo de ofertas da JK Alianças no WhatsApp: uma oferta por dia, com preço exclusivo do grupo e cupom com prazo para usar.",
    path: "/grupo",
    canonical: `${SITE.origin}/grupo`,
  });
  return { ...base, robots: { index: false, follow: true } };
}

export async function generateViewport(): Promise<Viewport> {
  const [bio, grupo] = await Promise.all([lerBio(), lerGrupo()]);
  return {
    width: "device-width",
    initialScale: 1,
    themeColor: corDaBarra(paginaDoGrupoNoDia(bio, grupo, hojeEmSaoPaulo()).tema),
  };
}

export default async function Grupo() {
  const [bio, grupo] = await Promise.all([lerBio(), lerGrupo()]);
  const dia = paginaDoGrupoNoDia(bio, grupo, hojeEmSaoPaulo());

  return (
    <>
      {/* Fundo da janela na cor do tema, como na bio. Sem `precedence`, para o
          React tirar o estilo ao sair da página. */}
      <style>{`html,body{background:${corDaBarra(dia.tema)}}`}</style>
      <PaginaDoGrupo dia={dia} cabecalho={bio.cabecalho} />
    </>
  );
}
