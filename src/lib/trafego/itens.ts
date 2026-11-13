import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { somarDias } from "../vendas/periodo";
import { lerItensDoGoogle, lerItensDoMeta, type LinhaDeItem } from "./leitura-itens";
import { abrirGoogleAds, listarNoMeta, tokenDoMeta, type Plataforma } from "./plataformas";

/**
 * Leitura de campanha, conjunto e anúncio nas duas plataformas, gravada em
 * `anuncios_itens` (0061). Roda junto da leitura do gasto, na mesma rotina de
 * hora em hora, e regrava os últimos dias pelo mesmo motivo: as plataformas
 * corrigem os números recentes.
 *
 * Cada plataforma falha sozinha. No Google, cada NÍVEL também: se a consulta de
 * anúncios for recusada, campanha e conjunto ainda entram, e o que faltou fica
 * anotado em `sync_logs`.
 */

export type ResultadoDosItens = {
  plataforma: Plataforma;
  estado: "ok" | "sem_acesso" | "erro";
  linhas?: number;
  /** Níveis que não vieram, com o motivo. */
  avisos?: string[];
  mensagem?: string;
};

const CAMPOS_DO_META =
  "campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,objective,spend,impressions,clicks,inline_link_clicks,actions,action_values";

async function itensDoMeta(token: string, de: string, ate: string): Promise<{ linhas: LinhaDeItem[]; avisos: string[] }> {
  const avisos: string[] = [];
  const [insights, anuncios] = await Promise.all([
    listarNoMeta(
      token,
      "insights",
      { level: "ad", fields: CAMPOS_DO_META, time_increment: "1", time_range: JSON.stringify({ since: de, until: ate }), limit: "500" },
      20,
    ),
    // Quem está veiculando agora. Se esta lista falhar, o funil entra do mesmo
    // jeito, só sem dizer o que está ligado.
    listarNoMeta(token, "ads", { fields: "id,effective_status", limit: "500" }, 10).catch((e: unknown) => {
      avisos.push(`Sem a situação dos anúncios: ${e instanceof Error ? e.message : "erro"}`);
      return null;
    }),
  ]);
  const situacao = anuncios
    ? new Map((anuncios as { id?: string; effective_status?: string }[]).map((a) => [String(a.id ?? ""), String(a.effective_status ?? "")]))
    : null;
  return { linhas: lerItensDoMeta(insights, situacao), avisos };
}

const METRICAS = "metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value";

async function itensDoGoogle(de: string, ate: string): Promise<{ linhas: LinhaDeItem[]; avisos: string[] }> {
  const consultar = await abrirGoogleAds();
  const onde = `WHERE segments.date >= '${de}' AND segments.date <= '${ate}'`;
  const avisos: string[] = [];
  const nivel = (nome: string, consulta: string) =>
    consultar(consulta).catch((e: unknown) => {
      avisos.push(`${nome}: ${e instanceof Error ? e.message : "erro"}`);
      return [];
    });

  // A campanha vem sem o `catch`: se ela falha, é acesso, e a rodada inteira falha com a mensagem certa.
  const campanhas = await consultar(
    `SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, segments.date, ${METRICAS} FROM campaign ${onde}`,
  );
  const [grupos, recursos, anuncios] = await Promise.all([
    nivel("Grupos de anúncios", `SELECT ad_group.id, ad_group.name, ad_group.status, campaign.id, campaign.status, segments.date, ${METRICAS} FROM ad_group ${onde}`),
    nivel("Grupos de recursos", `SELECT asset_group.id, asset_group.name, asset_group.status, campaign.id, campaign.status, segments.date, ${METRICAS} FROM asset_group ${onde}`),
    nivel(
      "Anúncios",
      "SELECT ad_group_ad.ad.id, ad_group_ad.ad.name, ad_group_ad.ad.type, ad_group_ad.ad.responsive_search_ad.headlines, ad_group_ad.status, " +
        `ad_group.id, ad_group.status, campaign.id, campaign.status, segments.date, ${METRICAS} FROM ad_group_ad ${onde}`,
    ),
  ]);
  return { linhas: lerItensDoGoogle({ campanhas, grupos, recursos, anuncios }), avisos };
}

async function gravar(db: SupabaseClient, linhas: LinhaDeItem[]): Promise<string | null> {
  const agora = new Date().toISOString();
  for (let i = 0; i < linhas.length; i += 500) {
    const { error } = await db
      .from("anuncios_itens")
      .upsert(linhas.slice(i, i + 500).map((l) => ({ ...l, atualizado_em: agora })), { onConflict: "dia,plataforma,nivel,item_id" });
    if (error) return error.message;
  }
  return null;
}

/** Lê os três níveis nas duas plataformas e grava. `db` é o cliente de serviço. */
export async function lerItensDasPlataformas(db: SupabaseClient, hoje: string, dias = 7): Promise<ResultadoDosItens[]> {
  const de = somarDias(hoje, -(Math.min(Math.max(dias, 1), 90) - 1));
  const inicio = new Date();

  const uma = async (plataforma: Plataforma, buscar: () => Promise<{ linhas: LinhaDeItem[]; avisos: string[] }> | null): Promise<ResultadoDosItens> => {
    let resultado: ResultadoDosItens;
    try {
      const pedido = buscar();
      if (!pedido) return { plataforma, estado: "sem_acesso", mensagem: "Falta colar o token do Meta em Integrações." };
      const { linhas, avisos } = await pedido;
      const erro = await gravar(db, linhas);
      resultado = erro
        ? { plataforma, estado: "erro", mensagem: `Não deu para gravar: ${erro}` }
        : { plataforma, estado: "ok", linhas: linhas.length, avisos };
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : "Erro desconhecido.";
      const semAcesso = /Falta a variável|ainda não|só tem acesso|não alcança|recusou o token/i.test(mensagem);
      resultado = { plataforma, estado: semAcesso ? "sem_acesso" : "erro", mensagem };
    }
    await db.from("sync_logs").insert({
      source: `anuncios_itens_${plataforma}`,
      operation: "ler_itens",
      status: resultado.estado === "ok" ? (resultado.avisos?.length ? "partial" : "success") : "error",
      attempted: resultado.linhas ?? 0,
      succeeded: resultado.estado === "ok" ? (resultado.linhas ?? 0) : 0,
      failed: 0,
      error: resultado.estado === "ok" ? (resultado.avisos?.join(" | ").slice(0, 900) || null) : (resultado.mensagem ?? null),
      payload: { de, ate: hoje, estado: resultado.estado },
      started_at: inicio.toISOString(),
      finished_at: new Date().toISOString(),
    });
    return resultado;
  };

  const token = await tokenDoMeta(db);
  return Promise.all([
    uma("meta", () => (token ? itensDoMeta(token, de, hoje) : null)),
    uma("google", () => itensDoGoogle(de, hoje)),
  ]);
}
