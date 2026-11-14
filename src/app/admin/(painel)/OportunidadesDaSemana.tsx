import type { CSSProperties } from "react";
import { ArrowUpRight, BellRing } from "lucide-react";
import { LinkRapido } from "@/components/ui/LinkRapido";
import type { OportunidadeDaLista } from "@/lib/clientes/dados";
import { NOME_DO_TIPO, prazoEmPalavra } from "@/lib/clientes/oportunidades";
import { SETORES } from "@/lib/painel/setores";

/**
 * O aviso curto da Visão geral: quantas oportunidades de venda vencem nesta
 * semana, com as três primeiras e a porta para a lista.
 *
 * Aparece só para quem tem a área de lançar venda, e só quando há o que
 * mostrar: sem oportunidade na semana e sem atraso, o bloco não ocupa a tela.
 * A cor é a do setor de Vendas, porque é para lá que o bloco leva.
 */
export function OportunidadesDaSemana({ lista }: { lista: OportunidadeDaLista[] }) {
  const daSemana = lista.filter((o) => o.emDias >= 0 && o.emDias <= 7);
  const atrasadas = lista.filter((o) => o.emDias < 0).length;
  if (daSemana.length === 0 && atrasadas === 0) return null;

  const cor = SETORES.find((s) => s.id === "vendas")?.cor;
  const titulo =
    daSemana.length === 0
      ? "Nenhuma oportunidade nova nesta semana"
      : daSemana.length === 1
        ? "1 oportunidade de venda vence nesta semana"
        : `${daSemana.length} oportunidades de venda vencem nesta semana`;

  return (
    <section className="mt-8" aria-label="Oportunidades de venda da semana" style={{ "--setor": cor } as CSSProperties}>
      <LinkRapido href="/admin/oportunidades" className="painel-toque glass block rounded-[18px] p-4 transition-shadow hover:shadow-md sm:p-5">
        <span className="flex items-start gap-3">
          <span className="painel-selo painel-selo-ativo grid h-9 w-9 shrink-0 place-items-center rounded-[10px]">
            <BellRing size={16} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="painel-cor block text-[0.7rem] font-bold uppercase tracking-wider">Oportunidades</span>
            <span className="font-display mt-0.5 block text-xl leading-tight text-ink sm:text-2xl">{titulo}</span>
            {atrasadas > 0 ? (
              <span className="mt-1 block text-xs text-muted">
                {atrasadas === 1 ? "Mais 1 que passou da data e ninguém marcou." : `Mais ${atrasadas} que passaram da data e ninguém marcou.`}
              </span>
            ) : null}
          </span>
          <ArrowUpRight size={17} className="painel-cor mt-1 shrink-0" aria-hidden="true" />
        </span>

        {daSemana.length > 0 ? (
          <ul className="mt-3 space-y-1.5 border-t border-ink/[0.07] pt-3">
            {daSemana.slice(0, 3).map((o) => (
              <li key={`${o.ref}|${o.tipo}|${o.ocorrencia}`} className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                <span className="min-w-0 break-words text-ink">
                  <span className="font-semibold">{o.cliente ?? "Cliente sem nome"}</span>
                  <span className="text-muted">, {NOME_DO_TIPO[o.tipo].toLowerCase()}</span>
                </span>
                <span className="numeros shrink-0 text-xs text-muted">{prazoEmPalavra(o.emDias)}</span>
              </li>
            ))}
            {daSemana.length > 3 ? <li className="text-xs text-muted">e mais {daSemana.length - 3}</li> : null}
          </ul>
        ) : null}
      </LinkRapido>
    </section>
  );
}
