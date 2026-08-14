import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Pagina404 } from "@/components/erro/Pagina404";

/**
 * 404 da raiz: responde a endereço que não casa com rota nenhuma, que é o caso
 * do link velho vindo de fora. Como fica fora do grupo (site), o cabeçalho e o
 * rodapé entram aqui na mão, senão a página cai numa tela sem navegação, que é
 * o oposto do que a documentação de links do Google pede.
 */
export const metadata: Metadata = {
  title: "Página não encontrada",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <Pagina404 />
      <SiteFooter />
    </>
  );
}
