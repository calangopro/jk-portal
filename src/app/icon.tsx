import { ImageResponse } from "next/og";

// Favicon gerado: monograma "JK" dourado sobre carvão (identidade da marca).
//
// 96x96 porque a documentação do Google pede favicon quadrado, maior que 48px e
// múltiplo de 48 (o Google redimensiona para 48). Estava em 64, que é maior que
// 48 mas não é múltiplo, e força uma reamostragem que borra o monograma.
export const size = { width: 96, height: 96 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #211d18, #100e0c)",
          color: "#d8b877",
          fontSize: 51,
          fontWeight: 600,
          fontFamily: "Georgia, serif",
          letterSpacing: -1.5,
        }}
      >
        JK
      </div>
    ),
    { ...size },
  );
}
