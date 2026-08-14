import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicarNoBanco } from "@/lib/publicacao/publicar";

/**
 * Publica o que estava agendado e venceu.
 *
 * Quem chama é o `pg_cron` do Supabase, de cinco em cinco minutos, com o
 * segredo guardado em `integration_tokens` (tabela que só o `service_role`
 * enxerga). Não existe sessão aqui: é o relógio batendo, não uma pessoa.
 *
 * Publicar é feito pela MESMA função do botão do editor, com trava de fonte e
 * trava do analisador. Se o conteúdo não passa, ele NÃO entra no ar: o
 * agendamento fica de pé e o motivo é gravado em `scheduled_error`, para
 * aparecer na lista de conteúdos. O pior caso do agendamento seria a hora
 * passar, a trava recusar e ninguém ficar sabendo.
 */

export const dynamic = "force-dynamic";

/** Comparação de tempo constante, para o segredo não vazar por cronometragem. */
function segredoConfere(recebido: string, esperado: string): boolean {
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const recebido = request.headers.get("x-cron-secret") ?? "";
  if (!recebido) {
    return NextResponse.json({ erro: "sem segredo" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: token } = await supabase
    .from("integration_tokens")
    .select("access_token")
    .eq("provider", "cron")
    .maybeSingle();

  const esperado = (token?.access_token ?? "") as string;
  // Sem segredo gravado, o endpoint fica FECHADO, não aberto. É a mesma
  // escolha do webhook da Tray: falta de configuração nunca vira porta aberta.
  if (!esperado || !segredoConfere(recebido, esperado)) {
    return NextResponse.json({ erro: "segredo inválido" }, { status: 401 });
  }

  const { data: vencidos } = await supabase
    .from("contents")
    .select("id, title, slug")
    .not("scheduled_at", "is", null)
    .lte("scheduled_at", new Date().toISOString())
    .in("status", ["draft", "in_review"])
    .order("scheduled_at")
    // Teto por rodada: se algo der errado em massa, o estrago para aqui e a
    // próxima rodada pega o resto cinco minutos depois.
    .limit(20);

  const publicados: string[] = [];
  const recusados: { slug: string; motivo: string }[] = [];

  for (const c of (vencidos ?? []) as { id: string; title: string; slug: string }[]) {
    const r = await publicarNoBanco(supabase, c.id);

    if (r.ok) {
      publicados.push(c.slug);
      continue;
    }

    recusados.push({ slug: c.slug, motivo: r.erro ?? "motivo desconhecido" });
    // O agendamento continua de pé. A pessoa corrige o que falta e a próxima
    // rodada publica, sem precisar reagendar.
    await supabase
      .from("contents")
      .update({ scheduled_error: r.erro ?? "Não foi possível publicar." })
      .eq("id", c.id);
  }

  if (publicados.length || recusados.length) {
    console.log(
      `[agendamento] ${publicados.length} publicado(s), ${recusados.length} recusado(s)`,
      { publicados, recusados },
    );
  }

  return NextResponse.json({
    publicados: publicados.length,
    recusados: recusados.length,
    detalhe: { publicados, recusados },
  });
}
