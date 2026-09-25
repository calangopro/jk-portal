import { Medicao } from "@/components/analytics/Medicao";
import { RastreioCliques } from "@/components/analytics/RastreioCliques";
import { OrigemDaBio } from "@/components/bio/OrigemDaBio";

/**
 * Moldura do link da bio.
 *
 * Grupo próprio, fora de `(site)`, porque a bio NÃO leva o cabeçalho nem o
 * rodapé do site: quem chega do Instagram quer ver oferta e produto na primeira
 * tela, e um menu de portal editorial em cima disso só empurra a venda para
 * baixo. A medição é a mesma do site (GTM e GA4 na mesma propriedade da loja),
 * e é isso que mantém a sessão do Instagram viva até a compra.
 *
 * `OrigemDaBio` vem ANTES de tudo: ele descobre de onde a pessoa veio e deixa
 * pronto para o GA4, que só carrega depois da página.
 */
export default function BioLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <OrigemDaBio />
      {children}
      <Medicao />
      <RastreioCliques />
    </>
  );
}
