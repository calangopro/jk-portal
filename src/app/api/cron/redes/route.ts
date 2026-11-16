import { NextResponse } from "next/server";
import { cronAutorizado } from "@/lib/cron/autorizar";
import { registrarPulso } from "@/lib/cron/pulso";
import { lerRedes } from "@/lib/redes/leitura";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Lê os números das redes sociais ligadas e grava no banco.
 *
 * Quem chama é o `pg_cron` do Supabase, de meia em meia hora (migration 0083),
 * com o mesmo segredo das outras rotinas. É daqui que saem os seguidores, o
 * alcance e os posts que as telas do setor Redes mostram: tela nenhuma chama a
 * API de uma rede.
 *
 * Conta que falha não derruba as outras: o motivo fica na própria conta
 * (`redes_contas.ultimo_erro`), e é lá que a tela de ligações lê. O pulso diz
 * só que a rotina rodou; rodada em que TODAS as contas falharam conta como ruim.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = createAdminClient();
  if (!(await cronAutorizado(request, supabase))) {
    return NextResponse.json({ erro: "segredo inválido" }, { status: 401 });
  }
  // A rotina manda corpo vazio. Para encher a história de uma conta de uma vez, o corpo pode trazer `dias`,
  // `paginas` e `conta` (o id da linha em `redes_contas`). Sem `conta`, os dias valem para todas: cuidado com o
  // Instagram, que cobra uma chamada por dia.
  const corpo = (await request.json().catch(() => ({}))) as { dias?: unknown; paginas?: unknown; conta?: unknown };
  const dias = Math.min(Math.max(Math.round(Number(corpo.dias) || 7), 1), 180);
  const paginas = Math.min(Math.max(Math.round(Number(corpo.paginas) || 1), 1), 6);
  const contaId = typeof corpo.conta === "string" && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(corpo.conta) ? corpo.conta : undefined;

  try {
    const contas = await lerRedes(supabase, { dias, paginas, contaId, prazoMs: 45_000 });
    const boas = contas.filter((c) => c.estado === "ok" || c.estado === "parcial").length;
    const ok = contas.length === 0 || boas > 0;
    const detalhe = contas.length === 0 ? "nenhuma conta ligada" : `${boas} de ${contas.length} ${contas.length === 1 ? "conta lida" : "contas lidas"}`;
    await registrarPulso(supabase, "redes", ok, detalhe);
    // A resposta não leva nome de conta nem mensagem de erro da rede: só a contagem.
    return NextResponse.json({ ok, contas: contas.map((c) => ({ rede: c.rede, estado: c.estado, dias: c.dias, publicacoes: c.publicacoes, metricas: c.metricas })) });
  } catch (e) {
    console.error("[redes] rotina de leitura:", e);
    await registrarPulso(supabase, "redes", false, e instanceof Error ? e.message : "erro na leitura");
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
