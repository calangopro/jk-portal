import { ImageResponse } from "next/og";
import { OG_PADRAO } from "@/lib/seo/og";

/*
  Arte de compartilhamento padrão do site, servida num endereço FIXO.

  Era um `opengraph-image.tsx` de convenção, e a convenção não entrega o que
  parece entregar: o arquivo vale para o segmento onde está e **não desce** para
  os segmentos de baixo. Na raiz de `app/` ele não alcançava nem a home, porque
  as páginas vivem no grupo `(site)`; movido para dentro do grupo, passou a
  valer só para a home. Conferido no HTML do `next build`: `/dicas`, `/lojas`,
  `/ferramentas`, `/medidor-de-aliancas`, cada página de loja e cada página de
  autor saíam com `twitter:card: summary_large_image` e nenhuma imagem. Quem
  colasse o link no WhatsApp, que é o canal desse mercado, via um card cego.

  Como rota, o endereço é um só e conhecido (`/guias/og`), e quem aponta para
  ele é o `buildMetadata`, de uma vez, para o site inteiro. Ganha também
  `og:image:width`, `height` e `alt`, que a convenção só escreve quando gera a
  tag ela mesma.

  `force-static` porque a arte não depende de nada: é gerada no build e servida
  do cache dali em diante.
*/
export const dynamic = "force-static";

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px 88px",
          background:
            "radial-gradient(60% 80% at 100% 0%, #efe1c8 0%, transparent 60%), linear-gradient(135deg, #f7f3ec, #f1e6d3)",
          fontFamily: "Georgia, serif",
        }}
      >
        <div
          style={{
            display: "flex",
            color: "#84663c",
            fontSize: 26,
            letterSpacing: 10,
            fontWeight: 600,
            textTransform: "uppercase",
          }}
        >
          JK Alianças
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 26,
            maxWidth: 900,
            fontSize: 74,
            lineHeight: 1.05,
            color: "#171512",
          }}
        >
          Informação confiável para escolher a aliança certa
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 34,
            width: 132,
            height: 4,
            background: "#be9b60",
          }}
        />
        <div
          style={{
            display: "flex",
            marginTop: 30,
            fontSize: 30,
            color: "#5f594f",
            fontFamily: "Arial, sans-serif",
          }}
        >
          Fábrica própria · Guias, comparativos e lojas
        </div>
      </div>
    ),
    { width: OG_PADRAO.width, height: OG_PADRAO.height },
  );
}
