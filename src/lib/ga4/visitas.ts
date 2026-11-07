import "server-only";
import { unstable_cache } from "next/cache";
import { BASE_PATH } from "@/lib/seo/base-path";
import {
  ESCOPO_ANALYTICS,
  lerContaDeServico,
  tokenDeAcesso,
} from "@/lib/search-console/conta";

/**
 * Visitas do site lidas do GA4, para a tela de Métricas e para o conector.
 *
 * O Search Console só conta quem viu e clicou no Google. Quem chega pelo
 * Instagram, por uma resposta do ChatGPT ou por link de WhatsApp fica de
 * fora, e é o GA4 que enxerga essas pessoas: o portal manda as visitas para
 * a mesma propriedade da loja desde 24/09/2026.
 *
 * A leitura usa a MESMA conta de serviço do Search Console
 * (`GSC_SERVICE_ACCOUNT_JSON`), com outro escopo. Ela precisa de duas coisas
 * que só se fazem no Google, e cada uma tem mensagem própria quando falta:
 *   1. a "Google Analytics Data API" ativada no projeto do Google Cloud;
 *   2. o e-mail da conta como Leitor na propriedade do GA4.
 *
 * Os números são lidos na hora e guardados por uma hora. Não vão para
 * `analytics_snapshots` porque o GA4 já guarda o histórico e responde
 * qualquer período; a tabela existe para o Search Console, que esquece tudo
 * depois de 16 meses.
 */

/** Propriedade "jkaliancas.com.br" (ID de métrica G-9V89YVR635), a mesma da loja. */
export const PROPRIEDADE_GA4 = process.env.GA4_PROPERTY_ID?.trim() || "430853950";

export const PERIODOS = [7, 28, 90] as const;
export type Dias = (typeof PERIODOS)[number];

export function lerDias(valor: unknown): Dias {
  const n = Number(Array.isArray(valor) ? valor[0] : valor);
  return (PERIODOS as readonly number[]).includes(n) ? (n as Dias) : 28;
}

/**
 * Eventos de clique que o site manda (`lib/analytics/eventos.ts`). "Para a
 * loja" é o que leva à compra; "contato" é o que leva a uma conversa ou a
 * uma visita na loja física.
 */
const PARA_A_LOJA = ["clique_produto", "clique_loja"];
const CONTATO = ["clique_whatsapp", "clique_telefone", "clique_rota", "clique_waze"];

export type Origem = "busca" | "ia" | "redes" | "anuncio" | "direto" | "outros";

export const NOME_DA_ORIGEM: Record<Origem, string> = {
  busca: "Busca (Google, Bing)",
  ia: "Respostas de IA",
  redes: "Redes sociais",
  anuncio: "Anúncios",
  direto: "Direto ou sem origem",
  outros: "Outros sites",
};

/**
 * Assistentes de IA que mandam gente para o site. O GA4 não tem grupo próprio
 * para eles e mistura tudo em "Referral", então a separação é feita aqui, pela
 * origem da sessão. É o número que mostra se o trabalho de GEO está chegando.
 */
const IAS: { teste: RegExp; nome: string }[] = [
  { teste: /chatgpt|openai/, nome: "ChatGPT" },
  { teste: /perplexity/, nome: "Perplexity" },
  { teste: /gemini|bard/, nome: "Gemini" },
  { teste: /copilot/, nome: "Copilot" },
  { teste: /claude|anthropic/, nome: "Claude" },
  { teste: /deepseek/, nome: "DeepSeek" },
  { teste: /meta\.ai/, nome: "Meta AI" },
  { teste: /grok/, nome: "Grok" },
];

const REDES = /instagram|facebook|^fb$|threads|tiktok|pinterest|youtube|whatsapp|wa\.me|linkedin|twitter|^x\.com|^t\.co$|kwai/;

export function nomeDaIa(fonte: string): string | null {
  const f = fonte.toLowerCase();
  return IAS.find((ia) => ia.teste.test(f))?.nome ?? null;
}

export function classificarOrigem(fonte: string, meio: string): Origem {
  const f = fonte.toLowerCase();
  const m = meio.toLowerCase();
  if (nomeDaIa(f)) return "ia";
  if (/cpc|ppc|paid|ads?$/.test(m)) return "anuncio";
  if (m === "organic") return "busca";
  if (REDES.test(f) || m === "social") return "redes";
  if (f === "(direct)" || f === "(not set)" || f === "") return "direto";
  return "outros";
}

export type PaginaVisitada = {
  caminho: string;
  titulo: string;
  pessoas: number;
  visualizacoes: number;
  /** Tempo médio de leitura por pessoa, em segundos. */
  tempoMedio: number;
  paraLoja: number;
  contato: number;
};

export type VisitasDoSite = {
  dias: Dias;
  totais: {
    pessoas: number;
    visualizacoes: number;
    sessoes: number;
    tempoMedio: number;
    paraLoja: number;
    contato: number;
  };
  anterior: { pessoas: number; visualizacoes: number };
  paginas: PaginaVisitada[];
  origens: { origem: Origem; sessoes: number }[];
  ias: { nome: string; sessoes: number }[];
  lidoEm: string;
};

export type ProblemaGa4 =
  | { tipo: "sem_conta"; mensagem: string }
  | { tipo: "api_desligada"; mensagem: string; email: string; projeto: string | null }
  | { tipo: "sem_acesso"; mensagem: string; email: string }
  | { tipo: "erro"; mensagem: string };

export type LeituraDasVisitas =
  | { ok: true; dados: VisitasDoSite }
  | { ok: false; problema: ProblemaGa4 };

class ErroGa4 extends Error {
  constructor(
    readonly tipo: "api_desligada" | "sem_acesso" | "erro",
    mensagem: string,
  ) {
    super(mensagem);
  }
}

// ------------------------------------------------------------------ API

type Filtro = Record<string, unknown>;

/** Só as páginas do portal, sem o que não é leitura pública. */
const SO_O_PORTAL: Filtro = {
  andGroup: {
    expressions: [
      { filter: { fieldName: "pagePath", stringFilter: { matchType: "BEGINS_WITH", value: BASE_PATH } } },
      ...["/admin", "/preview"].map((p) => ({
        notExpression: {
          filter: { fieldName: "pagePath", stringFilter: { matchType: "BEGINS_WITH", value: `${BASE_PATH}${p}` } },
        },
      })),
    ],
  },
};

type Relatorio = {
  rows?: { dimensionValues?: { value?: string }[]; metricValues?: { value?: string }[] }[];
};

function periodo(dias: number, deslocamento = 0) {
  return {
    startDate: `${dias + deslocamento}daysAgo`,
    // Hoje fica de fora: o GA4 ainda está processando, e o número do dia
    // aparece pela metade.
    endDate: deslocamento ? `${deslocamento + 1}daysAgo` : "yesterday",
  };
}

async function relatorios(token: string, dias: Dias): Promise<Relatorio[]> {
  const atual = periodo(dias);
  const pedidos = [
    // 0. Totais, com o período anterior do mesmo tamanho para comparar.
    {
      dateRanges: [atual, periodo(dias, dias)],
      metrics: [
        { name: "activeUsers" },
        { name: "screenPageViews" },
        { name: "sessions" },
        { name: "userEngagementDuration" },
      ],
      dimensionFilter: SO_O_PORTAL,
    },
    // 1. Por página.
    {
      dateRanges: [atual],
      dimensions: [{ name: "pagePath" }, { name: "pageTitle" }],
      metrics: [{ name: "activeUsers" }, { name: "screenPageViews" }, { name: "userEngagementDuration" }],
      dimensionFilter: SO_O_PORTAL,
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: 500,
    },
    // 2. Cliques por página.
    {
      dateRanges: [atual],
      dimensions: [{ name: "pagePath" }, { name: "eventName" }],
      metrics: [{ name: "eventCount" }],
      dimensionFilter: {
        andGroup: {
          expressions: [
            SO_O_PORTAL,
            { filter: { fieldName: "eventName", inListFilter: { values: [...PARA_A_LOJA, ...CONTATO] } } },
          ],
        },
      },
      limit: 2000,
    },
    // 3. De onde vieram.
    {
      dateRanges: [atual],
      dimensions: [{ name: "sessionSource" }, { name: "sessionMedium" }],
      metrics: [{ name: "sessions" }],
      dimensionFilter: SO_O_PORTAL,
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 500,
    },
  ];

  const resposta = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${PROPRIEDADE_GA4}:batchRunReports`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ requests: pedidos }),
      cache: "no-store",
    },
  );

  const corpo = (await resposta.json().catch(() => ({}))) as {
    reports?: Relatorio[];
    error?: { message?: string; status?: string };
  };

  if (!resposta.ok) {
    const msg = corpo.error?.message ?? `status ${resposta.status}`;
    if (/has not been used|is disabled|SERVICE_DISABLED|not been enabled/i.test(msg)) {
      throw new ErroGa4("api_desligada", msg);
    }
    if (resposta.status === 403 || corpo.error?.status === "PERMISSION_DENIED") {
      throw new ErroGa4("sem_acesso", msg);
    }
    throw new ErroGa4("erro", `O GA4 respondeu ${resposta.status}: ${msg}`);
  }
  return corpo.reports ?? [];
}

const num = (v: string | undefined) => Number(v ?? 0) || 0;

/** Junta os quatro relatórios no formato da tela. */
export function montar(dias: Dias, r: Relatorio[]): VisitasDoSite {
  const [totais, porPagina, cliques, origens] = r;

  // Com dois períodos, cada linha traz "date_range_0" ou "date_range_1" como
  // dimensão. Período sem visita nenhuma não vem na resposta.
  const doPeriodo = (nome: string) =>
    totais?.rows?.find((l) => l.dimensionValues?.[0]?.value === nome)?.metricValues ?? [];
  const agora = doPeriodo("date_range_0");
  const antes = doPeriodo("date_range_1");

  const paginas = new Map<string, PaginaVisitada & { vistasDoTitulo: number; tempoTotal: number }>();
  for (const l of porPagina?.rows ?? []) {
    const caminho = l.dimensionValues?.[0]?.value ?? "";
    const titulo = l.dimensionValues?.[1]?.value ?? "";
    const [pessoas, vistas, tempo] = (l.metricValues ?? []).map((m) => num(m.value));
    const p = paginas.get(caminho) ?? {
      caminho, titulo, pessoas: 0, visualizacoes: 0, tempoMedio: 0, paraLoja: 0, contato: 0, vistasDoTitulo: 0, tempoTotal: 0,
    };
    // A mesma página aparece com mais de um título quando o título mudou no
    // meio do período. Fica o título com mais visualizações.
    if (vistas > p.vistasDoTitulo && titulo && titulo !== "(not set)") {
      p.titulo = titulo;
      p.vistasDoTitulo = vistas;
    }
    p.pessoas += pessoas;
    p.visualizacoes += vistas;
    p.tempoTotal += tempo;
    paginas.set(caminho, p);
  }

  let paraLoja = 0;
  let contato = 0;
  for (const l of cliques?.rows ?? []) {
    const caminho = l.dimensionValues?.[0]?.value ?? "";
    const evento = l.dimensionValues?.[1]?.value ?? "";
    const n = num(l.metricValues?.[0]?.value);
    const p = paginas.get(caminho);
    if (PARA_A_LOJA.includes(evento)) {
      paraLoja += n;
      if (p) p.paraLoja += n;
    } else if (CONTATO.includes(evento)) {
      contato += n;
      if (p) p.contato += n;
    }
  }

  const porOrigem = new Map<Origem, number>();
  const porIa = new Map<string, number>();
  for (const l of origens?.rows ?? []) {
    const fonte = l.dimensionValues?.[0]?.value ?? "";
    const meio = l.dimensionValues?.[1]?.value ?? "";
    const n = num(l.metricValues?.[0]?.value);
    const origem = classificarOrigem(fonte, meio);
    porOrigem.set(origem, (porOrigem.get(origem) ?? 0) + n);
    const ia = nomeDaIa(fonte);
    if (ia) porIa.set(ia, (porIa.get(ia) ?? 0) + n);
  }

  const pessoas = num(agora[0]?.value);
  return {
    dias,
    totais: {
      pessoas,
      visualizacoes: num(agora[1]?.value),
      sessoes: num(agora[2]?.value),
      tempoMedio: pessoas ? num(agora[3]?.value) / pessoas : 0,
      paraLoja,
      contato,
    },
    anterior: { pessoas: num(antes[0]?.value), visualizacoes: num(antes[1]?.value) },
    paginas: [...paginas.values()]
      .map(({ vistasDoTitulo: _v, tempoTotal, ...p }) => ({
        ...p,
        titulo: p.titulo.replace(/\s*\|\s*JK Alianças\s*$/i, ""),
        tempoMedio: p.pessoas ? tempoTotal / p.pessoas : 0,
      }))
      .sort((a, b) => b.visualizacoes - a.visualizacoes),
    origens: [...porOrigem.entries()]
      .map(([origem, sessoes]) => ({ origem, sessoes }))
      .sort((a, b) => b.sessoes - a.sessoes),
    ias: [...porIa.entries()].map(([nome, sessoes]) => ({ nome, sessoes })).sort((a, b) => b.sessoes - a.sessoes),
    lidoEm: new Date().toISOString(),
  };
}

// Dentro do cache vai só o que veio do GA4. Erro sai por exceção, e exceção
// não fica guardada: um soluço do Google não prende a tela no erro por uma hora.
const lerDoGa4 = unstable_cache(
  async (dias: Dias) => {
    const { conta } = lerContaDeServico();
    if (!conta) throw new ErroGa4("erro", "sem conta");
    const token = await tokenDeAcesso(conta, ESCOPO_ANALYTICS);
    return montar(dias, await relatorios(token, dias));
  },
  ["ga4-visitas", "v1"],
  { revalidate: 3600, tags: ["ga4"] },
);

/** Projeto do Google Cloud, tirado do e-mail da conta (`nome@projeto.iam.gserviceaccount.com`). */
function projetoDaConta(email: string): string | null {
  return email.match(/@([^.]+)\.iam\.gserviceaccount\.com$/)?.[1] ?? null;
}

export async function lerVisitas(dias: Dias): Promise<LeituraDasVisitas> {
  const leitura = lerContaDeServico();
  if (!leitura.conta) return { ok: false, problema: { tipo: "sem_conta", mensagem: leitura.problema } };
  const email = leitura.conta.email;

  try {
    return { ok: true, dados: await lerDoGa4(dias) };
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : String(e);
    // Pelo campo, e não por `instanceof`: o erro atravessa o `unstable_cache`,
    // e não vale apostar que a classe chega inteira do outro lado.
    const tipo = (e as { tipo?: string } | null)?.tipo;
    if (tipo === "api_desligada") {
      return { ok: false, problema: { tipo: "api_desligada", mensagem, email, projeto: projetoDaConta(email) } };
    }
    if (tipo === "sem_acesso") {
      return { ok: false, problema: { tipo: "sem_acesso", mensagem, email } };
    }
    return { ok: false, problema: { tipo: "erro", mensagem } };
  }
}
