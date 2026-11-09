/**
 * Os estados de foto de um produto, com o nome que a equipe lê na tela.
 *
 * O estado mora em `produto_foto_fila` e quem o mantém é o gatilho da
 * migration 0047, a partir das fotos. Este arquivo só dá nome e cor, e vale no
 * servidor, no navegador e no conector.
 */

export const ESTADOS = ["falta", "refazer", "aguardando", "aprovada", "na_loja", "dispensada"] as const;
export type EstadoDoProduto = (typeof ESTADOS)[number];

/** A sequência da loja: 1 produto, 2 face, 3 uso (mãos, busto ou orelha). */
export const TIPOS_DE_FOTO = ["produto", "face", "uso"] as const;
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
  produto: "1 Produto",
  face: "2 Face",
  uso: "3 Em uso",
};

export const ROTULO_DA_FOTO: Record<EstadoDaFoto, string> = {
  aguardando: "Para aprovar",
  aprovada: "Aprovada",
  recusada: "Recusada",
  na_loja: "Na loja",
  substituida: "Substituída",
};

/**
 * Onde a peça aparece na foto 3 (uso), pela categoria e pelo nome. Namoro e
 * compromisso vão na mão direita no Brasil; casamento, na esquerda.
 */
export function cenaDeUso(nome: string, categoria: string): string {
  const t = `${nome} ${categoria}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (t.includes("caixinha") || t.includes("porta joia")) return "Sem foto de uso: só produto e face.";
  if (t.includes("brinco")) return "Orelha de perfil, cabelo preso, pele natural.";
  if (t.includes("colar") || t.includes("gargantilha") || t.includes("corrente") || t.includes("pingente") || t.includes("conjunto")) {
    return "Busto: pescoço e colo, roupa clara e lisa, sem o rosto inteiro.";
  }
  if (t.includes("tornozeleira")) return "Tornozelo, pele natural, fundo claro.";
  if (t.includes("pulseira")) return "Pulso feminino apoiado em superfície clara.";
  if (t.includes("alianca")) {
    const lado = t.includes("casamento") && !t.includes("namoro") ? "esquerdas" : "direitas";
    return `Mãos ${lado} do casal sobre mármore branco ou linho branco. Kit com solitário: o solitário no mesmo dedo dela.`;
  }
  if (t.includes("anel") || t.includes("aneis") || t.includes("solitario")) return "Mão feminina sobre mármore branco ou linho branco.";
  return "A peça em uso, em cena limpa e clara, com luz natural.";
}

/** Conta para a barra de progresso: o que já tem foto nova resolvida. */
export const RESOLVIDO: ReadonlySet<EstadoDoProduto> = new Set(["aprovada", "na_loja", "dispensada"]);

/** Ordem de quem pega a fila: primeiro o que foi recusado (alguém já começou), depois o que falta. */
export const ESTADOS_DA_FILA: EstadoDoProduto[] = ["refazer", "falta"];
