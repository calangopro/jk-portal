import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decidir, type Candidato } from "./vendas";

/**
 * O passo da venda ganha (cartão 47, 0165): roda depois de o espelho gravar,
 * na rotina de dez em dez minutos e no webhook. Lê os negócios que pedem
 * atenção (`kommo_vendas_candidatos`), decide pela conta pura (`decidir`) e
 * manda o banco executar (`kommo_venda_aplicar`), que entra pelas portas de
 * sempre. Rodar duas vezes não registra duas vezes: o vínculo no banco é a
 * trava.
 *
 * Não lança: erro aqui não pode derrubar a leitura do espelho. Devolve o
 * resumo para o pulso.
 */

export type ResultadoDasVendas = { olhados: number; feitos: number; erros: number; detalhe: string };

export async function processarVendasDaKommo(db: SupabaseClient, opcoes: { limite?: number; prazoMs?: number } = {}): Promise<ResultadoDasVendas> {
  const prazo = Date.now() + (opcoes.prazoMs ?? 10_000);
  const { data, error } = await db.rpc("kommo_vendas_candidatos", { p_limite: opcoes.limite ?? 300 });
  if (error) {
    console.error("[kommo/vendas] candidatos:", error.message);
    return { olhados: 0, feitos: 0, erros: 1, detalhe: `vendas da Kommo: ${error.message}` };
  }
  const candidatos = (Array.isArray(data) ? data : []) as Candidato[];
  const agora = new Date().toISOString();
  const contagem: Record<string, number> = {};
  let feitos = 0;
  let erros = 0;

  for (const c of candidatos) {
    if (Date.now() > prazo) break;
    const acao = decidir({ ...c, valor: c.valor === null ? null : Number(c.valor) }, agora);
    if (acao.tipo === "nada") continue;
    const { data: r, error: e } = await db.rpc("kommo_venda_aplicar", { p_negocio: c.negocio_id, p_acao: acao });
    const res = (r ?? {}) as { ok?: boolean; estado?: string; ja?: boolean };
    if (e || !res.ok) {
      erros++;
      console.error("[kommo/vendas] aplicar", c.negocio_id, e?.message ?? JSON.stringify(r));
      continue;
    }
    if (res.ja) continue;
    feitos++;
    const chave = res.estado ?? acao.tipo;
    contagem[chave] = (contagem[chave] ?? 0) + 1;
  }

  const partes = Object.entries(contagem).map(([k, n]) => `${n} ${k}`);
  return {
    olhados: candidatos.length,
    feitos,
    erros,
    detalhe: partes.length || erros ? `vendas da Kommo: ${partes.join(", ") || "nada novo"}${erros ? `, ${erros} com erro` : ""}` : "",
  };
}
