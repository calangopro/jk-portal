import type { StatusDaCampanha } from "@/lib/campanhas/estados";
export { ROTULO_DO_STATUS } from "@/lib/campanhas/estados";

export const COR_DO_STATUS: Record<StatusDaCampanha, string> = {
  rascunho: "bg-ink/[0.07] text-muted",
  em_aprovacao: "bg-brand/25 text-brand-strong",
  aprovada: "bg-emerald-100 text-emerald-800",
  encerrada: "bg-ink/[0.04] text-muted",
};

/** "2026-11-27" vira "27/11". */
export const diaMes = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");
