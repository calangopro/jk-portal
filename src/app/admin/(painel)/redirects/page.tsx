import Link from "next/link";
import { requireStaff } from "@/lib/auth/session";
import {
  aceitarSugestao,
  enderecosQuebrados,
  ignorarEndereco,
  listarRedirects,
  removerRedirect,
} from "./actions";
import { FormRedirect } from "./FormRedirect";
import { quandoLegivel } from "@/lib/content/agenda";

export const metadata = { title: "Redirects" };

const ROTULO: Record<string, string> = {
  "301": "Mudou de lugar",
  "302": "Temporário",
  "410": "Saiu de vez",
};

const botao =
  "rounded-full border border-border px-3 py-1.5 text-xs text-ink transition-colors hover:border-brand/50 hover:bg-white";

/**
 * Redirects e endereços quebrados.
 *
 * A tabela `redirects` existe desde a primeira migration e o middleware a serve
 * em toda requisição pública, só que nunca houve tela para cadastrar. O mapa de
 * redirect que o card P0 do Trello exige antes de qualquer mexida em URL não
 * podia ser feito pelo painel.
 *
 * A fila de cima é o outro lado da mesma moeda: sem saber QUAIS endereços as
 * pessoas pedem e não existem, cadastrar redirect seria adivinhação. O Search
 * Console mostra isso com semanas de atraso e só para o que o Google rastreou,
 * então link antigo em impresso e link colado no WhatsApp nunca apareciam.
 */
export default async function RedirectsPage() {
  await requireStaff();
  const [quebrados, redirects] = await Promise.all([enderecosQuebrados(), listarRedirects()]);

  return (
    <>
      <header>
        <p className="eyebrow">Site</p>
        <h1 className="font-display mt-2 text-4xl text-ink">Redirects</h1>
        <p className="mt-3 max-w-2xl text-muted">
          Endereço que mudou de lugar precisa levar a pessoa ao lugar novo, e
          precisa dizer isso ao Google. Aqui em cima estão os endereços que
          alguém pediu hoje e não existem; embaixo, os desvios já cadastrados.
        </p>
      </header>

      <section className="mt-10">
        <h2 className="font-display text-2xl text-ink">
          Endereços quebrados ({quebrados.length})
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Contados quando a página de erro aparece de verdade para alguém.
          Varredura de robô procurando outra plataforma fica de fora.
        </p>

        <div className="mt-5 space-y-3">
          {quebrados.length === 0 ? (
            <p className="rounded-[14px] border border-dashed border-border px-5 py-4 text-sm leading-relaxed text-muted">
              Nenhum endereço quebrado na fila. É o estado bom: ou ninguém está
              batendo em link morto, ou tudo que apareceu já foi resolvido.
            </p>
          ) : (
            quebrados.map((q) => (
              <div key={q.path} className="glass rounded-[16px] p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm text-ink">{q.path}</p>
                    <p className="mt-1.5 text-xs text-muted">
                      {q.hits === 1 ? "1 pedido" : `${q.hits} pedidos`}, o último em{" "}
                      {quandoLegivel(q.ultimaVez)}
                      {q.referrer ? (
                        <>
                          , vindo de{" "}
                          <span className="break-all text-brand-strong">{q.referrer}</span>
                        </>
                      ) : null}
                    </p>
                    {q.sugestao ? (
                      <p className="mt-2 text-sm text-ink">
                        Palpite de destino:{" "}
                        <span className="font-medium">{q.sugestaoTitulo}</span>{" "}
                        <span className="text-muted">({q.sugestao})</span>
                      </p>
                    ) : (
                      <p className="mt-2 text-sm text-muted">
                        Nenhuma página parecida. Escolha o destino no formulário
                        abaixo, ou marque como 410 se não houver substituto.
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {q.sugestao ? (
                      <form action={aceitarSugestao}>
                        <input type="hidden" name="path" value={q.path} />
                        <input type="hidden" name="sugestao" value={q.sugestao} />
                        <button
                          type="submit"
                          className="rounded-full bg-brand px-4 py-2 text-xs font-semibold text-ink transition-colors hover:bg-brand-light"
                        >
                          Criar o desvio
                        </button>
                      </form>
                    ) : null}
                    <form action={ignorarEndereco}>
                      <input type="hidden" name="path" value={q.path} />
                      <button type="submit" className={botao}>
                        Tirar da fila
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="glass mt-12 rounded-[20px] p-7">
        <h2 className="font-display text-2xl text-ink">Criar redirect</h2>
        <div className="mt-6">
          <FormRedirect />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl text-ink">
          Desvios cadastrados ({redirects.length})
        </h2>

        {redirects.length === 0 ? (
          <p className="mt-4 text-muted">
            Nenhum redirect cadastrado. Enquanto a tabela estiver vazia o
            middleware não desvia nada, e todo endereço antigo continua caindo em
            404.
          </p>
        ) : (
          <div className="mt-5 space-y-3">
            {redirects.map((r) => (
              <details key={r.id} className="glass rounded-[16px] p-5">
                <summary className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-2">
                  <span className="font-mono text-sm text-ink">{r.origem}</span>
                  <span aria-hidden className="text-muted">
                    →
                  </span>
                  <span className="font-mono text-sm text-muted">
                    {r.status === "410" ? "página removida" : r.destino}
                  </span>
                  <span className="rounded-full bg-ink/10 px-3 py-1 text-xs text-ink">
                    {ROTULO[r.status]}
                  </span>
                </summary>

                <div className="mt-5 border-t border-border pt-5">
                  {r.motivo ? (
                    <p className="mb-5 text-sm text-muted">{r.motivo}</p>
                  ) : (
                    <p className="mb-5 text-sm text-wine">
                      Sem motivo registrado. Preencha, senão daqui a seis meses
                      ninguém vai saber por que este desvio existe.
                    </p>
                  )}
                  <FormRedirect redirect={r} />
                  <form action={removerRedirect} className="mt-5 border-t border-border pt-5">
                    <input type="hidden" name="id" value={r.id} />
                    <button
                      type="submit"
                      className="text-sm text-muted underline underline-offset-4 transition-colors hover:text-wine"
                    >
                      Remover este desvio
                    </button>
                  </form>
                </div>
              </details>
            ))}
          </div>
        )}
      </section>

      <p className="mt-10 text-sm text-muted">
        O middleware guarda a lista em memória por um minuto, então um desvio
        novo pode levar até esse tempo para valer.{" "}
        <Link href="/admin/conteudos" className="text-brand-nav underline underline-offset-4">
          Ver os conteúdos
        </Link>
      </p>
    </>
  );
}
