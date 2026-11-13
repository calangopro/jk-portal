import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Cobertura, OrigemDosPedidos, SaudeDoColetor } from "./anotado";

/**
 * Leitura da origem anotada pelo coletor (0064). As duas funções do banco
 * rodam com os direitos de quem chama: sem as áreas de tráfego e de vendas,
 * vem tudo zerado. `null` quando a leitura falhou.
 */

const numeros = <T extends Record<string, unknown>>(o: T): T =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v])) as T;

export async function lerOrigemDosPedidos(db: SupabaseClient, de: string, ate: string): Promise<OrigemDosPedidos | null> {
  const { data, error } = await db.rpc("origem_dos_pedidos", { p_de: de, p_ate: ate });
  if (error) {
    console.error("[origem] origem_dos_pedidos:", error.message);
    return null;
  }
  const r = (data ?? {}) as Partial<OrigemDosPedidos>;
  if (!r.cobertura) return null;
  return {
    cobertura: numeros(r.cobertura as Cobertura),
    por_canal: (r.por_canal ?? []).map((c) => ({ ...c, criados: Number(c.criados), pagos: Number(c.pagos), valor: Number(c.valor) })),
    por_item: (r.por_item ?? []).map((i) => ({ ...i, criados: Number(i.criados), pagos: Number(i.pagos), valor: Number(i.valor) })),
  };
}

export async function lerSaudeDoColetor(db: SupabaseClient): Promise<SaudeDoColetor | null> {
  const { data, error } = await db.rpc("saude_do_coletor");
  if (error) {
    console.error("[origem] saude_do_coletor:", error.message);
    return null;
  }
  const r = (data ?? {}) as Partial<SaudeDoColetor>;
  return {
    ultima_chegada: r.ultima_chegada ?? null,
    ultima_sessao: r.ultima_sessao ?? null,
    chegadas_24h: Number(r.chegadas_24h ?? 0),
    chegadas_7d: Number(r.chegadas_7d ?? 0),
    visitantes_7d: Number(r.visitantes_7d ?? 0),
    com_codigo_de_anuncio_7d: Number(r.com_codigo_de_anuncio_7d ?? 0),
    sessoes_7d: Number(r.sessoes_7d ?? 0),
    pedidos_vistos_7d: Number(r.pedidos_vistos_7d ?? 0),
    por_canal_7d: (r.por_canal_7d ?? []).map((c) => ({ canal: String(c.canal), chegadas: Number(c.chegadas) })),
  };
}
