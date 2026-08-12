import { Fragment } from "react";
import Link from "next/link";
import { Link2 as LinkIcon } from "lucide-react";
import { requireStaff } from "@/lib/auth/session";
import { listarConteudos, paginasOrfas, STATUS_LABEL, type ContentRow } from "@/lib/data/admin-contents";
import { duplicarConteudo, mudarStatus, apagarDefinitivo } from "./actions";
import { NovoConteudo } from "./NovoConteudo";

export const metadata = { title: "Conteúdos" };

const CORES: Record<ContentRow["status"], string> = {
  published: "bg-brand/15 text-brand-strong",
  draft: "bg-ink/10 text-ink/70",
  in_review: "bg-wine/10 text-wine",
  archived: "bg-muted/15 text-muted",
};

function quando(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function ConteudosPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const perfil = await requireStaff();
  const { erro } = await searchParams;
  const [itens, orfas] = await Promise.all([listarConteudos(), paginasOrfas()]);

  // Agrupado por assunto, porque é assim que o conteúdo é planejado e é assim
  // que dá para ver de relance qual cluster está raso. Sem assunto definido vai
  // para o fim, onde incomoda o suficiente para ser resolvido.
  const grupos = new Map<string, ContentRow[]>();
  for (const c of itens) {
    const chave = c.cluster?.trim() || "";
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave)!.push(c);
  }
  const ordenados = [...grupos.entries()].sort((a, b) =>
    a[0] === "" ? 1 : b[0] === "" ? -1 : a[0].localeCompare(b[0], "pt-BR"),
  );
  const temCluster = ordenados.some(([nome]) => nome !== "");

  const botao =
    "rounded-full border border-ink/15 px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-brand/50 hover:text-brand-nav";

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Editorial</p>
          <h1 className="font-display mt-2 text-4xl text-ink">Conteúdos</h1>
          <p className="mt-3 text-muted">
            Guias e artigos do portal. Cada peça nasce como rascunho e só vai ao
            ar depois de revisada.
          </p>
        </div>
        <NovoConteudo />
      </header>

      {erro ? (
        <p
          role="alert"
          className="mt-6 rounded-[14px] border border-wine/40 bg-wine/10 px-5 py-4 text-sm text-wine"
        >
          {erro}
        </p>
      ) : null}

      {orfas.length > 0 ? (
        <section className="glass mt-8 rounded-[20px] border border-brand/30 p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <LinkIcon size={14} className="text-brand-nav" />
            {orfas.length === 1
              ? "1 página publicada não é citada por nenhuma outra"
              : `${orfas.length} páginas publicadas não são citadas por nenhuma outra`}
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            Página sem link de entrada recebe autoridade só da home e do sitemap. Cite cada uma delas
            de dentro de um guia relacionado.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {orfas.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/admin/conteudos/${o.id}`}
                  className="inline-block rounded-full border border-border bg-white/70 px-3 py-1.5 text-xs font-medium text-ink hover:border-brand hover:text-brand-nav"
                >
                  {o.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="glass mt-8 overflow-hidden rounded-[20px]">
        {itens.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="font-display text-2xl text-ink">Nenhum conteúdo ainda</p>
            <p className="mx-auto mt-3 max-w-md text-sm text-muted">
              Comece pelo cluster de alianças de namoro, que é a primeira
              batalha do projeto.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead>
                <tr className="border-b border-border/70 text-xs uppercase tracking-wider text-muted">
                  <th className="px-6 py-4 font-semibold">Título</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Atualizado</th>
                  <th className="px-6 py-4 font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {ordenados.map(([nome, doGrupo]) => (
                  <Fragment key={nome || "sem-assunto"}>
                    {temCluster ? (
                      <tr>
                        <th
                          colSpan={4}
                          scope="colgroup"
                          className="border-b border-border/60 bg-brand/8 px-6 py-2 text-left text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-brand-strong"
                        >
                          {nome || "Sem assunto definido"}
                          <span className="ml-2 font-normal normal-case tracking-normal text-muted">
                            {doGrupo.length} {doGrupo.length === 1 ? "página" : "páginas"}
                          </span>
                        </th>
                      </tr>
                    ) : null}
                    {doGrupo.map((c) => (
                  <tr key={c.id} className="border-b border-border/50 last:border-0">
                    <td className="px-6 py-4">
                      <Link
                        href={`/admin/conteudos/${c.id}`}
                        className="font-medium text-ink hover:text-brand-nav"
                      >
                        {c.title}
                      </Link>
                      <p className="text-xs text-muted">/guia/{c.slug}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${CORES[c.status]}`}>
                        {STATUS_LABEL[c.status]}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-muted">{quando(c.updated_at)}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/admin/conteudos/${c.id}`} className={botao}>
                          Editar
                        </Link>

                        {c.status === "published" ? (
                          <Link
                            href={`/guia/${c.slug}`}
                            target="_blank"
                            className={botao}
                          >
                            Ver ↗
                          </Link>
                        ) : null}

                        <form action={duplicarConteudo}>
                          <input type="hidden" name="id" value={c.id} />
                          <button type="submit" className={botao}>Duplicar</button>
                        </form>

                        {c.status !== "published" ? (
                          <form action={mudarStatus}>
                            <input type="hidden" name="id" value={c.id} />
                            <input type="hidden" name="status" value="published" />
                            <button type="submit" className={botao}>Publicar</button>
                          </form>
                        ) : (
                          <form action={mudarStatus}>
                            <input type="hidden" name="id" value={c.id} />
                            <input type="hidden" name="status" value="draft" />
                            <button type="submit" className={botao}>Despublicar</button>
                          </form>
                        )}

                        {c.status !== "archived" ? (
                          <form action={mudarStatus}>
                            <input type="hidden" name="id" value={c.id} />
                            <input type="hidden" name="status" value="archived" />
                            <button
                              type="submit"
                              className="rounded-full border border-ink/15 px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-wine/50 hover:text-wine"
                            >
                              Arquivar
                            </button>
                          </form>
                        ) : (
                          <>
                            <form action={mudarStatus}>
                              <input type="hidden" name="id" value={c.id} />
                              <input type="hidden" name="status" value="draft" />
                              <button type="submit" className={botao}>Restaurar</button>
                            </form>
                            {perfil.role === "admin" ? (
                              <form action={apagarDefinitivo}>
                                <input type="hidden" name="id" value={c.id} />
                                <button
                                  type="submit"
                                  className="rounded-full border border-wine/30 px-3 py-1.5 text-xs font-semibold text-wine transition-colors hover:bg-wine hover:text-white"
                                >
                                  Apagar
                                </button>
                              </form>
                            ) : null}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
