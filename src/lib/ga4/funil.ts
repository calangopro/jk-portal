import "server-only";
import { unstable_cache } from "next/cache";
import { BASE_PATH } from "@/lib/seo/base-path";
import { ESCOPO_ANALYTICS, lerContaDeServico, tokenDeAcesso } from "@/lib/search-console/conta";
import { PROPRIEDADE_GA4 } from "./visitas";

/**
 * O funil da LOJA lido do GA4: quantas pessoas entraram, viram produto,
 * puseram no carrinho, começaram o pagamento e fecharam pedido.
 *
 * É a única fonte que enxerga o que acontece entre o clique e o pedido. A Tray
 * só sabe do pedido para frente, e as plataformas de anúncio só do clique para
 * trás. A propriedade é a mesma da loja, e os eventos de compra vêm da
 * integração nativa da Tray.
 *
 * DOIS CUIDADOS, os dois do documento de 09/11/2026:
 *   1. O "fechou pedido" do GA4 é pedido CRIADO, não pago. A venda de verdade
 *      continua sendo a da Tray, que a tela põe logo abaixo.
 *   2. A conta é em PESSOAS (`totalUsers`), não em eventos: a mesma pessoa vê
 *      vinte produtos, e em eventos a passagem para o carrinho pareceria vinte
 *      vezes pior.
 *
 * As páginas do portal (`/guias`) ficam fora de "entraram": quem lê um guia
 * não está na loja. A leitura fica guardada por uma hora, e erro não entra no
 * cache.
 */

export type Etapas = { entraram: number; viramProduto: number; carrinho: number; pagamento: number; pedido: number };
export type FunilDoSite = { tudo: Etapas; celular: Etapas; computador: Etapas };
export type LeituraDoFunil = { funil: FunilDoSite; problema?: undefined } | { funil: null; problema: string };

const EVENTO: Record<string, keyof Etapas> = {
  view_item: "viramProduto",
  add_to_cart: "carrinho",
  begin_checkout: "pagamento",
  purchase: "pedido",
};

type Linha = { dimensionValues?: { value?: string }[]; metricValues?: { value?: string }[] };
type Relatorio = { rows?: Linha[] };

const vazias = (): Etapas => ({ entraram: 0, viramProduto: 0, carrinho: 0, pagamento: 0, pedido: 0 });
const n = (v: string | undefined) => Number(v ?? 0) || 0;

async function buscar(de: string, ate: string): Promise<FunilDoSite> {
  const leitura = lerContaDeServico();
  if (!leitura.conta) throw new Error(leitura.problema);
  const token = await tokenDeAcesso(leitura.conta, ESCOPO_ANALYTICS);

  const periodo = [{ startDate: de, endDate: ate }];
  const foraDoPortal = {
    notExpression: { filter: { fieldName: "pagePath", stringFilter: { matchType: "BEGINS_WITH", value: BASE_PATH } } },
  };
  const eventos = { filter: { fieldName: "eventName", inListFilter: { values: Object.keys(EVENTO) } } };
  const pessoas = [{ name: "totalUsers" }];

  const r = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${PROPRIEDADE_GA4}:batchRunReports`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      requests: [
        { dateRanges: periodo, metrics: pessoas, dimensionFilter: foraDoPortal },
        { dateRanges: periodo, metrics: pessoas, dimensions: [{ name: "eventName" }], dimensionFilter: eventos },
        { dateRanges: periodo, metrics: pessoas, dimensions: [{ name: "deviceCategory" }], dimensionFilter: foraDoPortal },
        { dateRanges: periodo, metrics: pessoas, dimensions: [{ name: "eventName" }, { name: "deviceCategory" }], dimensionFilter: eventos },
      ],
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const corpo = (await r.json().catch(() => ({}))) as { reports?: Relatorio[]; error?: { message?: string; status?: string } };
  if (!r.ok) {
    const msg = corpo.error?.message ?? `status ${r.status}`;
    if (/has not been used|is disabled|SERVICE_DISABLED/i.test(msg)) throw new Error("A Google Analytics Data API não está ativada no projeto do Google Cloud.");
    if (r.status === 403) throw new Error("A conta de serviço do portal não tem acesso de leitura à propriedade do GA4.");
    throw new Error(`O GA4 respondeu ${r.status}: ${msg.slice(0, 200)}`);
  }

  const [total, porEvento, porAparelho, porEventoEAparelho] = corpo.reports ?? [];
  const funil: FunilDoSite = { tudo: vazias(), celular: vazias(), computador: vazias() };
  // Tablet entra em "tudo" e fica fora da comparação entre celular e computador.
  const lado = (aparelho: string | undefined): "celular" | "computador" | null =>
    aparelho === "mobile" ? "celular" : aparelho === "desktop" ? "computador" : null;

  funil.tudo.entraram = n(total?.rows?.[0]?.metricValues?.[0]?.value);
  for (const l of porEvento?.rows ?? []) {
    const etapa = EVENTO[l.dimensionValues?.[0]?.value ?? ""];
    if (etapa) funil.tudo[etapa] = n(l.metricValues?.[0]?.value);
  }
  for (const l of porAparelho?.rows ?? []) {
    const onde = lado(l.dimensionValues?.[0]?.value);
    if (onde) funil[onde].entraram = n(l.metricValues?.[0]?.value);
  }
  for (const l of porEventoEAparelho?.rows ?? []) {
    const etapa = EVENTO[l.dimensionValues?.[0]?.value ?? ""];
    const onde = lado(l.dimensionValues?.[1]?.value);
    if (etapa && onde) funil[onde][etapa] = n(l.metricValues?.[0]?.value);
  }
  return funil;
}

const buscarComCache = unstable_cache(buscar, ["ga4-funil-da-loja-v1"], { revalidate: 3600 });

export async function lerFunilDoSite(de: string, ate: string): Promise<LeituraDoFunil> {
  try {
    return { funil: await buscarComCache(de, ate) };
  } catch (e) {
    return { funil: null, problema: e instanceof Error ? e.message : "Não deu para ler o GA4 agora." };
  }
}
