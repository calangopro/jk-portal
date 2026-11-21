import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { lerChaves } from "@/lib/leads/chaves";
import { clienteDaKommo, type PedirKommo } from "./cliente";
import { escreverNaKommo } from "./escrever";
import { decidirLeadDoBalcao, decidirPedidoDoBalcao, type LeadParaKommo, type LigacaoDaLoja, type PedidoParaKommo } from "./balcao-regra";

/**
 * O balcão da loja na Kommo (cartão 72, 0201): junta o que está pronto
 * (`balcao_kommo_candidatos`), decide pela conta pura (`balcao-regra.ts`) e
 * manda cada um pelo caminho único de escrita (`escrever.ts`).
 *
 * Roda de dois jeitos, e a chave única de `kommo_escritas` impede escrever
 * duas vezes: logo depois de a loja salvar (um pedido ou um lead, pelo
 * `after()` da ação) e na rodada de dez em dez minutos da Kommo, que pega o
 * que o envio na hora perdeu (sem internet do lado da Vercel, Kommo fora).
 * Não lança. `db` é o cliente da chave de serviço.
 */

export type ResultadoDoBalcao = { feitas: number; desistiu: number; falhas: number; detalhe: string };

type Candidatos = { automacoes?: string[]; lojas?: LigacaoDaLoja[]; pedidos?: PedidoParaKommo[]; leads?: LeadParaKommo[] };

export async function rodarBalcaoNaKommo(
  db: SupabaseClient,
  opcoes: { pedido?: string; lead?: string; pedir?: PedirKommo; prazoMs?: number } = {},
): Promise<ResultadoDoBalcao> {
  const vazio = { feitas: 0, desistiu: 0, falhas: 0 };
  const prazo = Date.now() + (opcoes.prazoMs ?? 10_000);
  const { data, error } = await db.rpc("balcao_kommo_candidatos", { p_pedido: opcoes.pedido ?? null, p_lead: opcoes.lead ?? null });
  if (error) {
    console.error("[kommo/balcao] candidatos:", error.message);
    return { ...vazio, falhas: 1, detalhe: `balcão: ${error.message}` };
  }
  const c = (data ?? {}) as Candidatos;
  if (!c.automacoes?.length) return { ...vazio, detalhe: "" };
  const porLoja = new Map((c.lojas ?? []).map((l) => [l.loja, l]));
  const acoes = [
    ...(c.pedidos ?? []).map((p) => decidirPedidoDoBalcao(p, porLoja.get(p.loja))),
    ...(c.leads ?? []).map((l) => decidirLeadDoBalcao(l, porLoja.get(l.loja))),
  ].filter((a): a is NonNullable<typeof a> => a !== null);
  if (!acoes.length) return { ...vazio, detalhe: "balcão: nada novo" };

  let pedir = opcoes.pedir;
  if (!pedir) {
    const chave = (await lerChaves(db)).kommo;
    if (!chave) return { ...vazio, detalhe: "balcão: sem chave da Kommo" };
    pedir = clienteDaKommo(chave);
  }
  const conta = { ...vazio };
  const paradas = new Set<string>();
  for (const a of acoes) {
    if (Date.now() > prazo) break;
    if (paradas.has(a.automacao)) continue;
    try {
      const r = await escreverNaKommo(db, pedir, a);
      if (r.estado === "pulada") {
        if (r.motivo !== "ja") paradas.add(a.automacao);
        continue;
      }
      if (r.estado === "ok") conta.feitas++;
      else if (r.estado === "desistiu") conta.desistiu++;
      else conta.falhas++;
    } catch (e) {
      console.error("[kommo/balcao] escrever", a.chave, e);
      conta.falhas++;
    }
  }
  const partes = [
    conta.feitas ? `${conta.feitas} ${conta.feitas === 1 ? "negócio criado" : "negócios criados"}` : null,
    conta.desistiu ? `${conta.desistiu} já tinham negócio aberto` : null,
    conta.falhas ? `${conta.falhas} com erro` : null,
  ].filter(Boolean);
  return { ...conta, detalhe: `balcão: ${partes.length ? partes.join(", ") : "nada novo"}` };
}
