import Link from "next/link";
import { FormAutor, type AutorEditavel } from "./FormAutor";
import { BotaoAtivo } from "./BotaoAtivo";

export type Linha = AutorEditavel & { is_active: boolean; conteudos: number };

/** O desenho da tela, separado da leitura para a demonstração do Como usar. */
export function TelaDosAutores({ linhas }: { linhas: Linha[] }) {
  const semCredencial = linhas.filter((l) => l.is_active && !l.credentials).length;

  return (
    <>
      <header>
        <p className="eyebrow">Conteúdo</p>
        <h1 className="font-display mt-2 text-4xl text-ink">Autores</h1>
        <p className="mt-3 max-w-2xl text-muted">
          Quem assina e quem revisa o conteúdo. Cada pessoa cadastrada ganha uma
          página própria, e a assinatura no guia passa a levar até ela. É o
          sinal de autoridade que o Google procura em conteúdo editorial.
        </p>
      </header>

      {semCredencial > 0 ? (
        <p className="mt-6 rounded-[14px] border border-brand/40 bg-brand/10 px-5 py-4 text-sm text-ink">
          {semCredencial === 1
            ? "1 pessoa ativa está sem credencial preenchida."
            : `${semCredencial} pessoas ativas estão sem credencial preenchida.`}{" "}
          A credencial é o que explica por que aquela assinatura vale.
        </p>
      ) : null}

      <section className="glass mt-8 rounded-[20px] p-7">
        <h2 className="font-display text-2xl text-ink">Cadastrar pessoa</h2>
        <div className="mt-6">
          <FormAutor />
        </div>
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="font-display text-2xl text-ink">
          Cadastradas ({linhas.length})
        </h2>

        {linhas.length === 0 ? (
          <p className="text-muted">
            Nenhuma pessoa cadastrada ainda. Enquanto isso, os posts usam o nome
            digitado à mão no editor, que funciona mas não leva a lugar nenhum.
          </p>
        ) : (
          linhas.map((l) => (
            <details
              key={l.id}
              className="glass rounded-[18px] p-6"
              open={linhas.length === 1}
            >
              <summary className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-2">
                <span className="font-display text-xl text-ink">{l.name}</span>
                {l.jobTitle ? (
                  <span className="text-sm text-muted">{l.jobTitle}</span>
                ) : null}
                {!l.is_active ? (
                  <span className="rounded-full bg-ink/10 px-3 py-1 text-xs text-ink">
                    desativada
                  </span>
                ) : null}
                <span className="text-xs text-muted">
                  {l.conteudos === 1
                    ? "1 conteúdo"
                    : `${l.conteudos} conteúdos`}
                </span>
                {!l.credentials ? (
                  <span className="rounded-full bg-wine/10 px-3 py-1 text-xs font-medium text-wine">
                    sem credencial
                  </span>
                ) : null}
              </summary>

              <div className="mt-6 border-t border-border pt-6">
                <FormAutor autor={l} />
                <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-border pt-5">
                  <Link
                    href={`/autor/${l.slug}`}
                    target="_blank"
                    rel="noopener"
                    className="text-sm text-brand-nav underline underline-offset-4 hover:text-brand-strong"
                  >
                    Ver a página no site
                  </Link>
                  <BotaoAtivo id={l.id} ativo={l.is_active} nome={l.name} />
                </div>
              </div>
            </details>
          ))
        )}
      </section>
    </>
  );
}
