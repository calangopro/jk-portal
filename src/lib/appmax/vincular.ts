import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clienteDaLoja } from "@/lib/tray/lojas";
import { appmaxDoPedido, type VinculoComAppmax } from "./liquido";

/**
 * Liga o pedido da Tray ao pedido da Appmax (`appmax_pedidos`, 0205).
 *
 * Dois caminhos, o mesmo resultado:
 *   1. a rotina de pedidos da Tray entrega, junto de cada pedido completo que
 *      lê, o número da Appmax (`guardarVinculos`), sem uma chamada a mais;
 *   2. `vincularPedidosPagos` anda pelos pedidos pagos dos últimos dias que
 *      ainda não têm vínculo e pede cada um à Tray, para o histórico. É o
 *      que se chama pela rota com `{"vincular": dias}`.
 *
 * Nunca derruba quem chama: o vínculo é um acréscimo, e a leitura de pedidos
 * da Tray não pode falhar por causa dele.
 */

export type VinculoDeUmPedido = VinculoComAppmax & { pedido: number };

export async function guardarVinculos(db: SupabaseClient, vinculos: VinculoDeUmPedido[]): Promise<number> {
  if (vinculos.length === 0) return 0;
  const linhas = vinculos.map((v) => ({ pedido: v.pedido, appmax_id: v.id, meio: v.meio, parcelas: v.parcelas }));
  try {
    const { error } = await db.from("appmax_pedidos").upsert(linhas, { onConflict: "pedido", ignoreDuplicates: true });
    if (error) {
      console.error("[appmax] vínculo:", error.message);
      return 0;
    }
    return linhas.length;
  } catch (e) {
    console.error("[appmax] vínculo:", e);
    return 0;
  }
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
const diaDeSaoPaulo = (diasAtras: number) => new Date(Date.now() - diasAtras * 86_400_000).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

export type ResultadoDoVinculo = { estado: "ok"; vistos: number; vinculados: number; sem_appmax: number; restam: number } | { estado: "nao_autorizada" } | { estado: "erro"; mensagem: string };

/** Pagos dos últimos `dias` dias, pagos pela Appmax, ainda sem vínculo. Até `maximo` por chamada. */
export async function vincularPedidosPagos(db: SupabaseClient, opcoes: { dias: number; maximo?: number }): Promise<ResultadoDoVinculo> {
  const cliente = await clienteDaLoja(db, "jk");
  if (!cliente) return { estado: "nao_autorizada" };
  const dias = Math.min(Math.max(Math.round(opcoes.dias), 1), 120);
  const maximo = Math.min(Math.max(Math.round(opcoes.maximo ?? 60), 1), 100);

  const { data: pagos, error } = await db
    .from("tray_pedidos")
    .select("pedido")
    .eq("situacao", "pago")
    .ilike("pagamento_tipo", "%appmax%")
    .gte("dia", diaDeSaoPaulo(dias))
    .order("pedido", { ascending: false })
    .limit(2000);
  if (error) return { estado: "erro", mensagem: error.message };

  const numeros = (pagos ?? []).map((p) => Number(p.pedido));
  const ja = new Set<number>();
  for (let i = 0; i < numeros.length; i += 500) {
    const { data } = await db.from("appmax_pedidos").select("pedido").in("pedido", numeros.slice(i, i + 500));
    for (const l of data ?? []) ja.add(Number(l.pedido));
  }
  const faltam = numeros.filter((n) => !ja.has(n));
  const fila = faltam.slice(0, maximo);

  const achados: VinculoDeUmPedido[] = [];
  let semAppmax = 0;
  for (const n of fila) {
    await esperar(350);
    try {
      const completo = await cliente.pedidoCompleto(String(n));
      const v = appmaxDoPedido(completo);
      if (v) achados.push({ pedido: n, ...v });
      else semAppmax++;
    } catch (e) {
      return { estado: "erro", mensagem: e instanceof Error ? e.message : "A Tray não respondeu." };
    }
  }
  const vinculados = await guardarVinculos(db, achados);
  return { estado: "ok", vistos: fila.length, vinculados, sem_appmax: semAppmax, restam: Math.max(faltam.length - fila.length, 0) };
}
