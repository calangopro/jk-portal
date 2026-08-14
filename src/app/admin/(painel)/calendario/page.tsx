import Link from "next/link";
import { requireStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { FUSO, atrasado, quandoLegivel } from "@/lib/content/agenda";
import { STATUS_DA_PAUTA_LABEL, type StatusDaPauta } from "@/lib/content/pautas";

export const metadata = { title: "Calendário" };

type Item = {
  id: string;
  titulo: string;
  quando: string;
  tipo: "publicado" | "agendado";
  erro?: string | null;
};

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

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

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
  await requireStaff();
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

  // Monta a grade: começa no domingo da semana do dia 1.
  const primeiro = new Date(Date.UTC(ano, numeroDoMes - 1, 1));
  const diasNoMes = new Date(Date.UTC(ano, numeroDoMes, 0)).getUTCDate();
  const vaziosAntes = primeiro.getUTCDay();

  const celulas: (number | null)[] = [
    ...Array.from({ length: vaziosAntes }, () => null),
    ...Array.from({ length: diasNoMes }, (_, i) => i + 1),
  ];
  while (celulas.length % 7 !== 0) celulas.push(null);

  const chaveDoDia = (d: number) =>
    `${ano}-${String(numeroDoMes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const hojeEmSp = new Intl.DateTimeFormat("sv-SE", { timeZone: FUSO }).format(hoje);
  const nomeDoMes = new Date(Date.UTC(ano, numeroDoMes - 1, 15)).toLocaleDateString("pt-BR", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });

  const outroMes = (passo: number) => {
    const d = new Date(Date.UTC(ano, numeroDoMes - 1 + passo, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  };

  const comAtraso = ((agendados ?? []) as { scheduled_at: string }[]).filter((c) =>
    atrasado(c.scheduled_at),
  ).length;

  return (
    <>
      <header>
        <p className="eyebrow">Editorial</p>
        <h1 className="font-display mt-2 text-4xl text-ink">Calendário</h1>
        <p className="mt-3 max-w-2xl text-muted">
          O que já foi ao ar e o que está marcado para ir. A grade existe para os
          buracos aparecerem: numa lista ordenada por data, três semanas sem nada
          publicado passam despercebidas.
        </p>
      </header>

      {comAtraso > 0 ? (
        <p className="mt-6 rounded-[14px] border border-wine/40 bg-wine/10 px-5 py-4 text-sm text-ink">
          {comAtraso === 1
            ? "1 página passou da hora marcada e não entrou no ar."
            : `${comAtraso} páginas passaram da hora marcada e não entraram no ar.`}{" "}
          Abra cada uma para ver o que a trava recusou.
        </p>
      ) : null}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-display text-2xl capitalize text-ink">{nomeDoMes}</h2>
        <nav className="flex items-center gap-2 text-sm" aria-label="Navegar entre meses">
          <Link
            href={`/admin/calendario?mes=${outroMes(-1)}`}
            className="rounded-full border border-border px-4 py-2 text-ink transition-colors hover:border-brand/50"
          >
            Mês anterior
          </Link>
          <Link
            href="/admin/calendario"
            className="rounded-full border border-border px-4 py-2 text-ink transition-colors hover:border-brand/50"
          >
            Hoje
          </Link>
          <Link
            href={`/admin/calendario?mes=${outroMes(1)}`}
            className="rounded-full border border-border px-4 py-2 text-ink transition-colors hover:border-brand/50"
          >
            Próximo mês
          </Link>
        </nav>
      </div>

      <div className="mt-5 overflow-x-auto">
        <div className="min-w-[44rem]">
          <div className="grid grid-cols-7 gap-2">
            {DIAS.map((d) => (
              <div key={d} className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted">
                {d}
              </div>
            ))}

            {celulas.map((dia, i) => {
              if (dia === null) return <div key={`vazio-${i}`} aria-hidden />;
              const chave = chaveDoDia(dia);
              const itens = porDia.get(chave) ?? [];
              const ehHoje = chave === hojeEmSp;

              return (
                <div
                  key={chave}
                  className={`min-h-24 rounded-[12px] border p-2 ${
                    ehHoje ? "border-brand bg-brand/5" : "border-border bg-white/40"
                  }`}
                >
                  <p className={`text-xs ${ehHoje ? "font-semibold text-brand-strong" : "text-muted"}`}>
                    {dia}
                  </p>
                  <ul className="mt-1 space-y-1">
                    {itens.map((it) => (
                      <li key={`${it.tipo}-${it.id}`}>
                        <Link
                          href={`/admin/conteudos/${it.id}`}
                          title={`${it.titulo}, ${quandoLegivel(it.quando)}`}
                          className={`block truncate rounded-[6px] px-1.5 py-1 text-[0.7rem] leading-tight transition-colors ${
                            it.tipo === "publicado"
                              ? "bg-ink/85 text-white hover:bg-ink"
                              : it.erro || atrasado(it.quando)
                                ? "bg-wine/15 text-wine hover:bg-wine/25"
                                : "bg-brand/25 text-ink hover:bg-brand/40"
                          }`}
                        >
                          {it.titulo}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <p className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted">
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-[4px] bg-ink/85" aria-hidden /> publicado
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-[4px] bg-brand/40" aria-hidden /> agendado
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-[4px] bg-wine/25" aria-hidden /> passou da
          hora e não entrou
        </span>
      </p>

      <section className="mt-12 grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-2xl text-ink">
            Escrito, sem data ({(semData ?? []).length})
          </h2>
          <p className="mt-2 text-sm text-muted">
            É daqui que sai o próximo agendamento. Abra e marque a hora.
          </p>
          <ul className="mt-4 space-y-2">
            {(semData ?? []).length === 0 ? (
              <li className="text-sm text-muted">Nada em rascunho no momento.</li>
            ) : (
              ((semData ?? []) as { id: string; title: string; status: string }[]).map((c) => (
                <li key={c.id} className="glass rounded-[12px] px-4 py-3">
                  <Link href={`/admin/conteudos/${c.id}`} className="text-sm text-ink hover:underline">
                    {c.title}
                  </Link>
                  <span className="ml-2 text-xs text-muted">
                    {c.status === "in_review" ? "em revisão" : "rascunho"}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>

        <div>
          <h2 className="font-display text-2xl text-ink">
            Pautas esperando ({(pautas ?? []).length})
          </h2>
          <p className="mt-2 text-sm text-muted">
            Decididas e ainda não escritas.{" "}
            <Link href="/admin/pautas" className="text-brand-nav underline underline-offset-4">
              Ver a fila
            </Link>
          </p>
          <ul className="mt-4 space-y-2">
            {(pautas ?? []).length === 0 ? (
              <li className="text-sm text-muted">Nenhuma pauta na fila.</li>
            ) : (
              ((pautas ?? []) as {
                id: string;
                target_query: string;
                title: string | null;
                status: string;
              }[]).map((p) => (
                <li key={p.id} className="glass rounded-[12px] px-4 py-3">
                  <span className="text-sm text-ink">{p.title?.trim() || p.target_query}</span>
                  <span className="ml-2 text-xs text-muted">
                    {STATUS_DA_PAUTA_LABEL[p.status as StatusDaPauta]}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>
    </>
  );
}
