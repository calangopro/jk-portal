import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { lerProducao } from "@/lib/vendas/producao";
import { lerProducaoDaKommo } from "./fabrica";
import type { Campo } from "./vendas";

/**
 * O passo da fábrica (cartão 51, 0176): roda logo depois do passo da venda
 * ganha, na rotina e no webhook. Para cada venda por fora vinda da Kommo que
 * ainda não tem produção, lê os campos do negócio (`lerProducaoDaKommo`),
 * confere com `lerProducao` (a MESMA conta do formulário de Registrar venda) e
 * manda o banco aplicar (`kommo_fabrica_aplicar`), que entra pela porta da
 * venda por fora em nome do vendedor. A venda que ganha produção deixa de ser
 * candidata: rodar duas vezes não manda duas vezes.
 *
 * Não lança: erro aqui não pode derrubar a leitura do espelho.
 */

export type ResultadoDaFabrica = { olhados: number; naFabrica: number; incompletas: number; erros: number; detalhe: string };

type Candidato = { negocio_id: number; venda_id: string; campos: Campo[]; estado: string | null };

export async function processarFabricaDaKommo(db: SupabaseClient, opcoes: { prazoMs?: number } = {}): Promise<ResultadoDaFabrica> {
  const prazo = Date.now() + (opcoes.prazoMs ?? 6_000);
  const { data, error } = await db.rpc("kommo_fabrica_candidatos", { p_limite: 100 });
  if (error) {
    console.error("[kommo/fabrica] candidatos:", error.message);
    return { olhados: 0, naFabrica: 0, incompletas: 0, erros: 1, detalhe: `fábrica da Kommo: ${error.message}` };
  }
  const candidatos = (Array.isArray(data) ? data : []) as Candidato[];
  let naFabrica = 0;
  let incompletas = 0;
  let erros = 0;

  for (const c of candidatos) {
    if (Date.now() > prazo) break;
    const lida = lerProducaoDaKommo(c.campos);
    let leitura: Record<string, unknown> = { tipo: lida.tipo, formulario: lida.formulario, motivos: lida.tipo === "fabrica" ? [] : lida.motivos };
    if (lida.tipo === "fabrica") {
      const conferida = lerProducao(lida.formulario);
      leitura = conferida.ok
        ? { ...leitura, producao: conferida.producao }
        // A leitura da Kommo deveria passar sempre; se não passar, a frase do formulário vira o motivo, e nada segue.
        : { tipo: "incompleta", formulario: lida.formulario, motivos: [conferida.erro] };
    }
    // A mesma leitura de antes não precisa ir ao banco de novo.
    if (leitura.tipo !== "fabrica" && c.estado === leitura.tipo) continue;
    const { data: r, error: e } = await db.rpc("kommo_fabrica_aplicar", { p_venda: c.venda_id, p_leitura: leitura });
    const res = (r ?? {}) as { ok?: boolean; estado?: string; ja?: boolean };
    if (e || !res.ok) {
      erros++;
      console.error("[kommo/fabrica] aplicar", c.negocio_id, e?.message ?? JSON.stringify(r));
      continue;
    }
    if (res.estado === "fabrica" && !res.ja) naFabrica++;
    else if (res.estado === "incompleta") incompletas++;
  }

  const partes = [naFabrica ? `${naFabrica} na fábrica` : "", incompletas ? `${incompletas} esperando a produção` : "", erros ? `${erros} com erro` : ""].filter(Boolean);
  return { olhados: candidatos.length, naFabrica, incompletas, erros, detalhe: partes.length ? `fábrica da Kommo: ${partes.join(", ")}` : "" };
}
