import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { lerLiquido } from "./liquido";
import { ErroDaAppmax, lerCredencial, pedirLiquido, pedirToken } from "./cliente";

/**
 * Lê da Appmax o que foi descontado de cada pedido pago que ainda não foi lido
 * (`appmax_pendentes`, 0205) e grava em `appmax_pedidos`. De dez em dez
 * minutos, pela rota `/api/cron/appmax`.
 *
 * Poucos de cada vez e em pequenos grupos: quem sobra fica para a rodada
 * seguinte. Pedido que a Appmax não reconhece (404) ou que vem num formato que
 * não dá para ler conta uma tentativa e, na quinta, deixa de ser perguntado.
 */

const MAXIMO_POR_RODADA = 40;
const JUNTOS = 3;

export type ResultadoDaLeitura =
  | { estado: "sem_chave" }
  | { estado: "recusada"; mensagem: string }
  | { estado: "ok"; lidos: number; com_erro: number };

export async function lerLiquidosDaAppmax(db: SupabaseClient, opcoes: { maximo?: number } = {}): Promise<ResultadoDaLeitura> {
  const cred = await lerCredencial(db);
  if (!cred) return { estado: "sem_chave" };

  let token: string;
  try {
    token = await pedirToken(cred.clientId, cred.clientSecret);
  } catch (e) {
    return { estado: "recusada", mensagem: e instanceof Error ? e.message : "A Appmax recusou o acesso." };
  }

  const maximo = Math.min(Math.max(Math.round(opcoes.maximo ?? MAXIMO_POR_RODADA), 1), 200);
  const { data, error } = await db.rpc("appmax_pendentes", { p_limite: maximo });
  if (error) return { estado: "recusada", mensagem: error.message };
  const fila = (data ?? []) as { pedido: number; appmax_id: number }[];

  let lidos = 0;
  let comErro = 0;
  let proximo = 0;

  const falhou = async (pedido: number, motivo: string) => {
    comErro++;
    const { data: atual } = await db.from("appmax_pedidos").select("tentativas").eq("pedido", pedido).maybeSingle();
    await db
      .from("appmax_pedidos")
      .update({ tentativas: (atual?.tentativas ?? 0) + 1, ultimo_erro: motivo.slice(0, 200) })
      .eq("pedido", pedido);
  };

  await Promise.all(
    Array.from({ length: Math.min(JUNTOS, fila.length) }, async () => {
      while (proximo < fila.length) {
        const item = fila[proximo++];
        try {
          const r = await pedirLiquido(token, item.appmax_id);
          if (r.status === 401 || r.status === 403) {
            await falhou(item.pedido, `A Appmax recusou a leitura (${r.status}).`);
            continue;
          }
          if (r.status === 404) {
            await falhou(item.pedido, "A Appmax não reconhece este pedido nesta conta.");
            continue;
          }
          const l = r.status === 200 ? lerLiquido(r.corpo) : null;
          if (!l) {
            await falhou(item.pedido, `Resposta ${r.status} da Appmax sem o líquido do pedido.`);
            continue;
          }
          const { error: erroDeGravacao } = await db
            .from("appmax_pedidos")
            .update({
              total_pedido: l.totalPedido,
              liquido: l.liquido,
              descontado: l.descontado,
              taxa_processamento: l.taxaProcessamento,
              taxa_gateway: l.taxaGateway,
              taxa_parcelamento: l.taxaParcelamento,
              outras_taxas: l.outras,
              taxas: l.taxas,
              lido_em: new Date().toISOString(),
              ultimo_erro: null,
            })
            .eq("pedido", item.pedido);
          if (erroDeGravacao) {
            await falhou(item.pedido, erroDeGravacao.message);
            continue;
          }
          lidos++;
        } catch (e) {
          await falhou(item.pedido, e instanceof ErroDaAppmax || e instanceof Error ? e.message : "Falha ao ler.");
        }
      }
    }),
  );

  return { estado: "ok", lidos, com_erro: comErro };
}
