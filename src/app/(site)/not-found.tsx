import type { Metadata } from "next";
import { Pagina404 } from "@/components/erro/Pagina404";

/**
 * 404 do site público.
 *
 * Existe porque o `not-found.tsx` da raiz fica FORA do grupo (site), e por isso
 * era renderizado sem cabeçalho, sem rodapé e sem nenhuma saída além do "voltar
 * ao início". A documentação de links do Google é direta: toda página precisa
 * levar a outra, e um endereço quebrado é justamente onde a pessoa mais precisa
 * de caminho. Este arquivo herda o layout de (site), então volta a ter navegação.
 *
 * O corpo mora em `components/erro/Pagina404.tsx` porque a raiz mostra o mesmo.
 */
export const metadata: Metadata = {
  title: "Página não encontrada",
  robots: { index: false, follow: true },
};

export default function NotFoundDoSite() {
  return <Pagina404 />;
}
