import type { CSSProperties } from "react";
import { ArrowUpRight, MessagesSquare } from "lucide-react";
import { LinkRapido } from "@/components/ui/LinkRapido";
import { SETORES } from "@/lib/painel/setores";
import { COR_DO_TOM } from "@/lib/painel/tons";
import { NOME_DO_TIPO, esperaDoChamado, paraQuem, piorEspera, type Chamado } from "@/lib/time/chamados";
import { ICONE_DO_TOM } from "./Pecas";

/**
 * O aviso curto da Visão geral: quantos chamados esperam a resposta da pessoa
 * e quantos chamados dela já foram respondidos.
 *
 * Só aparece quando há o que mostrar. A cor da espera é a mesma da tela de
 * chamados (a pior entre os que esperam), sempre com ícone e palavra. A cor de
 * identidade é a do setor Time, porque é para lá que o bloco leva.
 */
export function ChamadosParaMim({
  paraResponder, respondidos, agora,
}: {
  paraResponder: Chamado[];
  respondidos: Chamado[];
  /** O instante em que o servidor montou a página. */
  agora: number;
}) {
  if (paraResponder.length === 0 && respondidos.length === 0) return null;

  const cor = SETORES.find((s) => s.id === "time")?.cor;
  const pior = piorEspera(paraResponder, agora);
  const IconeDaEspera = pior ? ICONE_DO_TOM[pior.tom] : null;
  const titulo =
    paraResponder.length === 0
      ? respondidos.length === 1
        ? "1 chamado seu foi respondido"
        : `${respondidos.length} chamados seus foram respondidos`
      : paraResponder.length === 1
        ? "1 chamado espera a sua resposta"
        : `${paraResponder.length} chamados esperam a sua resposta`;
  const primeiros = [...paraResponder].sort((a, b) => Date.parse(a.aguardandoDesde) - Date.parse(b.aguardandoDesde)).slice(0, 3);

  return (
    <section className="mt-8" aria-label="Chamados que esperam você" style={{ "--setor": cor } as CSSProperties}>
      <LinkRapido href="/admin/chamados" className="painel-toque glass block rounded-[18px] p-4 transition-shadow hover:shadow-md sm:p-5">
        <span className="flex items-start gap-3">
          <span className="painel-selo painel-selo-ativo grid h-9 w-9 shrink-0 place-items-center rounded-[10px]">
            <MessagesSquare size={16} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="painel-cor block text-[0.7rem] font-bold uppercase tracking-wider">Chamados</span>
            <span className="font-display mt-0.5 block text-xl leading-tight text-ink sm:text-2xl">{titulo}</span>
            {pior && pior.tom !== "neutro" ? (
              <span className="mt-1 inline-flex items-center gap-1 text-xs font-bold" style={{ color: COR_DO_TOM[pior.tom].texto }}>
                {IconeDaEspera ? <IconeDaEspera size={12} aria-hidden="true" /> : null} O que mais espera: {pior.palavra.toLowerCase()}
              </span>
            ) : null}
            {paraResponder.length > 0 && respondidos.length > 0 ? (
              <span className="mt-1 block text-xs text-muted">
                {respondidos.length === 1 ? "E 1 chamado seu já tem resposta." : `E ${respondidos.length} chamados seus já têm resposta.`}
              </span>
            ) : null}
          </span>
          <ArrowUpRight size={17} className="painel-cor mt-1 shrink-0" aria-hidden="true" />
        </span>

        {primeiros.length > 0 ? (
          <ul className="mt-3 space-y-1.5 border-t border-ink/[0.07] pt-3">
            {primeiros.map((c) => (
              <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                <span className="min-w-0 break-words text-ink">
                  <span className="font-semibold">{NOME_DO_TIPO[c.tipo]}</span>
                  <span className="text-muted">
                    , de {c.abertoPorNome ?? "alguém do time"} para {paraQuem(c)}
                  </span>
                </span>
                <span className="numeros shrink-0 text-xs text-muted">{esperaDoChamado(c, agora).palavra.toLowerCase()}</span>
              </li>
            ))}
            {paraResponder.length > 3 ? <li className="text-xs text-muted">e mais {paraResponder.length - 3}</li> : null}
          </ul>
        ) : null}
      </LinkRapido>
    </section>
  );
}
