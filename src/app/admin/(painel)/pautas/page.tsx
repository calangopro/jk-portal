import Link from "next/link";
import { requireStaff } from "@/lib/auth/session";
import { clustersExistentes } from "@/lib/data/admin-contents";
import { listarPautas, oportunidades, virarRascunho } from "./actions";
import { Oportunidades } from "./Oportunidades";
import { FormPauta } from "./FormPauta";
import { BotaoStatusPauta } from "./BotaoStatusPauta";
import {
  STATUS_DA_PAUTA,
  STATUS_DA_PAUTA_LABEL,
  type Pauta,
  type StatusDaPauta,
} from "@/lib/content/pautas";

export const metadata = { title: "Pautas" };

/**
 * A fila editorial.
 *
 * O gargalo do portal nunca foi escrever, foi decidir sobre o que escrever e
 * abrir o editor numa página em branco. Aqui a decisão vira objeto: a consulta
 * que a página quer ganhar, o que o Search Console dizia no dia, e o modelo que
 * o rascunho vai usar. Quando a pauta vira rascunho, o editor abre preenchido.
 *
 * A trava contra canibalização mora na criação, e não na publicação, porque
 * duas páginas na mesma intenção custam barato de evitar antes de existir texto
 * e caro de desfazer depois que as duas estão no ar.
 */
export default async function PautasPage() {
  await requireStaff();

  const [fila, oportunidadesDaBusca, clusters] = await Promise.all([
    listarPautas(),
    oportunidades(),
    clustersExistentes(),
  ]);

  const emTrabalho = fila.filter((p) => p.status !== "publicada" && p.status !== "descartada");
  const porStatus = new Map<StatusDaPauta, Pauta[]>();
  for (const p of fila) {
    const lista = porStatus.get(p.status);
    if (lista) lista.push(p);
    else porStatus.set(p.status, [p]);
  }

  return (
    <>
      <header>
        <p className="eyebrow">Editorial</p>
        <h1 className="font-display mt-2 text-4xl text-ink">Pautas</h1>
        <p className="mt-3 max-w-2xl text-muted">
          O que escrever a seguir, decidido pelo que a busca já mostra. Cada
          pauta guarda a consulta alvo e o número do dia em que a decisão foi
          tomada, então dá para responder depois se a página melhorou alguma
          coisa. Virar rascunho abre o editor já preenchido.
        </p>
      </header>

      <dl className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          { termo: "Na fila do Search Console", valor: oportunidadesDaBusca.length },
          { termo: "Pautas em trabalho", valor: emTrabalho.length },
          { termo: "Já publicadas", valor: (porStatus.get("publicada") ?? []).length },
        ].map((c) => (
          <div key={c.termo} className="glass rounded-[16px] px-5 py-4">
            <dt className="text-xs text-muted">{c.termo}</dt>
            <dd className="font-display mt-1 text-3xl text-ink">{c.valor}</dd>
          </div>
        ))}
      </dl>

      <section className="mt-10">
        <h2 className="font-display text-2xl text-ink">Oportunidades no Search Console</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Consultas em que a JK já aparece e não é clicada, ordenadas por quanto
          vale atacar. Consulta que já virou pauta ou já tem página não aparece
          aqui.{" "}
          <Link href="/admin/metricas" className="text-brand-nav underline underline-offset-4">
            Importar mais dados
          </Link>
        </p>
        <div className="mt-5">
          <Oportunidades itens={oportunidadesDaBusca} />
        </div>
      </section>

      <section className="glass mt-12 rounded-[20px] p-7">
        <h2 className="font-display text-2xl text-ink">Pauta escrita à mão</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Para o assunto que não nasce do Search Console: o que a JK pediu, o que
          a fábrica mudou, a dúvida que o atendimento ouve toda semana.
        </p>
        <div className="mt-6">
          <FormPauta clusters={clusters} />
        </div>
      </section>

      <section className="mt-12 space-y-10">
        <h2 className="font-display text-2xl text-ink">Fila ({fila.length})</h2>

        {fila.length === 0 ? (
          <p className="text-muted">
            Nenhuma pauta ainda. Comece pela lista acima: a consulta com mais
            impressão e menos clique é onde o trabalho rende mais rápido.
          </p>
        ) : (
          STATUS_DA_PAUTA.filter((s) => porStatus.has(s)).map((s) => (
            <div key={s}>
              <h3 className="font-display text-xl text-ink">
                {STATUS_DA_PAUTA_LABEL[s]}{" "}
                <span className="text-base text-muted">({porStatus.get(s)!.length})</span>
              </h3>

              <ul className="mt-4 space-y-3">
                {porStatus.get(s)!.map((p) => (
                  <li key={p.id} className="glass rounded-[16px] p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-lg text-ink">
                          {p.title?.trim() || p.targetQuery}
                        </p>
                        <p className="mt-1 text-xs text-muted">
                          Consulta alvo: {p.targetQuery}
                          {p.cluster ? `, cluster ${p.cluster}` : null}
                          {p.origem === "gsc" ? ", vinda do Search Console" : null}
                        </p>
                        {p.notes ? (
                          <p className="mt-2 text-sm leading-relaxed text-muted">{p.notes}</p>
                        ) : null}
                        {p.impressions ? (
                          <p className="mt-2 text-xs text-muted">
                            No dia da pauta: {Number(p.impressions).toLocaleString("pt-BR")} impressões,{" "}
                            {Number(p.clicks ?? 0).toLocaleString("pt-BR")} cliques, posição{" "}
                            {Number(p.position ?? 0).toFixed(1).replace(".", ",")}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <BotaoStatusPauta id={p.id} atual={p.status} />
                        {p.contentId ? (
                          <Link
                            href={`/admin/conteudos/${p.contentId}`}
                            className="text-sm text-brand-nav underline underline-offset-4 hover:text-brand-strong"
                          >
                            Abrir o rascunho
                          </Link>
                        ) : (
                          <form action={virarRascunho}>
                            <input type="hidden" name="id" value={p.id} />
                            <button
                              type="submit"
                              className="inline-flex items-center rounded-full bg-brand px-5 py-2.5 text-xs font-semibold text-ink transition-colors hover:bg-brand-light"
                            >
                              Virar rascunho
                            </button>
                          </form>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
    </>
  );
}
