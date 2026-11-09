/**
 * Os estados de foto de um produto, com o nome que a equipe lê na tela.
 *
 * O estado mora em `produto_foto_fila` e quem o mantém é o gatilho da
 * migration 0047, a partir das fotos. Este arquivo só dá nome e cor, e vale no
 * servidor, no navegador e no conector.
 */

export const ESTADOS = ["falta", "refazer", "aguardando", "aprovada", "na_loja", "dispensada"] as const;
export type EstadoDoProduto = (typeof ESTADOS)[number];

export const TIPOS_DE_FOTO = ["principal", "ambientada", "detalhe"] as const;
export type TipoDeFoto = (typeof TIPOS_DE_FOTO)[number];

export const ESTADOS_DA_FOTO = ["aguardando", "aprovada", "recusada", "na_loja", "substituida"] as const;
export type EstadoDaFoto = (typeof ESTADOS_DA_FOTO)[number];

export const ROTULO: Record<EstadoDoProduto, string> = {
  falta: "Falta foto",
  refazer: "Refazer",
  aguardando: "Para aprovar",
  aprovada: "Aprovada",
  na_loja: "Na loja",
  dispensada: "Dispensada",
};

/** O que cada estado pede de quem olha a tela. */
export const EXPLICACAO: Record<EstadoDoProduto, string> = {
  falta: "Ainda não tem foto nova.",
  refazer: "A foto nova foi recusada. O motivo está na nota.",
  aguardando: "Tem foto nova esperando alguém aprovar.",
  aprovada: "Pronta para ir para a loja pela planilha.",
  na_loja: "A loja já mostra a foto nova.",
  dispensada: "Não precisa de foto nova.",
};

export const COR: Record<EstadoDoProduto, string> = {
  falta: "bg-ink/[0.07] text-muted",
  refazer: "bg-wine/10 text-wine",
  aguardando: "bg-brand/25 text-brand-strong",
  aprovada: "bg-brand-strong text-white",
  na_loja: "bg-emerald-100 text-emerald-800",
  dispensada: "bg-ink/[0.04] text-muted line-through decoration-muted/40",
};

/** Cor cheia do estado, para a barra de progresso e o ponto do filtro. */
export const PONTO: Record<EstadoDoProduto, string> = {
  falta: "bg-ink/20",
  refazer: "bg-wine",
  aguardando: "bg-brand",
  aprovada: "bg-brand-strong",
  na_loja: "bg-emerald-600",
  dispensada: "bg-ink/35",
};

export const ROTULO_DO_TIPO: Record<TipoDeFoto, string> = {
  principal: "Principal",
  ambientada: "Ambientada",
  detalhe: "Detalhe",
};

export const ROTULO_DA_FOTO: Record<EstadoDaFoto, string> = {
  aguardando: "Para aprovar",
  aprovada: "Aprovada",
  recusada: "Recusada",
  na_loja: "Na loja",
  substituida: "Substituída",
};

/** Conta para a barra de progresso: o que já tem foto nova resolvida. */
export const RESOLVIDO: ReadonlySet<EstadoDoProduto> = new Set(["aprovada", "na_loja", "dispensada"]);

/** Ordem de quem pega a fila: primeiro o que foi recusado (alguém já começou), depois o que falta. */
export const ESTADOS_DA_FILA: EstadoDoProduto[] = ["refazer", "falta"];
