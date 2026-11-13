import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TrayCliente } from "@/lib/tray/cliente";
import { LOJAS, PROVEDOR_DO_APLICATIVO, clienteDaLoja, type Loja } from "@/lib/tray/lojas";
import { compararComOBanco, pedidoDaApi, ultimaAlteracao, type LinhaDoBanco } from "./tray-api";
import { situacaoDoStatus, type ItemDoPedido, type PedidoDaTray } from "./tray-csv";

/**
 * Pedidos da Tray lidos pela API, sem depender de ninguém exportar arquivo.
 *
 * COMO LÊ. A lista de pedidos aceita `modified` (alterado a partir de um
 * instante, com hora) e `sort=modified_asc`. Cada rodada pede o que mudou desde
 * o último instante lido, do mais antigo para o mais novo, busca o pedido
 * completo de cada um (a lista não traz hora, cliente nem pagamento) e guarda o
 * instante do último como ponto de partida da próxima. Pedido novo e pedido que
 * mudou de status chegam pelo mesmo caminho, então não existe "reimportar os
 * últimos trinta dias" como na exportação.
 *
 * DOIS MODOS.
 *   conferir  lê e COMPARA com o que as exportações já gravaram. Não grava
 *             nada. É o que se roda antes de ligar a gravação.
 *   gravar    grava pela MESMA função das exportações (`importar_pedidos_tray`).
 *             Só existe para a loja da JK: pedido da loja de testes nunca entra
 *             em `tray_pedidos`, e a trava é aqui, não em quem chama.
 *
 * O QUE A API NÃO TRAZ é a origem do pedido (UTM Source). Ver `tray-api.ts`.
 *
 * LIMITE. A Tray aceita 180 chamadas por minuto e 10 mil por dia, por loja. Uma
 * rodada custa uma chamada por página de 50 mais uma por pedido, e para em
 * `MAXIMO_POR_RODADA`: o que sobrar fica para a seguinte, a partir do mesmo
 * ponto.
 */

export const FONTE_DA_API = "tray_pedidos_api";
export const MAXIMO_POR_RODADA = 150;
const POR_PAGINA = 50;
const JUNTOS = 4;
/** De quantos dias atrás a primeira leitura parte: é a janela em que um pedido ainda muda de status. */
const DIAS_DA_PRIMEIRA_LEITURA = 35;

type PedidoComItens = PedidoDaTray & { itens: ItemDoPedido[] };

/** `AAAA-MM-DD HH:MM:SS` no relógio de São Paulo, que é como a Tray escreve e filtra `modified`. */
export function instanteDaTray(d: Date): string {
  return d.toLocaleString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

export type Leitura = {
  pedidos: PedidoComItens[];
  /** Quantos a Tray diz que mudaram desde o ponto de partida. */
  total: number;
  /** Quantos desta rodada vieram num formato que não deu para ler. */
  semFormato: number;
  /** O instante de alteração do último pedido lido: ponto de partida da próxima rodada. */
  ate: string | null;
};

export async function lerPedidosDaApi(cliente: TrayCliente, desde: string, maximo = MAXIMO_POR_RODADA): Promise<Leitura> {
  const lista: Record<string, unknown>[] = [];
  let total = 0;
  for (let pagina = 1; lista.length < maximo; pagina++) {
    const r = await cliente.paginaDePedidos({ modified: desde, sort: "modified_asc", limit: POR_PAGINA, page: pagina });
    total = r.total;
    lista.push(...r.pedidos);
    if (r.pedidos.length < POR_PAGINA) break;
  }
  const fila = lista.slice(0, maximo);

  // Poucos de cada vez: o limite da Tray é por minuto, e quatro juntos ficam longe dele.
  const completos: Record<string, unknown>[] = new Array(fila.length);
  let proximo = 0;
  await Promise.all(
    Array.from({ length: Math.min(JUNTOS, fila.length) }, async () => {
      while (proximo < fila.length) {
        const i = proximo++;
        completos[i] = await cliente.pedidoCompleto(String(fila[i].id));
      }
    }),
  );

  const pedidos = completos.map((c) => pedidoDaApi(c, situacaoDoStatus)).filter((p): p is PedidoComItens => p !== null);
  return { pedidos, total, semFormato: fila.length - pedidos.length, ate: ultimaAlteracao(fila) };
}

export type ResultadoDaApi =
  | { estado: "nao_autorizada"; mensagem: string }
  | { estado: "recusada"; mensagem: string }
  | { estado: "erro"; mensagem: string }
  | { estado: "conferido"; desde: string; mudaram: number; comparacao: ReturnType<typeof compararComOBanco> }
  | { estado: "ok"; desde: string; ate: string | null; lidos: number; novos: number; mudaram: number; restam: number };

type Meta = { api_address?: string; code?: string; autorizada_em?: string; pedidos_ate?: string; pedidos_lidos_em?: string };

async function lerMeta(db: SupabaseClient, provedor: string): Promise<Meta> {
  const { data } = await db.from("integration_tokens").select("meta").eq("provider", provedor).maybeSingle();
  return (data?.meta ?? {}) as Meta;
}

export async function sincronizarPedidosDaTray(
  db: SupabaseClient,
  opcoes: { loja: Loja["chave"]; modo: "gravar" | "conferir"; dias?: number; maximo?: number },
): Promise<ResultadoDaApi> {
  const loja = LOJAS.find((l) => l.chave === opcoes.loja);
  if (!loja) return { estado: "recusada", mensagem: "Loja desconhecida." };
  if (opcoes.modo === "gravar" && loja.chave !== "jk") {
    return { estado: "recusada", mensagem: "Só os pedidos da loja da JK são gravados. A loja de testes serve para conferir." };
  }
  const cliente = await clienteDaLoja(db, loja.chave);
  if (!cliente) return { estado: "nao_autorizada", mensagem: `O aplicativo ainda não foi autorizado na loja ${loja.nome}.` };

  const maximo = Math.min(Math.max(Math.round(opcoes.maximo ?? MAXIMO_POR_RODADA), 1), MAXIMO_POR_RODADA);
  const diasAtras = (n: number) => instanteDaTray(new Date(Date.now() - n * 86_400_000));

  if (opcoes.modo === "conferir") {
    const desde = diasAtras(Math.min(Math.max(Math.round(opcoes.dias ?? 2), 1), DIAS_DA_PRIMEIRA_LEITURA));
    try {
      const lido = await lerPedidosDaApi(cliente, desde, maximo);
      const numeros = lido.pedidos.map((p) => p.pedido);
      const { data, error } = numeros.length
        ? await db.from("tray_pedidos").select("pedido, status, situacao, total, utm_source").in("pedido", numeros)
        : { data: [], error: null };
      if (error) return { estado: "erro", mensagem: error.message };
      const comparacao = compararComOBanco(lido.pedidos, (data ?? []) as LinhaDoBanco[]);
      return { estado: "conferido", desde, mudaram: lido.total, comparacao: { ...comparacao, diferencas: comparacao.diferencas.slice(0, 60) } };
    } catch (e) {
      return { estado: "erro", mensagem: e instanceof Error ? e.message : "A leitura falhou." };
    }
  }

  const inicio = new Date();
  const meta = await lerMeta(db, loja.provedor);
  const desde = meta.pedidos_ate ?? diasAtras(DIAS_DA_PRIMEIRA_LEITURA);
  let resultado: ResultadoDaApi;
  let lidos = 0;
  try {
    const lido = await lerPedidosDaApi(cliente, desde, maximo);
    let novos = 0;
    let mudaram = 0;
    for (let i = 0; i < lido.pedidos.length; i += 100) {
      const { data, error } = await db.rpc("importar_pedidos_tray", { p_pedidos: lido.pedidos.slice(i, i + 100) });
      if (error) throw new Error(error.message);
      const r = data as { lidos: number; novos: number; mudaram: number };
      lidos += r.lidos;
      novos += r.novos;
      mudaram += r.mudaram;
    }
    // O ponto de partida só anda depois de tudo gravado. A linha é relida antes,
    // porque a renovação do token pode ter mexido nela no meio do caminho.
    const atual = await lerMeta(db, loja.provedor);
    await db
      .from("integration_tokens")
      .update({ meta: { ...atual, pedidos_ate: lido.ate ?? desde, pedidos_lidos_em: new Date().toISOString() } })
      .eq("provider", loja.provedor);
    resultado = { estado: "ok", desde, ate: lido.ate, lidos, novos, mudaram, restam: Math.max(lido.total - lido.pedidos.length - lido.semFormato, 0) };
  } catch (e) {
    resultado = { estado: "erro", mensagem: e instanceof Error ? e.message : "A leitura falhou." };
  }

  // Rodada sem pedido nenhum não vira linha: de dez em dez minutos, encheria o registro de nada.
  if (resultado.estado === "erro" || lidos > 0) {
    await db.from("sync_logs").insert({
      source: FONTE_DA_API,
      operation: "ler_pedidos",
      status: resultado.estado === "ok" ? "success" : "error",
      attempted: lidos,
      succeeded: resultado.estado === "ok" ? lidos : 0,
      failed: 0,
      error: resultado.estado === "erro" ? resultado.mensagem : null,
      payload: resultado.estado === "ok" ? { desde, ate: resultado.ate, novos: resultado.novos, mudaram: resultado.mudaram, restam: resultado.restam } : { desde },
      started_at: inicio.toISOString(),
      finished_at: new Date().toISOString(),
    });
  }
  return resultado;
}

export type EstadoDaApiDePedidos = {
  /** As chaves do aplicativo estão no servidor ou no banco. */
  aplicativo: boolean;
  autorizadaEm: string | null;
  lidaEm: string | null;
  problema: string | null;
};

/** O que a tela de Integrações mostra sobre a leitura de pedidos da loja da JK. */
export async function lerEstadoDaApiDePedidos(db: SupabaseClient): Promise<EstadoDaApiDePedidos> {
  const loja = LOJAS.find((l) => l.chave === "jk")!;
  const [meta, { data: aplicativo }, { data: ultima }] = await Promise.all([
    lerMeta(db, loja.provedor),
    db.from("integration_tokens").select("provider").eq("provider", PROVEDOR_DO_APLICATIVO).maybeSingle(),
    db.from("sync_logs").select("status, error").eq("source", FONTE_DA_API).order("finished_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  return {
    aplicativo: Boolean(aplicativo) || Boolean(process.env.TRAY_CONSUMER_KEY && process.env.TRAY_CONSUMER_SECRET),
    autorizadaEm: meta.code && meta.api_address ? (meta.autorizada_em ?? null) : null,
    lidaEm: meta.pedidos_lidos_em ?? null,
    problema: ultima && ultima.status !== "success" ? ((ultima.error as string | null) ?? "A última leitura falhou.") : null,
  };
}
