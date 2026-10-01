import { NextResponse, type NextRequest } from "next/server";
import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { quandoLegivel } from "@/lib/content/agenda";
import { NOMES_DAS_PORTAS, type Lead } from "@/lib/leads/tipos";

/**
 * Os contatos do grupo em planilha, para subir num público do Meta, numa
 * lista do RD ou para quem for ligar.
 *
 * Rota, e não página, então o layout do painel não protege: a conferência de
 * sessão é feita aqui. A leitura passa pela RLS de `leads` (só equipe ativa).
 */

export const dynamic = "force-dynamic";

const COLUNAS: [string, (l: Lead) => string][] = [
  ["quando", (l) => quandoLegivel(l.criado_em)],
  ["nome", (l) => l.nome],
  ["whatsapp", (l) => `+${l.whatsapp}`],
  ["email", (l) => l.email ?? ""],
  ["momento", (l) => l.momento ?? ""],
  ["porta", (l) => NOMES_DAS_PORTAS[l.origem] ?? l.origem],
  ["posicao", (l) => l.posicao ?? ""],
  ["campanha", (l) => l.campanha],
  ["utm_source", (l) => l.utm_source || l.rede || ""],
  ["utm_medium", (l) => l.utm_medium ?? ""],
  ["utm_campaign", (l) => l.utm_campaign ?? ""],
  ["utm_content", (l) => l.utm_content ?? ""],
  ["foi_ao_grupo", (l) => (l.clicou_grupo_em ? "sim" : "nao")],
  ["entrou_no_grupo", (l) => (l.entrou_grupo_em ? "sim" : "nao")],
  ["aceite", (l) => `${l.aceite_texto} (${quandoLegivel(l.aceite_em)})`],
];

/** Célula de CSV, com aspas e sem abrir fórmula no Excel. */
function celula(v: string): string {
  const seguro = /^[=+\-@]/.test(v) && !/^\+\d/.test(v) ? `'${v}` : v;
  return `"${seguro.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  const perfil = await getSessionProfile();
  if (!perfil?.isActive) return new NextResponse("Entre no painel para baixar.", { status: 401 });

  const filtro = request.nextUrl.searchParams.get("filtro") ?? "todos";
  const supabase = await createClient();

  const linhas: Lead[] = [];
  // O Supabase entrega no máximo 1.000 linhas por pedido.
  for (let de = 0; de < 50_000; de += 1000) {
    let consulta = supabase.from("leads").select("*").order("criado_em", { ascending: false }).range(de, de + 999);
    if (filtro === "nao-clicou") consulta = consulta.is("clicou_grupo_em", null);
    if (filtro === "clicou") consulta = consulta.not("clicou_grupo_em", "is", null);
    if (filtro === "entrou") consulta = consulta.not("entrou_grupo_em", "is", null);
    const { data } = await consulta;
    const pagina = (data ?? []) as Lead[];
    linhas.push(...pagina);
    if (pagina.length < 1000) break;
  }

  const csv = [
    COLUNAS.map(([c]) => celula(c)).join(";"),
    ...linhas.map((l) => COLUNAS.map(([, f]) => celula(f(l))).join(";")),
  ].join("\r\n");

  const dia = new Date().toISOString().slice(0, 10);
  // BOM no começo para o Excel abrir os acentos certos.
  return new NextResponse(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="contatos-grupo-${filtro}-${dia}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
