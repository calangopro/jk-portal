import type { CSSProperties } from "react";
import { ArrowUpRight, MessagesSquare } from "lucide-react";
import { LinkRapido } from "@/components/ui/LinkRapido";
import { SETORES } from "@/lib/painel/setores";
import { COR_DO_TOM } from "@/lib/painel/tons";
import { ENDERECO_DO_CHAT, esperaDoPedido, esperandoPorMim, type ResumoDoChat } from "@/lib/time/chat";
import { ICONE_DO_TOM } from "./Pecas";

/**
 * O aviso curto da Visão geral: o que espera a pessoa no chat do time.
 *
 * Só aparece quando há o que mostrar. Duas coisas diferentes entram aqui, e a
 * frase diz qual: mensagem que a pessoa ainda não leu, e pedido que espera o
 * SETOR dela (esse continua aparecendo depois de lido, até alguém responder).
 * A cor da espera é a mesma régua do chat, sempre com ícone e palavra. A cor
 * de identidade é a do setor Time, porque é para lá que o bloco leva.
 */
export function ChatParaMim({ resumo, agora }: { resumo: ResumoDoChat; /** O instante em que o servidor montou a página. */ agora: number }) {
  if (esperandoPorMim(resumo) === 0 && resumo.pedidosDoSetor === 0) return null;

  const cor = SETORES.find((s) => s.id === "time")?.cor;
  const titulo =
    resumo.pedidosDoSetor > 0
      ? resumo.pedidosDoSetor === 1
        ? "1 pedido espera o seu setor"
        : `${resumo.pedidosDoSetor} pedidos esperam o seu setor`
      : resumo.novas === 1
        ? "1 mensagem nova no chat"
        : `${resumo.novas} mensagens novas no chat`;
  // O pedido que espera há mais tempo dita a cor: é a mesma conta do selo de cada pedido na conversa.
  const espera = resumo.pedidosDoSetor > 0 && resumo.desde
    ? esperaDoPedido({ pede: true, atendidaEm: null, atendidaPorNome: null, esperandoDesde: resumo.desde, apagada: false, em: resumo.desde }, agora)
    : null;
  const IconeDaEspera = espera ? ICONE_DO_TOM[espera.tom] : null;

  return (
    <section className="mt-8" aria-label="O que espera você no chat do time" style={{ "--setor": cor } as CSSProperties}>
      <LinkRapido href={ENDERECO_DO_CHAT} className="painel-toque glass block rounded-[18px] p-4 transition-shadow hover:shadow-md sm:p-5">
        <span className="flex items-start gap-3">
          <span className="painel-selo painel-selo-ativo grid h-9 w-9 shrink-0 place-items-center rounded-[10px]">
            <MessagesSquare size={16} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="painel-cor block text-[0.7rem] font-bold uppercase tracking-wider">Chat do time</span>
            <span className="font-display mt-0.5 block text-xl leading-tight text-ink sm:text-2xl">{titulo}</span>
            {espera && espera.tom !== "neutro" ? (
              <span className="mt-1 inline-flex items-center gap-1 text-xs font-bold" style={{ color: COR_DO_TOM[espera.tom].texto }}>
                {IconeDaEspera ? <IconeDaEspera size={12} aria-hidden="true" /> : null} O que mais espera: {espera.palavra.toLowerCase()}
              </span>
            ) : null}
            {resumo.pedidosDoSetor > 0 && resumo.novas > 0 ? (
              <span className="mt-1 block text-xs text-muted">
                {resumo.novas === 1 ? "E 1 mensagem que você ainda não leu." : `E ${resumo.novas} mensagens que você ainda não leu.`}
              </span>
            ) : null}
          </span>
          <ArrowUpRight size={17} className="painel-cor mt-1 shrink-0" aria-hidden="true" />
        </span>
      </LinkRapido>
    </section>
  );
}
