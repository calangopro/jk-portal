import { Suspense } from "react";
import { requireArea } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { snapshotsDoPeriodo, ultimoPeriodo } from "@/lib/data/snapshots";
import { lerDias } from "@/lib/ga4/visitas";
import { Visitas, VisitasCarregando } from "./Visitas";
import { TelaDasMetricas } from "./Tela";

export const metadata = { title: "Métricas" };

// O botão "Importar agora" roda dentro desta rota, e a importação do Search
// Console passa dos 10 segundos padrão da Vercel.
export const maxDuration = 60;

/** Situação da leitura automática, para o painel da tela. */
async function situacaoDoAutomatico() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { email: null, problema: null, ultima: null };
  const [{ lerContaDeServico }, { createAdminClient }] = await Promise.all([
    import("@/lib/search-console/conta"),
    import("@/lib/supabase/admin"),
  ]);
  const { data } = await createAdminClient()
    .from("integration_tokens")
    .select("meta")
    .eq("provider", "gsc")
    .maybeSingle();
  const meta = (data?.meta ?? null) as { ok?: boolean; mensagem?: string; executado_em?: string } | null;
  const leitura = lerContaDeServico();
  return {
    email: leitura.conta?.email ?? null,
    problema: leitura.problema ?? null,
    ultima: meta?.executado_em ? { ok: Boolean(meta.ok), mensagem: meta.mensagem ?? "", quando: meta.executado_em } : null,
  };
}

export default async function MetricasPage({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string }>;
}) {
  await requireArea("metricas");
  const dias = lerDias((await searchParams).dias);
  const supabase = await createClient();

  const [periodo, { count: publicados }, { count: total }, automatico] = await Promise.all([
    ultimoPeriodo(supabase),
    supabase.from("contents").select("*", { count: "exact", head: true }).eq("status", "published"),
    supabase.from("contents").select("*", { count: "exact", head: true }),
    situacaoDoAutomatico(),
  ]);

  // Só o período mais recente entra nos números do topo.
  const doPeriodo = periodo ? await snapshotsDoPeriodo(supabase, periodo) : [];

  const somar = (metric: string, dim: string) =>
    doPeriodo.filter((l) => l.metric === metric && l.dimension === dim).reduce((a, b) => a + Number(b.value), 0);

  const impressoes = somar("impressions", "query");
  const cliques = somar("clicks", "query");
  const ctr = impressoes > 0 ? (cliques / impressoes) * 100 : 0;

  const posicoes = doPeriodo.filter((l) => l.metric === "position" && l.dimension === "query");
  const posicaoMedia =
    posicoes.length > 0 ? posicoes.reduce((a, b) => a + Number(b.value), 0) / posicoes.length : 0;

  /** Junta as métricas por consulta, para montar as tabelas. */
  function agrupar(dim: string) {
    const mapa = new Map<string, { impressions: number; clicks: number; position: number; ctr: number }>();
    for (const l of doPeriodo.filter((x) => x.dimension === dim)) {
      const atual = mapa.get(l.dimension_value) ?? { impressions: 0, clicks: 0, position: 0, ctr: 0 };
      if (l.metric === "impressions") atual.impressions = Number(l.value);
      if (l.metric === "clicks") atual.clicks = Number(l.value);
      if (l.metric === "position") atual.position = Number(l.value);
      if (l.metric === "ctr") atual.ctr = Number(l.value);
      mapa.set(l.dimension_value, atual);
    }
    return [...mapa.entries()].map(([nome, m]) => ({ nome, ...m }));
  }

  const consultas = agrupar("query");
  const paginas = agrupar("page");

  // A maior oportunidade do projeto: muita impressão, posição de segunda página.
  const pertoDaPrimeira = consultas
    .filter((c) => c.position >= 8 && c.position <= 20 && c.impressions > 0)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 12);

  // Muita impressão e clique baixo: o título e a meta não estão ganhando o clique.
  const ctrBaixo = consultas
    .filter((c) => c.impressions >= 100 && c.ctr < 1)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 12);

  const temDados = doPeriodo.length > 0;

  return <TelaDasMetricas
      visitas={
        <Suspense key={dias} fallback={<VisitasCarregando dias={dias} />}>
          <Visitas dias={dias} />
        </Suspense>
      }
      periodo={periodo}
      temDados={temDados}
      impressoes={impressoes}
      cliques={cliques}
      ctr={ctr}
      posicaoMedia={posicaoMedia}
      pertoDaPrimeira={pertoDaPrimeira}
      ctrBaixo={ctrBaixo}
      paginas={paginas}
      automatico={automatico}
      publicados={publicados}
      total={total}
    />;
}
