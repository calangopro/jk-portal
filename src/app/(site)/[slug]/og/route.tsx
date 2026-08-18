import { ImageResponse } from "next/og";
import { getGuiaBySlug } from "@/lib/data/contents";
import { SITE } from "@/lib/seo/site";

/*
  Imagem de compartilhamento própria de cada guia, servida em `/<slug>/og`.

  Antes o site inteiro compartilhava a mesma arte, então um link de guia no
  WhatsApp parecia igual ao da home. Aqui a arte carrega o título real e a
  resposta rápida, que é o que faz a pessoa clicar.

  Virou rota, e não `opengraph-image.tsx` de convenção, pelo mesmo motivo da
  arte padrão em `(site)/og`: quem escreve a tag agora é o `buildMetadata`, e
  metadata declarado vence o arquivo de convenção. Deixado como convenção, este
  arquivo continuaria gerando a imagem e nenhuma página apontaria para ela.

  O endereço fica sob o slug do guia, então não disputa espaço com as páginas
  fixas da raiz e não precisa entrar em `slugs-reservados`.
*/
export const dynamic = "force-static";

export async function GET(
  _requisicao: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const guia = await getGuiaBySlug(slug);

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
    { width: 1200, height: 630 },
  );
}
