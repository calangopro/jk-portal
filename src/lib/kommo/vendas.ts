/**
 * Venda ganha na Kommo entra no painel (cartão 47, migration 0165).
 *
 * Arquivo PURO (sem banco, sem rede e sem importar função de outro arquivo):
 * serve à rodada (`vendas-rodada.ts`), à tela e ao teste
 * (`npm run verificar:kommo-vendas`).
 *
 * A regra inteira mora em `decidir`: dado um negócio do espelho e o que o
 * painel já fez com ele (`kommo_vendas`), diz o que fazer agora. Quem executa
 * é o banco (`kommo_venda_aplicar`), sempre pelas portas que já existem:
 * `pedido_marcar_vendedor` (o "Fui eu que vendi"), `registrar_venda_avulsa`
 * (com as travas de duplicidade) e `estornar_venda_avulsa`.
 *
 * O que a conta de verdade mostrou (18/11/2026) e decide o desenho: a etapa 142
 * existe em TODO funil, com nomes diferentes. No funil de SAC ela é
 * "Resolvido", e nos funis de PDV e PÓS VENDAS o negócio chega depois da venda
 * (Lançamento, Boas-Vindas, NPS); no PDV do Grand Plaza a 143 é "FINALIZADO".
 * Por isso só o ganho num funil DE VENDA (WHATS e RECUPERAÇÃO) vira venda, e o
 * negócio que sai do ganho para um funil de pós-venda seguiu o caminho dele,
 * não foi desfeito.
 */

export const ETAPA_GANHO = 142;
export const ETAPA_PERDIDO = 143;

/**
 * Funil de venda pelo nome: tem WHATS ou RECUPERAÇÃO e não é pós-venda, SAC
 * nem PDV. A MESMA expressão está em `kommo_vendas_candidatos` (0165): mudou
 * uma, muda a outra (o teste confere o texto).
 */
export const FUNIL_DE_VENDA = /(whats|recupera)/i;
export const FUNIL_DE_POS_VENDA = /(p[oó]s|sac|pdv)/i;

export function funilDeVenda(nome: string | null | undefined): boolean {
  const n = nome ?? "";
  return FUNIL_DE_VENDA.test(n) && !FUNIL_DE_POS_VENDA.test(n);
}

/** Dias que o painel espera o pedido citado no negócio chegar da loja antes de pedir conferência. */
export const DIAS_ESPERANDO_O_PEDIDO = 3;

/**
 * O "Pedido Tray" como o vendedor digitou vira número. Pontos e espaços entre
 * dígitos somem ("11.779" é 11779); sobra um grupo de dígitos só, com 4 a 9
 * dígitos. Dois números diferentes no campo é ambíguo, e ambíguo não vira
 * palpite.
 */
export function normalizarPedido(texto: string | null | undefined): { numero: number } | { ambiguo: true } | null {
  if (!texto) return null;
  const limpo = texto.replace(/(\d)[.\s](?=\d)/g, "$1");
  const grupos = [...new Set(limpo.match(/\d+/g) ?? [])].filter((g) => g.length >= 4 && g.length <= 9);
  if (grupos.length === 0) return null;
  if (grupos.length > 1) return { ambiguo: true };
  return { numero: Number(grupos[0]) };
}

export type Forma = "pix" | "link_de_pagamento" | "cartao" | "dinheiro" | "outro";

/** "Método de pagamento" da Kommo (Fatura, Pagamento com cartão, Dinheiro, Pix, TROCA) para a forma do painel. */
export function formaDoMetodo(metodo: string | null | undefined): Forma {
  const m = semAcento(metodo ?? "");
  if (/\bpix\b/.test(m)) return "pix";
  if (/cartao|credito|debito/.test(m)) return "cartao";
  if (/dinheiro|especie/.test(m)) return "dinheiro";
  if (/link/.test(m)) return "link_de_pagamento";
  return "outro";
}

export type Canal = "whatsapp" | "loja_fisica" | "recuperacao" | "outro";

/** O canal da venda por fora pelo funil: RECUPERAÇÃO é recuperação; o resto dos funis de venda é WhatsApp. */
export function canalDoFunil(nome: string | null | undefined): Canal {
  const n = semAcento(nome ?? "");
  if (/recupera/.test(n)) return "recuperacao";
  if (/whats/.test(n)) return "whatsapp";
  return "outro";
}

/** Troca, conserto e ajuste não são venda nova: vão para a conferência, não para o faturamento. */
export function pareceServico(metodo: string | null | undefined, motivoDaCompra: string | null | undefined): boolean {
  return /\btroca\b/.test(semAcento(metodo ?? "")) || /\b(troca|conserto|ajuste)\b/.test(semAcento(motivoDaCompra ?? ""));
}

export type Campo = { id: number; nome: string | null; codigo: string | null; valor: string };

/** O primeiro campo com esse nome (sem acento e sem caixa). Existem dois "Produto": vale o primeiro preenchido. */
export function campoPeloNome(campos: Campo[] | null | undefined, nome: string): string | null {
  const alvo = semAcento(nome);
  for (const c of campos ?? []) {
    if (semAcento(c.nome ?? "") === alvo && c.valor?.trim()) return c.valor.trim();
  }
  return null;
}

/** O negócio como `kommo_vendas_candidatos` devolve. */
export type Candidato = {
  negocio_id: number;
  nome: string | null;
  valor: number | null;
  funil: string | null;
  etapa_id: number | null;
  apagado: boolean;
  existe: boolean;
  fechado_em: string | null;
  pedido_tray: string | null;
  motivo_compra: string | null;
  campos: Campo[];
  responsavel_id: number | null;
  papel: string | null;
  profile_id: string | null;
  pode_vender: boolean;
  /** O que o painel já fez (null quando nunca viu este negócio). */
  estado: Estado | null;
  motivo: Motivo | null;
  ganho_em: string | null;
};

export type Estado = "aguardando_pedido" | "conferir" | "marcada" | "registrada" | "desfeita" | "ignorada";

export const MOTIVOS = {
  sem_vendedor: "Responsável na Kommo sem pessoa do painel (ou é o usuário de uma loja)",
  vendedor_sem_acesso: "O vendedor do mapa não lança venda no painel",
  sem_valor: "Ganho sem valor na Kommo",
  servico: "Parece troca, conserto ou ajuste, não venda nova",
  repetida: "Parece a mesma venda já lançada no painel",
  ja_na_loja: "Parece um pedido já pago na loja",
  sem_telefone: "Venda antiga sem telefone: não deu para conferir com a loja",
  fora_do_prazo: "Data da venda fora do prazo que o painel aceita",
  pedido_ambiguo: "O campo Pedido Tray tem mais de um número",
  pedido_nao_encontrado: "O Pedido Tray citado não chegou ao painel",
  pedido_de_outro: "O pedido já está marcado como venda de outra pessoa",
  desfeito_marcado: "Saiu do ganho na Kommo, e o pedido continua marcado como venda do vendedor",
  desfeito_estorno: "Saiu do ganho na Kommo, e a venda por fora precisa de estorno da gerência",
  erro: "O painel não conseguiu registrar",
} as const;

export type Motivo = keyof typeof MOTIVOS;

/** Motivos que a rodada tenta de novo sozinha (a Kommo ou o mapa podem ter mudado). Os outros esperam a gerência. */
export const MOTIVOS_QUE_ANDAM_SOZINHOS: Motivo[] = ["sem_vendedor", "vendedor_sem_acesso", "sem_valor", "pedido_ambiguo", "erro"];

export type Dados = { forma: Forma; canal: Canal; produto: string | null };

export type Acao =
  | { tipo: "nada" }
  | { tipo: "marcar"; pedido: number; vendedor: string; dados: Dados }
  | { tipo: "registrar"; vendedor: string; dados: Dados }
  | { tipo: "conferir"; motivo: Motivo; pedido: number | null; vendedor: string | null; dados: Dados }
  | { tipo: "desfazer" };

const ATIVO: Estado[] = ["marcada", "registrada"];

/** Está em ganho num funil de venda (o que conta como venda). */
export function emGanhoDeVenda(c: Pick<Candidato, "existe" | "apagado" | "etapa_id" | "funil">): boolean {
  return c.existe && !c.apagado && c.etapa_id === ETAPA_GANHO && funilDeVenda(c.funil);
}

/**
 * Saiu do ganho: apagado, sumiu do espelho, ou voltou para uma etapa (aberta ou
 * perdida) de um funil de venda. Passar para um funil de pós-venda, SAC ou PDV
 * é o caminho normal depois da venda, e não desfaz nada.
 */
export function saiuDoGanho(c: Pick<Candidato, "existe" | "apagado" | "etapa_id" | "funil">): boolean {
  if (!c.existe || c.apagado) return true;
  if (!funilDeVenda(c.funil)) return false;
  return c.etapa_id !== ETAPA_GANHO;
}

function diasEntre(de: string, ate: string): number {
  return (Date.parse(ate) - Date.parse(de)) / 86_400_000;
}

/** O que fazer agora com um negócio. `agora` em ISO. */
export function decidir(c: Candidato, agora: string): Acao {
  const ativo = c.estado !== null && ATIVO.includes(c.estado);

  if (saiuDoGanho(c)) {
    // Desfaz o que o painel registrou, e fecha o que estava esperando. O que nunca foi visto não tem o que desfazer.
    if (c.estado === null || c.estado === "desfeita" || c.estado === "ignorada") return { tipo: "nada" };
    if (c.estado === "conferir" && (c.motivo === "desfeito_marcado" || c.motivo === "desfeito_estorno")) return { tipo: "nada" };
    return { tipo: "desfazer" };
  }
  if (!emGanhoDeVenda(c)) return { tipo: "nada" };

  // O dinheiro conta uma vez só: o que já entrou não entra de novo.
  if (ativo || c.estado === "ignorada") return { tipo: "nada" };
  // Conferência que só gente resolve fica parada até a gerência.
  if (c.estado === "conferir" && c.motivo && !MOTIVOS_QUE_ANDAM_SOZINHOS.includes(c.motivo) && c.motivo !== "pedido_nao_encontrado") {
    return { tipo: "nada" };
  }

  const dados: Dados = {
    forma: formaDoMetodo(campoPeloNome(c.campos, "Método de pagamento")),
    canal: canalDoFunil(c.funil),
    produto: campoPeloNome(c.campos, "Produto")?.slice(0, 300) ?? null,
  };
  const vendedor = c.papel === "loja" || !c.profile_id ? null : c.profile_id;
  const pedido = normalizarPedido(c.pedido_tray);

  if (pedido && "ambiguo" in pedido) return { tipo: "conferir", motivo: "pedido_ambiguo", pedido: null, vendedor, dados };
  if (!vendedor) return { tipo: "conferir", motivo: "sem_vendedor", pedido: pedido?.numero ?? null, vendedor: null, dados };
  if (!c.pode_vender) return { tipo: "conferir", motivo: "vendedor_sem_acesso", pedido: pedido?.numero ?? null, vendedor, dados };

  if (pedido) {
    // O pedido pago pela loja carrega o valor: o negócio sem valor também marca.
    // Se o pedido ainda não chegou ao painel, o banco põe em espera (`aguardando_pedido`).
    return { tipo: "marcar", pedido: pedido.numero, vendedor, dados };
  }

  if (pareceServico(campoPeloNome(c.campos, "Método de pagamento"), c.motivo_compra)) {
    return { tipo: "conferir", motivo: "servico", pedido: null, vendedor, dados };
  }
  if (!c.valor || c.valor <= 0) return { tipo: "conferir", motivo: "sem_valor", pedido: null, vendedor, dados };
  return { tipo: "registrar", vendedor, dados };
}

/**
 * O pedido citado ainda não está no painel (a loja é lida de dez em dez
 * minutos). Espera até `DIAS_ESPERANDO_O_PEDIDO` desde o ganho; depois pede
 * conferência. Quem chama é o banco, com a mesma conta.
 */
export function esperaOuConfere(ganhoEm: string | null, agora: string): "esperar" | "conferir" {
  if (!ganhoEm) return "esperar";
  return diasEntre(ganhoEm, agora) >= DIAS_ESPERANDO_O_PEDIDO ? "conferir" : "esperar";
}

/** Link do negócio na Kommo. */
export function linkDoNegocio(id: number): string {
  return `https://kathleengfz.kommo.com/leads/detail/${id}`;
}

function semAcento(t: string): string {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

// ---------------------------------------------------------------------------
// A tela (`/admin/vendas-da-kommo`): o que `kommo_vendas_lista` devolve.
// ---------------------------------------------------------------------------

export type VendaDaKommo = {
  negocio_id: number;
  negocio: string | null;
  cliente: string | null;
  funil: string | null;
  estado: Estado;
  pedido: number | null;
  dia: string | null;
  vendedor_id: string | null;
  vendedor: string | null;
  /** Só chega para quem vê o faturamento, ou na venda da própria pessoa. */
  valor: number | null;
  motivo_desfeito: string | null;
  link: string;
};

export type NaFila = {
  negocio_id: number;
  negocio: string | null;
  cliente: string | null;
  funil: string | null;
  motivo: Motivo;
  pedido: number | null;
  pedido_tray: string | null;
  dia: string | null;
  responsavel: string | null;
  vendedor_id: string | null;
  vendedor: string | null;
  valor: number | null;
  erro: string | null;
  parecida_com: string | null;
  tem_venda: boolean;
  link: string;
};

export type ListaDaKommo = {
  pode: { resolver: boolean; ver_valor: boolean };
  vendas: VendaDaKommo[];
  fila: NaFila[];
  resumo: { marcadas: number; registradas: number; desfeitas: number; esperando_pedido: number; na_fila: number; valor: number | null };
  vendedores: { id: string; nome: string }[];
  desde: string | null;
};

const num = (v: unknown): number | null => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));

export function lerListaDaKommo(data: unknown): ListaDaKommo | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const pode = (d.pode ?? {}) as Record<string, unknown>;
  const resumo = (d.resumo ?? {}) as Record<string, unknown>;
  const lista = <T,>(v: unknown, f: (x: Record<string, unknown>) => T): T[] => (Array.isArray(v) ? v.map((x) => f((x ?? {}) as Record<string, unknown>)) : []);
  return {
    pode: { resolver: pode.resolver === true, ver_valor: pode.ver_valor === true },
    vendas: lista(d.vendas, (x) => ({
      negocio_id: Number(x.negocio_id),
      negocio: (x.negocio as string) ?? null,
      cliente: (x.cliente as string) ?? null,
      funil: (x.funil as string) ?? null,
      estado: x.estado as Estado,
      pedido: num(x.pedido),
      dia: (x.dia as string) ?? null,
      vendedor_id: (x.vendedor_id as string) ?? null,
      vendedor: (x.vendedor as string) ?? null,
      valor: num(x.valor),
      motivo_desfeito: (x.motivo_desfeito as string) ?? null,
      link: linkDoNegocio(Number(x.negocio_id)),
    })),
    fila: lista(d.fila, (x) => ({
      negocio_id: Number(x.negocio_id),
      negocio: (x.negocio as string) ?? null,
      cliente: (x.cliente as string) ?? null,
      funil: (x.funil as string) ?? null,
      motivo: (x.motivo as Motivo) ?? "erro",
      pedido: num(x.pedido),
      pedido_tray: (x.pedido_tray as string) ?? null,
      dia: (x.dia as string) ?? null,
      responsavel: (x.responsavel as string) ?? null,
      vendedor_id: (x.vendedor_id as string) ?? null,
      vendedor: (x.vendedor as string) ?? null,
      valor: num(x.valor),
      erro: (x.erro as string) ?? null,
      parecida_com: (x.parecida_com as string) ?? null,
      tem_venda: x.tem_venda === true,
      link: linkDoNegocio(Number(x.negocio_id)),
    })),
    resumo: {
      marcadas: Number(resumo.marcadas) || 0,
      registradas: Number(resumo.registradas) || 0,
      desfeitas: Number(resumo.desfeitas) || 0,
      esperando_pedido: Number(resumo.esperando_pedido) || 0,
      na_fila: Number(resumo.na_fila) || 0,
      valor: num(resumo.valor),
    },
    vendedores: lista(d.vendedores, (x) => ({ id: String(x.id), nome: String(x.nome ?? "Sem nome") })),
    desde: (d.desde as string) ?? null,
  };
}

export type AcaoDaGerencia = "lancar" | "marcar_pedido" | "estornar" | "ignorar";

/** O que a gerência pode fazer com cada motivo da fila. O banco confere de novo (`kommo_venda_resolver`). */
export function acoesDoMotivo(m: Motivo): AcaoDaGerencia[] {
  switch (m) {
    case "desfeito_estorno":
      return ["estornar", "ignorar"];
    case "desfeito_marcado":
      return ["ignorar"];
    case "ja_na_loja":
    case "pedido_de_outro":
    case "pedido_nao_encontrado":
      return ["marcar_pedido", "lancar", "ignorar"];
    case "sem_vendedor":
    case "vendedor_sem_acesso":
      return ["lancar", "marcar_pedido", "ignorar"];
    case "sem_valor":
    case "pedido_ambiguo":
      return ["marcar_pedido", "ignorar"];
    default:
      return ["lancar", "ignorar"];
  }
}

export const NOME_DA_ACAO: Record<AcaoDaGerencia, string> = {
  lancar: "Lançar como venda por fora",
  marcar_pedido: "Marcar o pedido",
  estornar: "Estornar a venda",
  ignorar: "Tirar da fila",
};

export const NOME_DO_ESTADO: Record<Estado, string> = {
  aguardando_pedido: "Esperando o pedido chegar",
  conferir: "Na conferência",
  marcada: "Pedido do site marcado",
  registrada: "Venda por fora lançada",
  desfeita: "Desfeita na Kommo",
  ignorada: "Tirada da fila",
};
