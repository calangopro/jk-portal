import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Fila de recuperação: quem criou pedido na loja, não pagou e não voltou.
 *
 * A conta é da função `fila_de_recuperacao` (0054), refeita a cada leitura em
 * cima de `tray_pedidos`. Ela roda com os direitos de quem chama, então o
 * cliente passado aqui tem que ser o da sessão: fora do papel de administrador
 * a fila vem vazia.
 */

export type Fase = "a_recuperar" | "em_contato" | "recuperado" | "pago_por_fora" | "descartado";

/** O que a equipe pode gravar. "recuperado" não entra: quem decide é o pedido pago. */
export const ESTADOS = ["a_recuperar", "em_contato", "pago_por_fora", "descartado"] as const;
export type Estado = (typeof ESTADOS)[number];

export type Caso = {
  /** Pedido não pago mais recente do cliente, que é onde a decisão fica presa. */
  pedido: number;
  tentativas: number;
  primeira: string;
  ultima: string;
  maior_valor: number;
  /** Valor que vale para a fase: o maior pedido tentado, o pago depois ou o recebido por fora. */
  valor: number;
  cliente: string | null;
  telefone: string | null;
  email: string | null;
  cidade: string | null;
  uf: string | null;
  status: string;
  /** Ainda dentro do prazo de pagamento na Tray. */
  aguardando: boolean;
  pagamento: string | null;
  origem: string;
  itens: string | null;
  pago_pedido: number | null;
  pago_valor: number | null;
  pago_em: string | null;
  nota: string | null;
  valor_fora: number | null;
  estado_em: string | null;
  /** Primeiro nome de quem marcou o caso ou registrou a venda por fora. */
  quem: string | null;
  fase: Fase;
};

export type FilaDeRecuperacao = {
  dias: number;
  resumo: Partial<Record<Fase, { clientes: number; valor: number }>>;
  casos: Caso[];
};

export const JANELAS = [7, 14, 30] as const;
export type Janela = (typeof JANELAS)[number];

export function lerJanela(v: string | undefined): Janela {
  const n = Number(v);
  return (JANELAS as readonly number[]).includes(n) ? (n as Janela) : 14;
}

export const MOTIVOS_DE_DESCARTE = [
  "Não quis mais",
  "Não respondeu",
  "Comprou em outro lugar",
  "Pedido de teste ou repetido",
  "Outro motivo",
] as const;

/** Erro do banco vira `null`, e a tela diz que não deu para ler. */
export async function lerFilaDeRecuperacao(db: SupabaseClient, dias: Janela): Promise<FilaDeRecuperacao | null> {
  const { data, error } = await db.rpc("fila_de_recuperacao", { p_dias: dias });
  if (error) {
    console.error("[recuperacao] fila_de_recuperacao:", error.message);
    return null;
  }
  const fila = (data ?? {}) as Partial<FilaDeRecuperacao>;
  return { dias: fila.dias ?? dias, resumo: fila.resumo ?? {}, casos: fila.casos ?? [] };
}
