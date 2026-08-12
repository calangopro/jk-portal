"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/session";

export type ImportState = { erro?: string; ok?: string };

/**
 * Importa a planilha exportada do Search Console.
 *
 * O Google entrega um zip com "Consultas.csv" e "Páginas.csv". Aqui aceitamos
 * o conteúdo de qualquer um dos dois, colado ou enviado, e gravamos como
 * snapshot em analytics_snapshots. Serve enquanto a leitura pela API não está
 * autorizada, e continua útil depois para carregar histórico antigo.
 */

/** Divide a linha respeitando aspas, e aceita vírgula ou ponto e vírgula. */
function separar(linha: string, sep: string): string[] {
  const out: string[] = [];
  let atual = "";
  let dentroDeAspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') {
      if (dentroDeAspas && linha[i + 1] === '"') { atual += '"'; i++; }
      else dentroDeAspas = !dentroDeAspas;
    } else if (c === sep && !dentroDeAspas) {
      out.push(atual); atual = "";
    } else atual += c;
  }
  out.push(atual);
  return out.map((s) => s.trim());
}

/** Converte número em formato brasileiro ou americano. */
function numero(bruto: string): number {
  if (!bruto) return 0;
  const limpo = bruto.replace(/%/g, "").replace(/\s/g, "").trim();
  // 1.234,56 (br) vira 1234.56
  const br = /^\d{1,3}(\.\d{3})*(,\d+)?$/.test(limpo);
  const normal = br ? limpo.replace(/\./g, "").replace(",", ".") : limpo.replace(",", ".");
  const n = Number(normal);
  return Number.isFinite(n) ? n : 0;
}

export async function importarSearchConsole(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  await requireStaff();

  const csv = String(formData.get("csv") ?? "").trim();
  const inicio = String(formData.get("periodo_inicio") ?? "");
  const fim = String(formData.get("periodo_fim") ?? "");

  if (!csv) return { erro: "Cole o conteúdo do CSV exportado do Search Console." };
  if (!inicio || !fim) return { erro: "Informe o período que essa exportação cobre." };

  const linhas = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (linhas.length < 2) return { erro: "O CSV parece vazio." };

  const sep = (linhas[0].match(/;/g)?.length ?? 0) > (linhas[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const cabecalho = separar(linhas[0], sep).map((c) => c.toLowerCase());

  const acharCol = (...nomes: string[]) =>
    cabecalho.findIndex((c) => nomes.some((n) => c.includes(n)));

  const iDim = 0; // a primeira coluna é sempre a consulta ou a página
  const iCliques = acharCol("clique", "click");
  const iImpr = acharCol("impress");
  const iCtr = acharCol("ctr");
  const iPos = acharCol("posi", "position");

  if (iCliques < 0 && iImpr < 0) {
    return { erro: "Não encontrei as colunas de cliques e impressões. Exporte direto do Search Console." };
  }

  const ehPagina = /p[áa]gina|page|url/.test(cabecalho[iDim] ?? "");
  const dimensao = ehPagina ? "page" : "query";

  const registros: Record<string, unknown>[] = [];
  for (const linha of linhas.slice(1)) {
    const col = separar(linha, sep);
    const valorDim = col[iDim];
    if (!valorDim) continue;

    const base = {
      source: "gsc",
      period_start: inicio,
      period_end: fim,
      dimension: dimensao,
      dimension_value: valorDim.slice(0, 500),
      url: ehPagina ? valorDim.slice(0, 500) : null,
    };

    if (iCliques >= 0) registros.push({ ...base, metric: "clicks", value: numero(col[iCliques]) });
    if (iImpr >= 0) registros.push({ ...base, metric: "impressions", value: numero(col[iImpr]) });
    if (iCtr >= 0) registros.push({ ...base, metric: "ctr", value: numero(col[iCtr]) });
    if (iPos >= 0) registros.push({ ...base, metric: "position", value: numero(col[iPos]) });
  }

  if (registros.length === 0) return { erro: "Nenhuma linha aproveitável no CSV." };

  const supabase = await createClient();

  // Substitui o que já existir para o mesmo período e dimensão, evitando duplicar.
  await supabase
    .from("analytics_snapshots")
    .delete()
    .eq("source", "gsc")
    .eq("dimension", dimensao)
    .eq("period_start", inicio)
    .eq("period_end", fim);

  for (let i = 0; i < registros.length; i += 500) {
    const { error } = await supabase.from("analytics_snapshots").insert(registros.slice(i, i + 500));
    if (error) return { erro: `Falha ao gravar: ${error.message}` };
  }

  revalidatePath("/admin/metricas");
  const linhasImportadas = registros.length / Math.max(1, [iCliques, iImpr, iCtr, iPos].filter((i) => i >= 0).length);
  return { ok: `Importado: ${Math.round(linhasImportadas)} ${ehPagina ? "páginas" : "consultas"}.` };
}
