import type { CSSProperties } from "react";
import { ArrowUpRight, LifeBuoy } from "lucide-react";
import { LinkRapido } from "@/components/ui/LinkRapido";
import { SETORES } from "@/lib/painel/setores";
import { COR_DO_TOM } from "@/lib/painel/tons";
import { ENDERECO_DO_SUPORTE, esperaDoCaso, type ResumoDoSuporte } from "@/lib/suporte/casos";
import { ICONE_DO_TOM } from "./Pecas";

/**
 * O aviso curto da Visão geral: o que espera a pessoa no suporte pós-venda.
 *
 * Para quem atende, o caso SEM DONO vem na frente (é o que não pode ficar
 * esquecido), com a cor do que espera há mais tempo, pela mesma régua da tela
 * do suporte; depois, o que está com a própria pessoa. Para quem passou, o
 * caso dele que fechou e ele ainda não viu. Só aparece quando há o que
 * mostrar. A cor de identidade é a do setor Vendas, onde mora o suporte.
 */
export function SuporteParaMim({ resumo, agora }: { resumo: ResumoDoSuporte; /** O instante em que o servidor montou a página. */ agora: number }) {
  const { fila, comigo, novidades } = resumo;
  if (fila + comigo + novidades === 0) return null;

  const cor = SETORES.find((s) => s.id === "vendas")?.cor;
  const casos = (n: number) => (n === 1 ? "1 caso" : `${n} casos`);
  const titulo =
    fila > 0
      ? `${casos(fila)} de suporte sem dono`
      : comigo > 0
        ? `${casos(comigo)} de suporte com você`
        : novidades === 1
          ? "1 caso seu fechou no suporte"
          : `${novidades} casos seus fecharam no suporte`;
  const espera =
    fila > 0 && resumo.filaDesde
      ? esperaDoCaso({ estado: "na_fila", abertoEm: resumo.filaDesde, assumidoEm: null, assumidoPorNome: null, fechadoPorNome: null }, agora)
      : fila === 0 && comigo > 0 && resumo.comigoDesde
        ? esperaDoCaso({ estado: "com_suporte", abertoEm: resumo.comigoDesde, assumidoEm: resumo.comigoDesde, assumidoPorNome: "você", fechadoPorNome: null }, agora)
        : null;
  const IconeDaEspera = espera ? ICONE_DO_TOM[espera.tom] : null;
  const extras = [
    fila > 0 && comigo > 0 ? `E ${casos(comigo)} com você.` : null,
    (fila > 0 || comigo > 0) && novidades > 0 ? `E ${novidades === 1 ? "1 caso seu fechou" : `${novidades} casos seus fecharam`}.` : null,
  ].filter(Boolean);

  return (
    <section className="mt-4" aria-label="O que espera você no suporte pós-venda" style={{ "--setor": cor } as CSSProperties}>
      <LinkRapido href={ENDERECO_DO_SUPORTE} className="painel-toque glass block rounded-[18px] p-4 transition-shadow hover:shadow-md sm:p-5">
        <span className="flex items-start gap-3">
          <span className="painel-selo painel-selo-ativo grid h-9 w-9 shrink-0 place-items-center rounded-[10px]">
            <LifeBuoy size={16} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="painel-cor block text-[0.7rem] font-bold uppercase tracking-wider">Suporte pós-venda</span>
            <span className="font-display mt-0.5 block text-xl leading-tight text-ink sm:text-2xl">{titulo}</span>
            {espera && espera.tom !== "neutro" ? (
              <span className="mt-1 inline-flex items-center gap-1 text-xs font-bold" style={{ color: COR_DO_TOM[espera.tom].texto }}>
                {IconeDaEspera ? <IconeDaEspera size={12} aria-hidden="true" /> : null} O que mais espera: {espera.palavra.toLowerCase()}
              </span>
            ) : null}
            {extras.length > 0 ? <span className="mt-1 block text-xs text-muted">{extras.join(" ")}</span> : null}
          </span>
          <ArrowUpRight size={17} className="painel-cor mt-1 shrink-0" aria-hidden="true" />
        </span>
      </LinkRapido>
    </section>
  );
}
