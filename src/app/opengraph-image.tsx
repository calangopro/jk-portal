import { ImageResponse } from "next/og";

// Imagem de compartilhamento padrão (aplicada a todas as rotas sem OG própria).
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "JK Alianças: guia de alianças";

export default function OpengraphImage() {
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
            color: "#9b7846",
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
    { ...size },
  );
}
