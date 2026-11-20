import type { SupabaseClient } from "@supabase/supabase-js";
import { miniaturaDaTray } from "@/lib/catalogo/fotos";
import { lerEtapa, lerEtapas, lerPrioridade, lerTipo, type Etapa, type EtapaDaFabrica, type Prioridade, type TipoDeTrabalho } from "./etapas";

/**
 * Leitura e escrita da fila da fábrica (0067).
 *
 * As duas pontas passam por função do banco, que confere a área `fabrica` por
 * dentro: a fábrica não tem leitura de `tray_pedidos`, que é faturamento, e
 * recebe daqui só o que precisa para produzir. Por isso o cliente usado é o da
 * pessoa logada, e não o de serviço: é a sessão dela que a função confere.
 */

export type PecaDoPedido = {
  nome: string;
  quantidade: number;
  referencia: string | null;
  info: string | null;
  /** A foto principal do produto na loja, inteira. `null` em peça que saiu do catálogo. */
  foto: string | null;
  /** A mesma foto na miniatura que a Tray gera, para a lista. */
  miniatura: string | null;
};

export type PedidoDaFabrica = {
  /**
   * Como a fábrica identifica o trabalho: o número do pedido da loja ("11389")
   * ou "v" mais o código da venda por fora (0075). É a chave de tudo na tela.
   */
  ref: string;
  /** De onde veio: pedido pago na loja, venda fechada por fora ou OS aberta à mão (troca, polimento..., 0192). */
  origem: "loja" | "por_fora" | "avulso";
  /** Na OS aberta à mão, o pedido da loja de onde ela veio (a troca do pedido tal). */
  pedidoOrigem: number | null;
  /** Os pedidos de alteração do cliente (0192). Os sem `cienteEm` deixam o cartão em vermelho. */
  alteracoes: AlteracaoDaFabrica[];
  /** O número do pedido na loja. `null` em venda por fora. */
  pedido: number | null;
  /** Código da ordem de serviço (0191): o número grande da fábrica. `null` em pedido antigo que ninguém tocou. */
  os: number | null;
  tipo: TipoDeTrabalho;
  prioridade: Prioridade;
  /** Data em que o cliente precisa da peça, `AAAA-MM-DD`. */
  prazo: string | null;
  /** Dia do pedido, `AAAA-MM-DD`. */
  dia: string;
  feitoEm: string;
  /** O status que a Tray mostra ("A ENVIAR", "ENVIADO"). */
  statusDaLoja: string | null;
  etapa: Etapa;
  /** Quando entrou na etapa atual. `null` em pedido que ninguém moveu ainda. */
  etapaEm: string | null;
  movidoPor: string | null;
  cliente: string | null;
  cidade: string | null;
  uf: string | null;
  entrega: string | null;
  /** Endereço de entrega. Só vem em venda por fora que não é retirada em loja. */
  endereco: string | null;
  /** Primeiro nome de quem vendeu, em venda por fora: é a quem a fábrica pergunta. */
  vendedor: string | null;
  rastreio: string | null;
  nota: string | null;
  pecas: PecaDoPedido[];
  /** O negócio da Kommo de onde a venda por fora veio (cartão 51, 0176). `null` no resto. */
  kommo: number | null;
  /** A venda saiu de "Venda ganha" na Kommo depois de entrar na fila: a fábrica confere com quem vendeu. */
  desfeitoNaKommo: boolean;
};

export type AlteracaoDaFabrica = { id: number; texto: string; em: string; por: string | null; cienteEm: string | null; cientePor: string | null };

export type FilaDaFabrica = {
  dias: number;
  /** A pessoa move, marca e dá ciência (área `fabrica`). Quem vende lê a fila sem mover. */
  podeMover: boolean;
  /** As etapas da tabela `fabrica_etapas`, na ordem, inclusive as desligadas. */
  etapas: EtapaDaFabrica[];
  pedidos: PedidoDaFabrica[];
};

const texto = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** A fila inteira da janela. `null` quando a leitura falhou. */
export async function lerFilaDaFabrica(db: SupabaseClient, dias: number): Promise<FilaDaFabrica | null> {
  const { data, error } = await db.rpc("fila_da_fabrica", { p_dias: dias });
  if (error) {
    console.error("[fabrica] fila_da_fabrica:", error.message);
    return null;
  }
  const cru = (data ?? {}) as { dias?: number; pode_mover?: boolean; etapas?: unknown; pedidos?: Record<string, unknown>[] };
  const pedidos = (cru.pedidos ?? []).map((p): PedidoDaFabrica => ({
    ref: texto(p.ref) ?? String(p.pedido ?? ""),
    origem: p.origem === "por_fora" ? "por_fora" : p.origem === "avulso" ? "avulso" : "loja",
    pedidoOrigem: p.pedido_origem === null || p.pedido_origem === undefined || !Number.isFinite(Number(p.pedido_origem)) ? null : Number(p.pedido_origem),
    alteracoes: (Array.isArray(p.alteracoes) ? (p.alteracoes as Record<string, unknown>[]) : []).map((a) => ({
      id: Number(a.id),
      texto: texto(a.texto) ?? "",
      em: String(a.em ?? ""),
      por: texto(a.por),
      cienteEm: texto(a.ciente_em),
      cientePor: texto(a.ciente_por),
    })),
    pedido: p.pedido === null || p.pedido === undefined ? null : Number(p.pedido),
    os: p.os === null || p.os === undefined || !Number.isFinite(Number(p.os)) ? null : Number(p.os),
    tipo: lerTipo(p.tipo),
    prioridade: lerPrioridade(p.prioridade),
    prazo: typeof p.prazo === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.prazo) ? p.prazo : null,
    dia: String(p.dia ?? ""),
    feitoEm: String(p.feito_em ?? ""),
    statusDaLoja: texto(p.status_da_loja),
    etapa: lerEtapa(p.etapa) ?? "a_produzir",
    etapaEm: texto(p.etapa_em),
    movidoPor: texto(p.movido_por),
    cliente: texto(p.cliente),
    cidade: texto(p.cidade),
    uf: texto(p.uf),
    entrega: texto(p.entrega),
    endereco: texto(p.endereco),
    vendedor: texto(p.vendedor),
    rastreio: texto(p.rastreio),
    nota: texto(p.nota),
    kommo: p.kommo === null || p.kommo === undefined || !Number.isFinite(Number(p.kommo)) ? null : Number(p.kommo),
    desfeitoNaKommo: p.desfeito_na_kommo === true,
    pecas: (Array.isArray(p.pecas) ? (p.pecas as Record<string, unknown>[]) : []).map((i) => ({
      nome: texto(i.nome) ?? "Peça sem nome",
      quantidade: Number(i.quantidade) || 1,
      referencia: texto(i.referencia),
      info: texto(i.info),
      foto: texto(i.foto),
      miniatura: miniaturaDaTray(texto(i.foto)),
    })),
  }));
  return { dias: Number(cru.dias ?? dias), podeMover: cru.pode_mover === true, etapas: lerEtapas(cru.etapas), pedidos };
}

/**
 * A referência de um trabalho da fábrica: número de pedido da loja, "v" mais
 * o código da venda por fora ou "a" mais o da OS aberta à mão (0192). Conferida antes de ir ao banco.
 */
export const REF_DA_FABRICA = /^(?:[0-9]{1,12}|[va][0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

/**
 * Move vários pedidos de uma vez para a mesma etapa (0068, por referência desde a 0075). Serve para pôr a
 * fila em dia: marcar como enviado, de uma vez, o que já saiu. Pedido que não
 * está pago fica de fora e é contado em `fora`.
 */
export async function moverPedidosDaFabrica(
  db: SupabaseClient,
  a: { refs: string[]; etapa: Etapa },
): Promise<{ ok: true; movidos: number; fora: number } | { ok: false; erro: string }> {
  const { data, error } = await db.rpc("mover_varios_na_fabrica", { p_refs: a.refs, p_etapa: a.etapa });
  if (!error) {
    const r = (data ?? {}) as { movidos?: number; fora?: unknown[] };
    return { ok: true, movidos: Number(r.movidos ?? 0), fora: Array.isArray(r.fora) ? r.fora.length : 0 };
  }
  console.error("[fabrica] mover_varios_na_fabrica:", error.message);
  const conhecida = /fábrica|Etapa|pedidos/i.test(error.message);
  return { ok: false, erro: conhecida ? error.message : "Não deu para mover os pedidos agora. Tente de novo em alguns segundos." };
}

/**
 * Move o pedido de etapa. `rastreio` e `nota` ausentes não mexem no que está
 * gravado; texto vazio apaga.
 */
export async function moverPedidoDaFabrica(
  db: SupabaseClient,
  a: { ref: string; etapa: Etapa; rastreio?: string; nota?: string },
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const { error } = await db.rpc("mover_na_fabrica", {
    p_ref: a.ref,
    p_etapa: a.etapa,
    p_rastreio: a.rastreio ?? null,
    p_nota: a.nota ?? null,
  });
  if (!error) return { ok: true };
  console.error("[fabrica] mover_na_fabrica:", error.message);
  // As mensagens da função já estão em português e são para a pessoa ler.
  const conhecida = /fábrica|Etapa|longo|venda|Pedido/i.test(error.message);
  return { ok: false, erro: conhecida ? error.message : "Não deu para mover o pedido agora. Tente de novo em alguns segundos." };
}

/**
 * Tipo, prioridade e prazo de um trabalho (0191). Campo ausente não mexe;
 * `semPrazo` apaga o prazo.
 */
export async function marcarTrabalhoDaFabrica(
  db: SupabaseClient,
  a: { ref: string; tipo?: TipoDeTrabalho; prioridade?: Prioridade; prazo?: string; semPrazo?: boolean },
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const { error } = await db.rpc("fabrica_marcar", {
    p_ref: a.ref,
    p_tipo: a.tipo ?? null,
    p_prioridade: a.prioridade ?? null,
    p_prazo: a.prazo ?? null,
    p_sem_prazo: a.semPrazo === true,
  });
  if (!error) return { ok: true };
  console.error("[fabrica] fabrica_marcar:", error.message);
  const conhecida = /fábrica|Tipo|Prioridade|Prazo|venda|Pedido/i.test(error.message);
  return { ok: false, erro: conhecida ? error.message : "Não deu para guardar agora. Tente de novo em alguns segundos." };
}

/** As etapas, para a tela de editar. `null` quando a pessoa não vê a fábrica ou a leitura falhou. */
export async function lerEtapasDaFabrica(db: SupabaseClient): Promise<(EtapaDaFabrica & { trabalhos: number })[] | null> {
  const { data, error } = await db.rpc("fabrica_etapas_lista");
  if (error || !Array.isArray(data)) {
    if (error) console.error("[fabrica] fabrica_etapas_lista:", error.message);
    return null;
  }
  const contagem = new Map((data as Record<string, unknown>[]).map((e) => [String(e.chave), Number(e.trabalhos) || 0]));
  return lerEtapas(data).map((e) => ({ ...e, trabalhos: contagem.get(e.chave) ?? 0 }));
}

/**
 * Grava a lista inteira de etapas, na ordem (0191). Só diretoria e gerente: a
 * função do banco confere. Etapa sem chave é nova.
 */
export async function salvarEtapasDaFabrica(
  db: SupabaseClient,
  etapas: { chave: string | null; nome: string; frase: string | null; cor: string; ativa: boolean }[],
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const { error } = await db.rpc("fabrica_etapas_salvar", { p_etapas: etapas });
  if (!error) return { ok: true };
  console.error("[fabrica] fabrica_etapas_salvar:", error.message);
  const conhecida = /etapa|Etapa|gerente|Cor|travessão|Mande/i.test(error.message);
  return { ok: false, erro: conhecida ? error.message : "Não deu para guardar as etapas agora. Tente de novo em alguns segundos." };
}

const erroDaFuncao = (nome: string, msg: string, padrao: string) => {
  console.error(`[fabrica] ${nome}:`, msg);
  // As mensagens das funções da fábrica já estão em português e são para a pessoa ler.
  return /acesso|Diga|Escreva|Tipo|Prioridade|prazo|Telefone|pedido|OS|alteração|peças/i.test(msg) ? msg : padrao;
};

export type OsParaAbrir = {
  tipo: TipoDeTrabalho;
  prioridade: Prioridade;
  prazo: string | null;
  pedidoOrigem: number | null;
  clienteNome: string | null;
  clienteTelefone: string | null;
  relato: string | null;
  pecas: { nome: string; quantidade: number; info: string | null; produto_tray_id: string | null }[];
  entrega: string | null;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
  loja?: string | null;
  numeroPapel?: string | null;
};

/** Abre uma OS à mão (0192): troca, refazer, ajuste, upgrade, polimento ou serviço. */
export async function abrirOsDaFabrica(db: SupabaseClient, os: OsParaAbrir): Promise<{ ok: true; ref: string; os: number } | { ok: false; erro: string }> {
  const { data, error } = await db.rpc("fabrica_abrir_os", {
    p: {
      tipo: os.tipo, prioridade: os.prioridade, prazo: os.prazo, pedido_origem: os.pedidoOrigem,
      cliente_nome: os.clienteNome, cliente_telefone: os.clienteTelefone, relato: os.relato, pecas: os.pecas,
      entrega: os.entrega, endereco: os.endereco, cidade: os.cidade, uf: os.uf, loja: os.loja ?? null, numero_papel: os.numeroPapel ?? null,
    },
  });
  if (error) return { ok: false, erro: erroDaFuncao("fabrica_abrir_os", error.message, "Não deu para abrir a OS agora. Tente de novo em alguns segundos.") };
  const r = (data ?? {}) as { ref?: string; os?: number };
  return { ok: true, ref: String(r.ref ?? ""), os: Number(r.os) };
}

/** O cliente pediu uma mudança depois de o pedido ir para a fábrica (0192). */
export async function pedirAlteracaoNaFabrica(db: SupabaseClient, ref: string, texto: string): Promise<{ ok: true } | { ok: false; erro: string }> {
  const { error } = await db.rpc("fabrica_pedir_alteracao", { p_ref: ref, p_texto: texto });
  if (error) return { ok: false, erro: erroDaFuncao("fabrica_pedir_alteracao", error.message, "Não deu para mandar a alteração agora. Tente de novo em alguns segundos.") };
  return { ok: true };
}

/** A fábrica viu a alteração (0192). */
export async function darCienciaNaFabrica(db: SupabaseClient, id: number): Promise<{ ok: true } | { ok: false; erro: string }> {
  const { error } = await db.rpc("fabrica_ciente", { p_id: id });
  if (error) return { ok: false, erro: erroDaFuncao("fabrica_ciente", error.message, "Não deu para marcar agora. Tente de novo em alguns segundos.") };
  return { ok: true };
}

export type ResumoDaFabrica = {
  dias: number;
  entradas: number;
  retrabalho: number;
  porTipo: Record<string, number>;
  saidas: number;
  saidasPorDia: { dia: string; saidas: number }[];
  /** Quanto cada etapa segura um trabalho, medido entre dois movimentos (0193). */
  tempos: { etapa: string; vezes: number; mediaS: number; medianaS: number }[];
};

/** O histórico da fábrica para a gestão (0193). `null` sem acesso ou na falha. */
export async function lerResumoDaFabrica(db: SupabaseClient, dias: number): Promise<ResumoDaFabrica | null> {
  const { data, error } = await db.rpc("fabrica_resumo", { p_dias: dias });
  if (error || !data) {
    if (error) console.error("[fabrica] fabrica_resumo:", error.message);
    return null;
  }
  const r = data as Record<string, unknown>;
  const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  return {
    dias: n(r.dias),
    entradas: n(r.entradas),
    retrabalho: n(r.retrabalho),
    porTipo: Object.fromEntries(Object.entries((r.por_tipo ?? {}) as Record<string, unknown>).map(([k, v]) => [k, n(v)])),
    saidas: n(r.saidas),
    saidasPorDia: (Array.isArray(r.saidas_por_dia) ? (r.saidas_por_dia as Record<string, unknown>[]) : []).map((x) => ({ dia: String(x.dia), saidas: n(x.saidas) })),
    tempos: (Array.isArray(r.tempos) ? (r.tempos as Record<string, unknown>[]) : []).map((x) => ({ etapa: String(x.etapa), vezes: n(x.vezes), mediaS: n(x.media_s), medianaS: n(x.mediana_s) })),
  };
}
