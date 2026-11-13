import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { lerContaDeServico, tokenDeAcesso } from "../search-console/conta";
import { somarDias } from "../vendas/periodo";
import { completarDias, lerInsightsDoMeta, lerLotesDoGoogle, type DiaDeGasto } from "./leitura";

/**
 * Leitura do gasto de anúncio direto nas plataformas, pela API de cada uma.
 *
 * META. API de Marketing, com um token de usuário do sistema que tenha acesso
 * à conta de anúncios e a permissão `ads_read` ou `ads_management` (a segunda
 * inclui a leitura). Este arquivo só LÊ, com qualquer um dos dois. O token mora em
 * `integration_tokens` (provedor `meta_ads`), colado em Integrações, e nunca
 * volta para a tela. Vai no cabeçalho, não no endereço, para não parar em log.
 *
 * GOOGLE ADS. A mesma conta de serviço do Search Console e do GA4, com o
 * escopo de anúncios. Desde setembro de 2026 a API não pede mais token de
 * desenvolvedor nem conta gerenciadora: o nível de acesso é do PROJETO no
 * Google Cloud, e a conta de serviço entra como usuária da conta de anúncios
 * pela própria tela do Google Ads. Faltando um dos dois, a API responde 403, e
 * `mensagemDoGoogle` diz qual.
 *
 * Os números das contas não são segredo e ficam aqui, como o da propriedade do
 * GA4 fica em `ga4/visitas.ts`.
 */

/** Conta de anúncios "JK Alianças 01", do portfólio 198105640840402. */
export const CONTA_DO_META = "358230285200771";
/** Conta "JK ALIANÇA" no Google Ads (135-588-7754), sem os hífens. */
export const CLIENTE_DO_GOOGLE_ADS = "1355887754";

const VERSAO_GRAPH = "v24.0";
/** A API do Google Ads aposenta versão em cerca de um ano. A v26 saiu em outubro de 2026. */
const VERSAO_GOOGLE_ADS = "v26";
const ESCOPO_GOOGLE_ADS = "https://www.googleapis.com/auth/adwords";

export const PROVEDOR_META_ADS = "meta_ads";

export type Plataforma = "meta" | "google";

export type ResultadoDaLeitura = {
  plataforma: Plataforma;
  estado: "ok" | "sem_acesso" | "erro";
  /** Dias gravados e quanto somam, quando deu certo. */
  dias?: number;
  gasto?: number;
  /** O que falta ou o que a plataforma respondeu. */
  mensagem?: string;
};

type ErroDoMeta = { error?: { message?: string; code?: number; error_subcode?: number } };

function mensagemDoMeta(corpo: ErroDoMeta, status: number): string {
  const e = corpo.error;
  if (e?.code === 190) return "O Meta recusou o token: ele venceu ou foi revogado. Gere outro no usuário do sistema e cole em Integrações.";
  if (e?.code === 200 || e?.code === 10 || e?.code === 3) {
    return "O token não alcança a conta de anúncios. Ele precisa da permissão ads_read ou ads_management, e o usuário do sistema precisa ter a conta JK Alianças 01 atribuída.";
  }
  if (e?.code === 100) return `O Meta não achou a conta de anúncios ${CONTA_DO_META} com esse token.`;
  if (e?.code === 4 || e?.code === 17 || e?.code === 80000) return "O Meta limitou as chamadas agora. A próxima leitura tenta de novo.";
  return `O Meta respondeu ${status}${e?.message ? `: ${e.message.slice(0, 200)}` : ""}.`;
}

/**
 * Uma lista da conta de anúncios do Meta, página por página. `caminho` é o que
 * vem depois de `act_<conta>/` ("insights", "ads"). O teto de páginas existe
 * para um erro de paginação não virar laço.
 */
export async function listarNoMeta(token: string, caminho: string, parametros: Record<string, string>, paginas = 10): Promise<unknown[]> {
  const url = new URL(`https://graph.facebook.com/${VERSAO_GRAPH}/act_${CONTA_DO_META}/${caminho}`);
  for (const [k, v] of Object.entries(parametros)) url.searchParams.set(k, v);

  const linhas: unknown[] = [];
  let proxima: string | null = url.toString();
  for (let pagina = 0; proxima && pagina < paginas; pagina++) {
    const r: Response = await fetch(proxima, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });
    const corpo = (await r.json().catch(() => ({}))) as ErroDoMeta & { data?: unknown[]; paging?: { next?: string } };
    if (!r.ok || corpo.error) throw new Error(mensagemDoMeta(corpo, r.status));
    linhas.push(...(corpo.data ?? []));
    proxima = corpo.paging?.next ?? null;
  }
  return linhas;
}

export async function buscarGastoDoMeta(token: string, de: string, ate: string): Promise<DiaDeGasto[]> {
  const linhas = await listarNoMeta(token, "insights", {
    level: "account",
    fields: "spend,impressions,clicks",
    time_increment: "1",
    time_range: JSON.stringify({ since: de, until: ate }),
    limit: "100",
  });
  return lerInsightsDoMeta(linhas);
}

/** O token do Meta salvo em Integrações, ou vazio. Cliente de serviço. */
export async function tokenDoMeta(db: SupabaseClient): Promise<string> {
  const { data } = await db.from("integration_tokens").select("access_token").eq("provider", PROVEDOR_META_ADS).maybeSingle();
  return (data?.access_token as string | null) ?? "";
}

type ErroDoGoogle = {
  error?: { message?: string; status?: string; details?: { errors?: { errorCode?: Record<string, string>; message?: string }[]; reason?: string }[] };
};

function mensagemDoGoogle(corpo: ErroDoGoogle, status: number, email: string): string {
  const e = corpo.error;
  const texto = `${e?.message ?? ""} ${JSON.stringify(e?.details ?? [])}`;
  if (/SERVICE_DISABLED|has not been used in project|is disabled/i.test(texto)) {
    return "A API do Google Ads ainda não está ativada no projeto jk-portal-509621 do Google Cloud. Ative em APIs e serviços, Biblioteca, Google Ads API.";
  }
  if (/TEST_ACCOUNT|only approved for use with test accounts|ACCESS_LEVEL|NOT_APPROVED/i.test(texto)) {
    return "O projeto no Google Cloud só tem acesso a contas de teste. Peça o acesso Explorer na página da Google Ads API, no Cloud Console: a aprovação costuma ser automática.";
  }
  if (/USER_PERMISSION_DENIED|CUSTOMER_NOT_FOUND|NOT_ADS_USER|doesn't have permission/i.test(texto)) {
    return `A conta de serviço ainda não é usuária da conta de anúncios. No Google Ads: Administrador, Acesso e segurança, Usuários, e adicione ${email} com acesso Somente leitura.`;
  }
  if (/CUSTOMER_NOT_ENABLED/i.test(texto)) return "A conta do Google Ads está desativada ou ainda não terminou o cadastro.";
  return `O Google Ads respondeu ${status}${e?.message ? `: ${e.message.slice(0, 220)}` : ""}.`;
}

/**
 * Abre a sessão do Google Ads uma vez e devolve a função que roda consultas
 * (GAQL). O token de acesso vale uma hora e serve para todas as consultas da
 * mesma rodada.
 */
export async function abrirGoogleAds(): Promise<(consulta: string) => Promise<unknown>> {
  const leitura = lerContaDeServico();
  if (!leitura.conta) throw new Error(leitura.problema);
  const email = leitura.conta.email;
  const token = await tokenDeAcesso(leitura.conta, ESCOPO_GOOGLE_ADS);

  return async (consulta: string) => {
    const r = await fetch(
      `https://googleads.googleapis.com/${VERSAO_GOOGLE_ADS}/customers/${CLIENTE_DO_GOOGLE_ADS}/googleAds:searchStream`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ query: consulta }),
        cache: "no-store",
        signal: AbortSignal.timeout(25_000),
      },
    );
    const corpo = (await r.json().catch(() => ({}))) as unknown;
    if (!r.ok) {
      // No erro, o searchStream devolve uma lista com um objeto de erro dentro.
      const erro = (Array.isArray(corpo) ? corpo[0] : corpo) as ErroDoGoogle;
      throw new Error(mensagemDoGoogle(erro ?? {}, r.status, email));
    }
    return corpo;
  };
}

export async function buscarGastoDoGoogle(de: string, ate: string): Promise<DiaDeGasto[]> {
  const consultar = await abrirGoogleAds();
  return lerLotesDoGoogle(
    await consultar(
      "SELECT segments.date, metrics.cost_micros, metrics.clicks, metrics.impressions FROM customer " +
        `WHERE segments.date >= '${de}' AND segments.date <= '${ate}'`,
    ),
  );
}

async function gravar(db: SupabaseClient, plataforma: Plataforma, dias: DiaDeGasto[]): Promise<string | null> {
  if (dias.length === 0) return null;
  const agora = new Date().toISOString();
  const { error } = await db.from("anuncios_gasto").upsert(
    dias.map((d) => ({
      dia: d.dia,
      plataforma,
      campanha: "",
      gasto: d.gasto,
      impressoes: d.impressoes,
      cliques: d.cliques,
      fonte: "api",
      atualizado_em: agora,
    })),
    { onConflict: "dia,plataforma,campanha" },
  );
  return error ? error.message : null;
}

/**
 * Lê as duas plataformas e grava. `db` é o cliente de serviço: a rotina roda
 * sem ninguém logado, e o token do Meta mora numa tabela que só ele enxerga.
 *
 * Relê os últimos dias a cada rodada, e não só ontem, porque as plataformas
 * corrigem o gasto dos dias recentes (clique inválido, crédito). O que a API
 * devolve substitui o que estava gravado para o mesmo dia.
 */
export async function lerGastoDasPlataformas(db: SupabaseClient, hoje: string, dias = 7): Promise<ResultadoDaLeitura[]> {
  const de = somarDias(hoje, -(Math.min(Math.max(dias, 1), 90) - 1));
  const inicio = new Date();

  const umaPlataforma = async (plataforma: Plataforma, buscar: () => Promise<DiaDeGasto[]> | null): Promise<ResultadoDaLeitura> => {
    let resultado: ResultadoDaLeitura;
    try {
      const pedido = buscar();
      if (!pedido) return { plataforma, estado: "sem_acesso", mensagem: "Falta colar o token do Meta em Integrações." };
      const lidos = completarDias(await pedido, de, hoje, hoje);
      const erro = await gravar(db, plataforma, lidos);
      resultado = erro
        ? { plataforma, estado: "erro", mensagem: `Não deu para gravar: ${erro}` }
        : { plataforma, estado: "ok", dias: lidos.length, gasto: Math.round(lidos.reduce((s, d) => s + d.gasto, 0) * 100) / 100 };
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : "Erro desconhecido.";
      // Falta de acesso é coisa a configurar, não defeito: a tela mostra diferente.
      const semAcesso = /Falta a variável|ainda não|só tem acesso|não alcança|recusou o token/i.test(mensagem);
      resultado = { plataforma, estado: semAcesso ? "sem_acesso" : "erro", mensagem };
    }
    await db.from("sync_logs").insert({
      source: `anuncios_${plataforma}`,
      operation: "ler_gasto",
      status: resultado.estado === "ok" ? "success" : "error",
      attempted: resultado.dias ?? 0,
      succeeded: resultado.estado === "ok" ? (resultado.dias ?? 0) : 0,
      failed: 0,
      error: resultado.estado === "ok" ? null : (resultado.mensagem ?? null),
      payload: { de, ate: hoje, gasto: resultado.gasto ?? null, estado: resultado.estado },
      started_at: inicio.toISOString(),
      finished_at: new Date().toISOString(),
    });
    return resultado;
  };

  const token = await tokenDoMeta(db);

  return Promise.all([
    umaPlataforma("meta", () => (token ? buscarGastoDoMeta(token, de, hoje) : null)),
    umaPlataforma("google", () => buscarGastoDoGoogle(de, hoje)),
  ]);
}

export type Conexao = {
  plataforma: Plataforma;
  /** Meta: há token salvo. Google: a conta de serviço existe neste deploy. */
  configurada: boolean;
  /** O e-mail da conta de serviço, para a tela dizer quem adicionar no Google Ads. */
  contaDeServico?: string | null;
  /** Última leitura que deu certo. */
  lidaEm: string | null;
  /** Última tentativa, e o que ela disse quando não deu certo. */
  tentadaEm: string | null;
  problema: string | null;
};

/** Como está cada ligação, pelo registro das leituras. Cliente de serviço. */
export async function lerConexoes(db: SupabaseClient): Promise<Conexao[]> {
  const plataformas: Plataforma[] = ["meta", "google"];
  const { data: chave } = await db.from("integration_tokens").select("provider").eq("provider", PROVEDOR_META_ADS).maybeSingle();
  const conta = lerContaDeServico().conta;
  return Promise.all(
    plataformas.map(async (plataforma) => {
      const fonte = `anuncios_${plataforma}`;
      const [ultima, boa] = await Promise.all([
        db.from("sync_logs").select("status, error, finished_at").eq("source", fonte).order("finished_at", { ascending: false }).limit(1).maybeSingle(),
        db.from("sync_logs").select("finished_at").eq("source", fonte).eq("status", "success").order("finished_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      return {
        plataforma,
        configurada: plataforma === "meta" ? Boolean(chave) : Boolean(conta),
        contaDeServico: plataforma === "google" ? (conta?.email ?? null) : undefined,
        lidaEm: (boa.data?.finished_at as string | undefined) ?? null,
        tentadaEm: (ultima.data?.finished_at as string | undefined) ?? null,
        problema: ultima.data && ultima.data.status !== "success" ? ((ultima.data.error as string | null) ?? "A última leitura falhou.") : null,
      };
    }),
  );
}
