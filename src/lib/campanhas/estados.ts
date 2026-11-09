/** Estados de campanha com o nome da tela. Vale no servidor e no navegador. */

export const STATUS = ["rascunho", "em_aprovacao", "aprovada", "encerrada"] as const;
export type StatusDaCampanha = (typeof STATUS)[number];

export const ROTULO_DO_STATUS: Record<StatusDaCampanha, string> = {
  rascunho: "Rascunho",
  em_aprovacao: "Esperando aprovação",
  aprovada: "Aprovada",
  encerrada: "Encerrada",
};
