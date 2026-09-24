import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { contaDeServico, tokenDeAcesso } from "./conta";

/**
 * Importa do Search Console para `analytics_snapshots`, no MESMO formato da
 * planilha que a tela de Métricas já aceitava. Quem lê a tabela (Métricas e a
 * fila de pautas) não sabe, nem precisa saber, se o dado veio da planilha ou
 * da API.
 *
 * Roda toda segunda de manhã pelo `pg_cron` (migration 0038) e também pelo
 * botão "Importar agora" da tela de Métricas.
 */

export type Periodo = { inicio: string; fim: string };

export type ResultadoImportacao = {
  ok: boolean;
  mensagem: string;
  periodo?: Periodo;
  consultas?: number;
  paginas?: number;
};

/** A planilha exportada traz até 1.000 linhas. A API usa o mesmo teto. */
const LINHAS_POR_DIMENSAO = 1000;
/** Mesma janela que o Search Console mostra por padrão. */
const DIAS = 28;
/** O Search Console fecha o dia com dois ou três dias de atraso. */
const ATRASO_EM_DIAS = 3;
/** Propriedade usada quando o cartão de Integrações está vazio. */
const PROPRIEDADE_PADRAO = "sc-domain:jkaliancas.com.br";

type LinhaDaApi = { keys?: string[]; clicks: number; impressions: number; ctr: number; position: number };

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Os últimos 28 dias já fechados pelo Google. */
export function periodoPadrao(hoje = new Date()): Periodo {
  const fim = new Date(hoje);
  fim.setUTCDate(fim.getUTCDate() - ATRASO_EM_DIAS);
  const inicio = new Date(fim);
  inicio.setUTCDate(inicio.getUTCDate() - (DIAS - 1));
  return { inicio: iso(inicio), fim: iso(fim) };
}

async function consultar(
  token: string,
  propriedade: string,
  dimensao: "query" | "page",
  periodo: Periodo,
): Promise<LinhaDaApi[]> {
  const resposta = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(propriedade)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        startDate: periodo.inicio,
        endDate: periodo.fim,
        dimensions: [dimensao],
        rowLimit: LINHAS_POR_DIMENSAO,
        type: "web",
      }),
    },
  );

  const dados = (await resposta.json().catch(() => ({}))) as {
    rows?: LinhaDaApi[];
    error?: { message?: string };
  };

  if (resposta.status === 403) {
    throw new Error(
      `A conta de serviço não tem acesso à propriedade ${propriedade}. ` +
        "No Search Console, em Configurações, Usuários e permissões, adicione o e-mail dela como usuário Restrito.",
    );
  }
  if (!resposta.ok) {
    throw new Error(`O Search Console respondeu ${resposta.status}: ${dados.error?.message ?? "sem detalhe"}.`);
  }
  return dados.rows ?? [];
}

/** Linhas da API no formato de `analytics_snapshots`: uma linha por métrica. */
export function paraSnapshots(linhas: LinhaDaApi[], dimensao: "query" | "page", periodo: Periodo) {
  const registros: Record<string, unknown>[] = [];
  for (const linha of linhas) {
    const valor = String(linha.keys?.[0] ?? "").slice(0, 500);
    if (!valor) continue;

    const base = {
      source: "gsc",
      period_start: periodo.inicio,
      period_end: periodo.fim,
      dimension: dimensao,
      dimension_value: valor,
      url: dimensao === "page" ? valor : null,
    };

    registros.push({ ...base, metric: "clicks", value: linha.clicks });
    registros.push({ ...base, metric: "impressions", value: linha.impressions });
    // A API entrega CTR como fração (0,052). A planilha, que foi o primeiro
    // formato gravado aqui, traz porcentagem (5,2), e é em porcentagem que as
    // telas leem ("CTR abaixo de 1%").
    registros.push({ ...base, metric: "ctr", value: Math.round(linha.ctr * 10000) / 100 });
    registros.push({ ...base, metric: "position", value: Math.round(linha.position * 10) / 10 });
  }
  return registros;
}

export async function importarDoSearchConsole(periodo = periodoPadrao()): Promise<ResultadoImportacao> {
  const conta = contaDeServico();
  if (!conta) {
    return {
      ok: false,
      mensagem: "Falta a variável GSC_SERVICE_ACCOUNT_JSON no servidor. O passo a passo está em docs/search-console-automatico.md.",
    };
  }

  const supabase = createAdminClient();
  const { data: integracao } = await supabase
    .from("integrations")
    .select("config")
    .eq("provider", "gsc")
    .maybeSingle();
  const propriedade =
    (integracao?.config as { site_url?: string } | null)?.site_url?.trim() || PROPRIEDADE_PADRAO;

  let resultado: ResultadoImportacao;
  try {
    const token = await tokenDeAcesso(conta);
    const [consultas, paginas] = await Promise.all([
      consultar(token, propriedade, "query", periodo),
      consultar(token, propriedade, "page", periodo),
    ]);

    for (const [dimensao, linhas] of [
      ["query", consultas],
      ["page", paginas],
    ] as const) {
      const registros = paraSnapshots(linhas, dimensao, periodo);

      // Mesmo período e mesma dimensão são substituídos, como na planilha:
      // rodar de novo nunca duplica.
      const { error: erroApagar } = await supabase
        .from("analytics_snapshots")
        .delete()
        .eq("source", "gsc")
        .eq("dimension", dimensao)
        .eq("period_start", periodo.inicio)
        .eq("period_end", periodo.fim);
      if (erroApagar) throw new Error(`Falha ao limpar o período anterior: ${erroApagar.message}`);

      for (let i = 0; i < registros.length; i += 500) {
        const { error } = await supabase.from("analytics_snapshots").insert(registros.slice(i, i + 500));
        if (error) throw new Error(`Falha ao gravar: ${error.message}`);
      }
    }

    resultado = {
      ok: true,
      mensagem: `Importado: ${consultas.length} consultas e ${paginas.length} páginas de ${propriedade}.`,
      periodo,
      consultas: consultas.length,
      paginas: paginas.length,
    };
  } catch (erro) {
    resultado = { ok: false, mensagem: erro instanceof Error ? erro.message : String(erro) };
  }

  // O último resultado fica em `integration_tokens`, que só o service_role lê,
  // porque a mensagem de erro pode citar a propriedade e a conta. A tela de
  // Métricas mostra daqui quando rodou e se deu certo.
  await supabase.from("integration_tokens").upsert(
    {
      provider: "gsc",
      meta: { ...resultado, executado_em: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "provider" },
  );

  if (!resultado.ok) console.error("[search-console]", resultado.mensagem);
  return resultado;
}
