import Link from "next/link";
import { requireStaff } from "@/lib/auth/session";
import { listarFatos } from "./actions";
import { FormFato } from "./FormFato";
import { BotaoStatus } from "./BotaoStatus";
import {
  MODULOS_DO_FATO,
  MODULO_LABEL,
  STATUS_LABEL,
  dataLegivel,
  type Fato,
  type ModuloDoFato,
} from "@/lib/content/fatos";

export const metadata = { title: "Base de fatos" };

const COR_DO_STATUS: Record<string, string> = {
  aprovado: "bg-brand/20 text-ink",
  validar: "bg-wine/10 text-wine",
  extraido: "bg-ink/10 text-ink",
  desatualizado: "bg-ink/10 text-muted line-through",
};

/**
 * Base de fatos aprovados.
 *
 * É o card BASE MESTRA DE CONHECIMENTO JK do Trello virando tela. A regra do
 * projeto sempre disse que nenhuma afirmação vai ao ar sem fonte, e a
 * publicação já travava sem isso, só que a fonte era por conteúdo: o mesmo fato
 * precisava ser redigitado em cada guia. O resultado previsível foi a tabela de
 * fontes ficar zerada.
 *
 * Aqui o fato é escrito uma vez. No editor, citar o fato grava a fonte daquele
 * conteúdo sozinha.
 */
export default async function FatosPage() {
  await requireStaff();
  const fatos = await listarFatos();

  const aprovados = fatos.filter((f) => f.status === "aprovado").length;
  const esperando = fatos.filter((f) => f.status === "validar" || f.status === "extraido").length;
  const caducos = fatos.filter((f) => f.status === "desatualizado" && (f.usos ?? 0) > 0);

  const porModulo = new Map<ModuloDoFato, Fato[]>();
  for (const f of fatos) {
    const lista = porModulo.get(f.module);
    if (lista) lista.push(f);
    else porModulo.set(f.module, [f]);
  }

  return (
    <>
      <header>
        <p className="eyebrow">Editorial</p>
        <h1 className="font-display mt-2 text-4xl text-ink">Base de fatos</h1>
        <p className="mt-3 max-w-2xl text-muted">
          Tudo que o portal pode afirmar sobre a JK, escrito uma vez e com origem
          registrada. No editor, citar um fato daqui grava a fonte do conteúdo
          sozinha, então a trava de publicação deixa de ser um formulário no fim
          e passa a ser consequência do trabalho.
        </p>
      </header>

      <dl className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          { termo: "Prontos para citar", valor: aprovados },
          { termo: "Esperando validação", valor: esperando },
          { termo: "Total na base", valor: fatos.length },
        ].map((c) => (
          <div key={c.termo} className="glass rounded-[16px] px-5 py-4">
            <dt className="text-xs text-muted">{c.termo}</dt>
            <dd className="font-display mt-1 text-3xl text-ink">{c.valor}</dd>
          </div>
        ))}
      </dl>

      {caducos.length > 0 ? (
        <p className="mt-6 rounded-[14px] border border-wine/40 bg-wine/10 px-5 py-4 text-sm text-ink">
          {caducos.length === 1
            ? "1 fato marcado como desatualizado ainda é citado por conteúdo publicado."
            : `${caducos.length} fatos marcados como desatualizados ainda são citados por conteúdo publicado.`}{" "}
          Abra cada um e revise os posts que dependem dele.
        </p>
      ) : null}

      <section className="glass mt-8 rounded-[20px] p-7">
        <h2 className="font-display text-2xl text-ink">Registrar fato</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Um fato por afirmação. Se a frase junta duas coisas que vêm de fontes
          diferentes, separe, senão a revisão de uma arrasta a outra.
        </p>
        <div className="mt-6">
          <FormFato />
        </div>
      </section>

      <section className="mt-10 space-y-10">
        {fatos.length === 0 ? (
          <p className="text-muted">
            A base está vazia. Comece pelo que já está no ar: o que a página
            Sobre Nós afirma, o que a política de garantia diz, e os números que
            a JK confirmou.
          </p>
        ) : (
          MODULOS_DO_FATO.filter((m) => porModulo.has(m)).map((m) => (
            <div key={m}>
              <h2 className="font-display text-2xl text-ink">
                {MODULO_LABEL[m]}{" "}
                <span className="text-base text-muted">({porModulo.get(m)!.length})</span>
              </h2>

              <div className="mt-4 space-y-3">
                {porModulo.get(m)!.map((f) => (
                  <details key={f.id} className="glass rounded-[18px] p-6">
                    <summary className="flex cursor-pointer flex-wrap items-start gap-x-4 gap-y-2">
                      <span className="min-w-0 flex-1 text-ink">{f.claim}</span>
                      <span
                        className={`shrink-0 rounded-full px-3 py-1 text-xs ${
                          COR_DO_STATUS[f.status] ?? "bg-ink/10 text-ink"
                        }`}
                      >
                        {STATUS_LABEL[f.status]}
                      </span>
                      <span className="shrink-0 text-xs text-muted">
                        {(f.usos ?? 0) === 1 ? "1 conteúdo cita" : `${f.usos ?? 0} conteúdos citam`}
                      </span>
                    </summary>

                    <div className="mt-5 border-t border-border pt-5">
                      <p className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
                        {f.sourceUrl ? (
                          <a
                            href={f.sourceUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="text-brand-strong underline underline-offset-4"
                          >
                            {new URL(f.sourceUrl).hostname}
                          </a>
                        ) : null}
                        {f.capturedAt ? <span>conferido em {dataLegivel(f.capturedAt)}</span> : null}
                        {f.responsible ? <span>por {f.responsible}</span> : null}
                        <BotaoStatus id={f.id} atual={f.status} usos={f.usos ?? 0} />
                      </p>

                      <div className="mt-6">
                        <FormFato fato={f} />
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      <p className="mt-10 text-sm text-muted">
        Fato não se apaga, se marca como desatualizado. Assim o conteúdo que
        citou aquilo continua rastreável, que é o motivo de a base existir.{" "}
        <Link href="/admin/conteudos" className="text-brand-nav underline underline-offset-4">
          Ver os conteúdos
        </Link>
      </p>
    </>
  );
}
