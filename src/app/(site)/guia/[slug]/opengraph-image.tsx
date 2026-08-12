import { ImageResponse } from "next/og";
import { getGuiaBySlug } from "@/lib/data/contents";
import { SITE } from "@/lib/seo/site";

/**
 * Imagem de compartilhamento própria de cada guia.
 *
 * Antes o site inteiro compartilhava a mesma arte, então um link de guia no
 * WhatsApp parecia igual ao da home. Aqui a arte carrega o título real e a
 * resposta rápida, que é o que faz a pessoa clicar.
 */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Guia da JK Alianças";

export default async function OgDoGuia({
  params,
}: {
  params: { slug: string };
}) {
  const guia = await getGuiaBySlug(params.slug);

  const titulo = guia?.title ?? "Guia de alianças";
  // A resposta rápida é o melhor resumo que existe, e já foi escrita para ser
  // autossuficiente. Cortamos numa frase para não estourar a arte.
  const resumo = (guia?.answer ?? guia?.excerpt ?? SITE.description)
    .split(/(?<=[.!?])\s/)[0]
    .slice(0, 150);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background:
            "radial-gradient(60% 80% at 100% 0%, #efe1c8 0%, transparent 60%), linear-gradient(135deg, #f7f3ec, #f1e6d3)",
          fontFamily: "Georgia, serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              color: "#84663c",
              fontSize: 24,
              letterSpacing: 9,
              fontWeight: 600,
              textTransform: "uppercase",
            }}
          >
            Guia JK Alianças
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 24,
              maxWidth: 1000,
              fontSize: titulo.length > 60 ? 62 : 74,
              lineHeight: 1.05,
              color: "#171512",
            }}
          >
            {titulo}
          </div>

          <div style={{ display: "flex", marginTop: 28, width: 120, height: 4, background: "#be9b60" }} />
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 28,
            lineHeight: 1.35,
            color: "#5f594f",
            fontFamily: "Arial, sans-serif",
            maxWidth: 1000,
          }}
        >
          {resumo}
        </div>
      </div>
    ),
    { ...size },
  );
}
