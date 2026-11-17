import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PIXEL_DA_JK, lerChaves } from "@/lib/leads/chaves";
import {
  ENDERECO_DA_LOJA,
  decidir,
  idDoEvento,
  trayMandandoAoMeta,
  type CliqueDoMeta,
  type Decisao,
  type EnvioJaFeito,
  type Evento,
  type PedidoParaMeta,
  type SinaisDoNavegador,
} from "./compra";

/**
 * O envio da compra da loja ao Meta pelo servidor (0120). Quem chama é a
 * rotina `/api/cron/meta-loja`, de dez em dez minutos, logo depois da leitura
 * de pedidos. A conta (o que vai, como vai) mora em `compra.ts`; aqui só se lê
 * o banco, se manda e se registra.
 *
 * Três modos, em `meta_loja_config`:
 *   - desligado: não lê nada e não manda nada;
 *   - teste: manda com o código de teste do cartão do Meta em Integrações, que
 *     o Meta mostra em "Eventos de teste" e NÃO usa nas campanhas;
 *   - ligado: manda de verdade.
 *
 * A chave é a MESMA do Lead do grupo de ofertas (`meta_capi`): o mesmo pixel e o
 * mesmo token de usuário do sistema. O código de teste NÃO: a compra tem o dela,
 * em `meta_loja_config`, para testar a compra não pôr o Lead em teste junto.
 *
 * Se a integração da Tray voltar a mandar ao Meta, a `Purchase` daqui para: a
 * Tray usa números de evento próprios e a compra contaria duas vezes. A
 * `CompraPaga` continua, porque a Tray não manda esse evento.
 */

export type ModoDaLoja = "desligado" | "teste" | "ligado";

export type ConfigDaLoja = { modo: ModoDaLoja; desde: string | null; codigoDeTeste: string | null };

export type ResultadoDoEnvio =
  | { estado: "desligado" }
  | { estado: "sem_chave"; detalhe: string }
  | {
      estado: "ok";
      modo: "teste" | "ligado";
      simulado: boolean;
      pedidos: number;
      mandados: number;
      deixados: number;
      erros: number;
      trayVoltou: boolean;
      eventos?: { pedido: number; evento: Evento; origem: string; campos: string[] }[];
    };

const VERSAO_GRAPH = "v24.0";
const PRAZO_MS = 20_000;
const LOTE = 50;

export async function lerConfigDaLoja(db: SupabaseClient): Promise<ConfigDaLoja> {
  const { data } = await db.from("meta_loja_config").select("modo, desde, codigo_de_teste").eq("id", true).maybeSingle();
  return {
    modo: ((data?.modo as ModoDaLoja) ?? "desligado"),
    desde: (data?.desde as string | null) ?? null,
    codigoDeTeste: ((data?.codigo_de_teste as string | null) || null),
  };
}

/** A Tray voltou a mandar ao Meta? Lido no mesmo endereço que o script da Tray usa na loja. */
async function trayVoltou(): Promise<boolean> {
  try {
    const r = await fetch(`${ENDERECO_DA_LOJA}/nocache/facebook-info.php`, { cache: "no-store", signal: AbortSignal.timeout(8_000) });
    if (!r.ok) return false;
    return trayMandandoAoMeta(await r.json().catch(() => null));
  } catch {
    // Sem resposta, vale o que está configurado: não dá para provar que ela voltou.
    return false;
  }
}

type LinhaDoPedido = PedidoParaMeta & { sessao: string | null };

/** Os pedidos que ainda podem gerar evento: feitos nos últimos 7 dias, ou pagos nos últimos 7. */
async function lerPedidos(db: SupabaseClient, agora: number, desde: string | null): Promise<LinhaDoPedido[]> {
  const sete = new Date(agora - 7 * 86_400_000).toISOString();
  const corte = desde && desde > sete ? desde : sete;
  const colunas = "pedido, feito_em, situacao, status_mudou_em, pagamento_em, total, valor_pago, cliente_codigo, cliente_nome, cliente_email, cliente_telefone, cidade, uf, itens, sessao";
  const [feitos, pagos] = await Promise.all([
    db.from("tray_pedidos").select(colunas).gte("feito_em", corte).order("feito_em", { ascending: true }).limit(1000),
    db.from("tray_pedidos").select(colunas).eq("situacao", "pago").gte("status_mudou_em", sete).limit(1000),
  ]);
  if (feitos.error) throw new Error(`pedidos: ${feitos.error.message}`);
  if (pagos.error) throw new Error(`pedidos pagos: ${pagos.error.message}`);
  const porNumero = new Map<number, LinhaDoPedido>();
  for (const p of [...(feitos.data ?? []), ...(pagos.data ?? [])] as LinhaDoPedido[]) porNumero.set(Number(p.pedido), { ...p, pedido: Number(p.pedido) });
  return [...porNumero.values()];
}

/** O visitante de cada pedido (pela sessão ou pela página de confirmação) e o último clique dele em anúncio do Meta. */
async function lerCliques(db: SupabaseClient, pedidos: LinhaDoPedido[]): Promise<Map<number, CliqueDoMeta>> {
  const cliques = new Map<number, CliqueDoMeta>();
  if (!pedidos.length) return cliques;
  const numeros = pedidos.map((p) => p.pedido);
  const sessoes = pedidos.map((p) => p.sessao).filter((s): s is string => Boolean(s));
  const [porPedido, porSessao] = await Promise.all([
    db.from("origem_pedidos").select("pedido, visitante").in("pedido", numeros),
    sessoes.length ? db.from("origem_sessoes").select("sessao, visitante").in("sessao", sessoes) : Promise.resolve({ data: [] as { sessao: string; visitante: string }[] }),
  ]);
  const visitanteDoPedido = new Map<number, string>();
  const visitanteDaSessao = new Map((porSessao.data ?? []).map((s) => [s.sessao as string, s.visitante as string]));
  for (const p of pedidos) {
    const v = (p.sessao && visitanteDaSessao.get(p.sessao)) || (porPedido.data ?? []).find((x) => Number(x.pedido) === p.pedido)?.visitante;
    if (v) visitanteDoPedido.set(p.pedido, v as string);
  }
  const visitantes = [...new Set(visitanteDoPedido.values())];
  if (!visitantes.length) return cliques;
  const { data } = await db
    .from("origem_toques")
    .select("visitante, clique_id, em")
    .in("visitante", visitantes)
    .eq("clique", "fbclid")
    .order("em", { ascending: false })
    .limit(2000);
  for (const p of pedidos) {
    const v = visitanteDoPedido.get(p.pedido);
    const feito = Date.parse(p.feito_em);
    // O clique que vale é o último ANTES do pedido, dentro dos 90 dias que o cookie do pixel dura.
    const clique = (data ?? []).find((t) => t.visitante === v && t.clique_id && Date.parse(t.em as string) <= feito && feito - Date.parse(t.em as string) < 90 * 86_400_000);
    if (clique) cliques.set(p.pedido, { fbclid: clique.clique_id as string, em: clique.em as string });
  }
  return cliques;
}

/**
 * Uma rodada. `simular` monta tudo e devolve o que iria, sem mandar e sem
 * gravar (nem nome de campo de cliente com valor: só a lista de campos).
 */
export async function rodarEnvioDaLoja(db: SupabaseClient, opcoes: { simular?: boolean; agora?: number } = {}): Promise<ResultadoDoEnvio> {
  const config = await lerConfigDaLoja(db);
  const simular = Boolean(opcoes.simular);
  if (config.modo === "desligado" && !simular) return { estado: "desligado" };
  const modo: "teste" | "ligado" = config.modo === "ligado" ? "ligado" : "teste";

  const chave = (await lerChaves(db)).meta_capi;
  if (!chave && !simular) return { estado: "sem_chave", detalhe: "Falta o token da API de Conversões no cartão do Meta em Integrações." };
  if (modo === "teste" && !config.codigoDeTeste && !simular) {
    return { estado: "sem_chave", detalhe: "Em teste, falta o código de Eventos de teste no cartão da compra da loja, em Integrações." };
  }

  const agora = opcoes.agora ?? Date.now();
  const desde = config.desde ? Date.parse(config.desde) : null;
  const pedidos = await lerPedidos(db, agora, config.desde);
  if (!pedidos.length) return { estado: "ok", modo, simulado: simular, pedidos: 0, mandados: 0, deixados: 0, erros: 0, trayVoltou: false };

  const numeros = pedidos.map((p) => p.pedido);
  const [feitos, sinais, cliques, voltou] = await Promise.all([
    db.from("meta_envios").select("pedido, evento, estado, tentativas").in("pedido", numeros),
    db.from("meta_sinais").select("pedido, fbp, fbc, navegador, ip").in("pedido", numeros),
    lerCliques(db, pedidos),
    trayVoltou(),
  ]);
  const jaFeitos = ((feitos.data ?? []) as EnvioJaFeito[]).map((j) => ({ ...j, pedido: Number(j.pedido) }));
  const sinaisDe = new Map(((sinais.data ?? []) as (SinaisDoNavegador & { pedido: number })[]).map((s) => [Number(s.pedido), s]));

  let decisoes: Decisao[] = pedidos.flatMap((p) =>
    decidir(p, { agora, desde, modo, sinais: sinaisDe.get(p.pedido) ?? null, clique: cliques.get(p.pedido) ?? null, jaFeitos }),
  );
  // Com a Tray mandando de novo, a Purchase daqui contaria a compra duas vezes: espera, sem gravar nada.
  if (voltou) decisoes = decisoes.filter((d) => d.evento !== "Purchase");

  const paraMandar = decisoes.filter((d): d is Extract<Decisao, { mandar: true }> => d.mandar);
  const deixados = decisoes.filter((d): d is Extract<Decisao, { mandar: false }> => !d.mandar && d.definitivo);

  if (simular) {
    return {
      estado: "ok", modo, simulado: true, pedidos: pedidos.length, mandados: paraMandar.length, deixados: deixados.length, erros: 0, trayVoltou: voltou,
      eventos: paraMandar.map((d) => ({ pedido: d.pedido, evento: d.evento, origem: d.corpo.action_source, campos: Object.keys(d.corpo.user_data).sort() })),
    };
  }

  const agoraIso = new Date(agora).toISOString();
  if (deixados.length) {
    await db.from("meta_envios").upsert(
      deixados.map((d) => ({ pedido: d.pedido, evento: d.evento, event_id: idDoEvento(d.evento, d.pedido), estado: "ignorado", motivo: d.motivo, origem: null, tentativas: 0, fbtrace: null, enviado_em: null, atualizado_em: agoraIso })),
      { onConflict: "pedido,evento" },
    );
  }

  const pixel = chave!.meta.pixel_id || PIXEL_DA_JK;
  const mandar = async (lote: Extract<Decisao, { mandar: true }>[]): Promise<{ fbtrace: string | null; erro: string | null }> => {
    const corpo: Record<string, unknown> = { data: lote.map((d) => d.corpo) };
    if (modo === "teste") corpo.test_event_code = config.codigoDeTeste;
    try {
      const r = await fetch(`https://graph.facebook.com/${VERSAO_GRAPH}/${pixel}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${chave!.valor}` },
        body: JSON.stringify(corpo),
        signal: AbortSignal.timeout(PRAZO_MS),
        cache: "no-store",
      });
      const resposta = (await r.json().catch(() => null)) as { events_received?: number; fbtrace_id?: string; error?: { message?: string; code?: number; error_user_msg?: string } } | null;
      if (!r.ok || !resposta?.events_received) {
        const msg = resposta?.error?.error_user_msg || resposta?.error?.message || "não confirmou o recebimento";
        return { fbtrace: null, erro: `Meta ${r.status}${resposta?.error?.code ? ` (${resposta.error.code})` : ""}: ${msg}`.slice(0, 300) };
      }
      return { fbtrace: resposta.fbtrace_id ?? null, erro: null };
    } catch (e) {
      return { fbtrace: null, erro: `Sem resposta do Meta: ${e instanceof Error ? e.message : String(e)}`.slice(0, 300) };
    }
  };

  const tentativas = new Map(jaFeitos.map((j) => [`${j.pedido}:${j.evento}`, j.tentativas]));
  const registrar = async (lote: Extract<Decisao, { mandar: true }>[], r: { fbtrace: string | null; erro: string | null }) => {
    const linhas = lote.map((d) => ({
      pedido: d.pedido,
      evento: d.evento,
      event_id: d.corpo.event_id,
      estado: r.erro ? "erro" : modo === "teste" ? "teste" : "enviado",
      motivo: r.erro,
      origem: d.corpo.action_source,
      tentativas: (tentativas.get(`${d.pedido}:${d.evento}`) ?? 0) + 1,
      fbtrace: r.fbtrace,
      enviado_em: r.erro ? null : agoraIso,
      atualizado_em: agoraIso,
    }));
    const { error } = await db.from("meta_envios").upsert(linhas, { onConflict: "pedido,evento" });
    if (error) console.error("[meta-loja] envio não registrado:", error.message);
  };

  let erros = 0;
  for (let i = 0; i < paraMandar.length; i += LOTE) {
    const lote = paraMandar.slice(i, i + LOTE);
    const r = await mandar(lote);
    if (!r.erro || lote.length === 1) {
      await registrar(lote, r);
      if (r.erro) erros += 1;
      continue;
    }
    // O Meta recusa o lote inteiro quando um evento está errado: um a um, só o que tem problema fica de fora.
    for (const d of lote) {
      const sozinho = await mandar([d]);
      await registrar([d], sozinho);
      if (sozinho.erro) erros += 1;
    }
  }

  return { estado: "ok", modo, simulado: false, pedidos: pedidos.length, mandados: paraMandar.length - erros, deixados: deixados.length, erros, trayVoltou: voltou };
}
