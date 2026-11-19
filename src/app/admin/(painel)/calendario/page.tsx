import { requireArea } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { FUSO, atrasado } from "@/lib/content/agenda";
import { TelaDoCalendario, type Item } from "./Tela";

export const metadata = { title: "Calendário" };

/** "2026-08-20T12:00:00Z" vira "2026-08-20" no fuso de São Paulo. */
function diaEmSaoPaulo(iso: string): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: FUSO }).format(new Date(iso));
}

/** Primeiro e último instante do mês pedido, já em UTC, para consultar o banco. */
function limitesDoMes(mes: string) {
  const [ano, m] = mes.split("-").map(Number);
  // O mês vai de dia 1 às 00:00 até o dia 1 do mês seguinte. Três horas de
  // folga de cada lado cobrem a diferença de fuso sem cálculo extra: o
  // recorte fino acontece depois, ao agrupar por dia.
  const inicio = new Date(Date.UTC(ano, m - 1, 1, 0, 0) - 6 * 3600_000);
  const fim = new Date(Date.UTC(ano, m, 1, 0, 0) + 6 * 3600_000);
  return { inicio: inicio.toISOString(), fim: fim.toISOString(), ano, mes: m };
}

/**
 * Calendário editorial.
 *
 * A grade existe para os BURACOS aparecerem. Uma lista de conteúdos ordenada
 * por data esconde três semanas sem nada publicado; a grade mostra isso na
 * cara, e é essa visão que muda o ritmo de publicação.
 *
 * Mostra o que já foi ao ar, o que está marcado para ir, e embaixo o que ainda
 * não tem data, que é de onde sai o próximo agendamento.
 */
export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  await requireArea("conteudo");
  const { mes } = await searchParams;

  const hoje = new Date();
  const mesAtual = new Intl.DateTimeFormat("sv-SE", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
  }).format(hoje);

  const alvo = /^\d{4}-\d{2}$/.test(mes ?? "") ? mes! : mesAtual;
  const { inicio, fim, ano, mes: numeroDoMes } = limitesDoMes(alvo);

  const supabase = await createClient();
  const [{ data: publicados }, { data: agendados }, { data: semData }, { data: pautas }] =
    await Promise.all([
      supabase
        .from("contents")
        .select("id, title, published_at")
        .eq("status", "published")
        .gte("published_at", inicio)
        .lt("published_at", fim),
      supabase
        .from("contents")
        .select("id, title, scheduled_at, scheduled_error")
        .not("scheduled_at", "is", null)
        .gte("scheduled_at", inicio)
        .lt("scheduled_at", fim),
      supabase
        .from("contents")
        .select("id, title, status")
        .in("status", ["draft", "in_review"])
        .is("scheduled_at", null)
        .order("updated_at", { ascending: false }),
      supabase
        .from("briefings")
        .select("id, target_query, title, status")
        .is("content_id", null)
        .in("status", ["ideia", "pronta"])
        .order("created_at", { ascending: false }),
    ]);

  const porDia = new Map<string, Item[]>();
  const guardar = (i: Item) => {
    const dia = diaEmSaoPaulo(i.quando);
    const lista = porDia.get(dia);
    if (lista) lista.push(i);
    else porDia.set(dia, [i]);
  };

  for (const c of (publicados ?? []) as { id: string; title: string; published_at: string }[]) {
    guardar({ id: c.id, titulo: c.title, quando: c.published_at, tipo: "publicado" });
  }
  for (const c of (agendados ?? []) as {
    id: string;
    title: string;
    scheduled_at: string;
    scheduled_error: string | null;
  }[]) {
    guardar({
      id: c.id,
      titulo: c.title,
      quando: c.scheduled_at,
      tipo: "agendado",
      erro: c.scheduled_error,
    });
  }

  const hojeEmSp = new Intl.DateTimeFormat("sv-SE", { timeZone: FUSO }).format(hoje);

  const comAtraso = ((agendados ?? []) as { scheduled_at: string }[]).filter((c) =>
    atrasado(c.scheduled_at),
  ).length;

  return (
    <TelaDoCalendario
      ano={ano}
      numeroDoMes={numeroDoMes}
      hojeEmSp={hojeEmSp}
      porDia={porDia}
      semData={(semData ?? []) as { id: string; title: string; status: string }[]}
      pautas={(pautas ?? []) as { id: string; target_query: string; title: string | null; status: string }[]}
      comAtraso={comAtraso}
    />
  );
}
