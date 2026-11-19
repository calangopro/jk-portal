"use client";

import { AvisosNoAparelho } from "../avisos/AvisosNoAparelho";

/**
 * O bloco "Aviso do sistema" da tela do chat. Desde o cartão 59 é o aviso por
 * push (`../avisos/AvisosNoAparelho.tsx`): chega com o painel fechado, no
 * computador e no celular, com o som do aparelho. A versão completa, com o
 * que avisa e os outros aparelhos, fica na tela Avisos do Time.
 */
export function AvisoDoSistema() {
  return <AvisosNoAparelho compacto />;
}
