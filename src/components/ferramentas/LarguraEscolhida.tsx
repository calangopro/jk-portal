"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

/**
 * A largura que a pessoa escolheu no simulador, para a vitrine ouvir.
 *
 * A ferramenta roda no navegador e a vitrine é servida pelo servidor, então as
 * duas viviam em mundos separados: mudar de 4 para 8 mm no simulador deixava a
 * vitrine anunciando "Alianças de 4 mm", o que faz a página parecer travada. A
 * escolha passa por aqui, e a vitrine busca as peças daquela largura.
 *
 * Fora do provedor o valor é nulo, e o simulador não perde nada: dentro de um
 * artigo ele aparece sem vitrine nenhuma embaixo.
 */
type Estado = {
  largura: number;
  definirLargura: (mm: number) => void;
};

const Contexto = createContext<Estado | null>(null);

export function LarguraEscolhidaProvider({
  larguraInicial,
  children,
}: {
  larguraInicial: number;
  children: ReactNode;
}) {
  const [largura, definirLargura] = useState(larguraInicial);
  const valor = useMemo(() => ({ largura, definirLargura }), [largura]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useLarguraEscolhida(): Estado | null {
  return useContext(Contexto);
}
