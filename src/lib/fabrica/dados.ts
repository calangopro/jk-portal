import type { SupabaseClient } from "@supabase/supabase-js";
import { miniaturaDaTray } from "@/lib/catalogo/fotos";
import { lerEtapa, type Etapa } from "./etapas";

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
  pedido: number;
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
  rastreio: string | null;
  nota: string | null;
  pecas: PecaDoPedido[];
};

export type FilaDaFabrica = { dias: number; pedidos: PedidoDaFabrica[] };

const texto = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** A fila inteira da janela. `null` quando a leitura falhou. */
export async function lerFilaDaFabrica(db: SupabaseClient, dias: number): Promise<FilaDaFabrica | null> {
  const { data, error } = await db.rpc("fila_da_fabrica", { p_dias: dias });
  if (error) {
    console.error("[fabrica] fila_da_fabrica:", error.message);
    return null;
  }
  const cru = (data ?? {}) as { dias?: number; pedidos?: Record<string, unknown>[] };
  const pedidos = (cru.pedidos ?? []).map((p): PedidoDaFabrica => ({
    pedido: Number(p.pedido),
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
    rastreio: texto(p.rastreio),
    nota: texto(p.nota),
    pecas: (Array.isArray(p.pecas) ? (p.pecas as Record<string, unknown>[]) : []).map((i) => ({
      nome: texto(i.nome) ?? "Peça sem nome",
      quantidade: Number(i.quantidade) || 1,
      referencia: texto(i.referencia),
      info: texto(i.info),
      foto: texto(i.foto),
      miniatura: miniaturaDaTray(texto(i.foto)),
    })),
  }));
  return { dias: Number(cru.dias ?? dias), pedidos };
}

/**
 * Move vários pedidos de uma vez para a mesma etapa (0068). Serve para pôr a
 * fila em dia: marcar como enviado, de uma vez, o que já saiu. Pedido que não
 * está pago fica de fora e é contado em `fora`.
 */
export async function moverPedidosDaFabrica(
  db: SupabaseClient,
  a: { pedidos: number[]; etapa: Etapa },
): Promise<{ ok: true; movidos: number; fora: number } | { ok: false; erro: string }> {
  const { data, error } = await db.rpc("mover_pedidos_da_fabrica", { p_pedidos: a.pedidos, p_etapa: a.etapa });
  if (!error) {
    const r = (data ?? {}) as { movidos?: number; fora?: unknown[] };
    return { ok: true, movidos: Number(r.movidos ?? 0), fora: Array.isArray(r.fora) ? r.fora.length : 0 };
  }
  console.error("[fabrica] mover_pedidos_da_fabrica:", error.message);
  const conhecida = /fábrica|Etapa|pedidos/i.test(error.message);
  return { ok: false, erro: conhecida ? error.message : "Não deu para mover os pedidos agora. Tente de novo em alguns segundos." };
}

/**
 * Move o pedido de etapa. `rastreio` e `nota` ausentes não mexem no que está
 * gravado; texto vazio apaga.
 */
export async function moverPedidoDaFabrica(
  db: SupabaseClient,
  a: { pedido: number; etapa: Etapa; rastreio?: string; nota?: string },
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const { error } = await db.rpc("mover_pedido_da_fabrica", {
    p_pedido: a.pedido,
    p_etapa: a.etapa,
    p_rastreio: a.rastreio ?? null,
    p_nota: a.nota ?? null,
  });
  if (!error) return { ok: true };
  console.error("[fabrica] mover_pedido_da_fabrica:", error.message);
  // As mensagens da função já estão em português e são para a pessoa ler.
  const conhecida = /fábrica|Etapa|longo/i.test(error.message);
  return { ok: false, erro: conhecida ? error.message : "Não deu para mover o pedido agora. Tente de novo em alguns segundos." };
}
