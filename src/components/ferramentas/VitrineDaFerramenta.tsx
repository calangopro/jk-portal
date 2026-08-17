import { produtosPorLargura } from "@/lib/data/produtos";
import { VitrineDaLargura } from "./VitrineDaLargura";

/**
 * Peças reais como saída do simulador de largura.
 *
 * Ferramenta sem saída entretém e não converte. O preço é o sincronizado da
 * Tray, e produto sem preço não aparece: a regra do projeto é nunca anunciar
 * valor que possa estar velho.
 *
 * Aqui é só a PRIMEIRA vitrine, a que vai no HTML servido: 4 mm, a largura com
 * mais peças no catálogo hoje. Quem mexer no simulador vê a vitrine trocar de
 * largura pelo navegador, sem a página virar dinâmica, e essa parte mora em
 * `VitrineDaLargura`.
 */
export const LARGURA_DE_ENTRADA = 4;

export async function VitrineDaFerramenta({ className = "" }: { className?: string }) {
  const produtos = await produtosPorLargura(LARGURA_DE_ENTRADA, 4);
  if (produtos.length === 0) return null;

  return (
    <VitrineDaLargura
      larguraInicial={LARGURA_DE_ENTRADA}
      produtosIniciais={produtos}
      className={className}
    />
  );
}
