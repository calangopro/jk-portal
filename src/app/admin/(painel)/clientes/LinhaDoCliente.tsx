import { ChevronRight, UsersRound } from "lucide-react";
import type { ResumoDoCliente } from "@/lib/clientes/dados";
import { NOME_DA_FASE } from "@/lib/clientes/oportunidades";
import { legivel } from "@/lib/leads/telefone";
import { LinkRapido } from "@/components/ui/LinkRapido";

/**
 * Um cliente na lista: o cartão inteiro abre a ficha.
 *
 * Sem `use client`: serve à lista que o servidor entrega e ao resultado da
 * busca, que é desenhado no navegador.
 */

const dia = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

/** "2 compras, a última em 12/10/2026", "sem compra paga, 1 pedido não pago". */
export function comprasEmPalavra(c: Pick<ResumoDoCliente, "pedidosPagos" | "pedidosNaoPagos" | "vendasPorFora" | "ultimaCompra">): string {
  const compras = c.pedidosPagos + c.vendasPorFora;
  const naoPagos = c.pedidosNaoPagos > 0 ? `${c.pedidosNaoPagos} ${c.pedidosNaoPagos === 1 ? "pedido não pago" : "pedidos não pagos"}` : "";
  if (compras === 0) return ["sem compra paga", naoPagos].filter(Boolean).join(", ");
  const base = compras === 1 ? `1 compra${c.ultimaCompra ? `, em ${dia(c.ultimaCompra)}` : ""}` : `${compras} compras${c.ultimaCompra ? `, a última em ${dia(c.ultimaCompra)}` : ""}`;
  return base;
}

export function LinhaDoCliente({ c }: { c: ResumoDoCliente }) {
  const lugar = [c.cidade, c.uf].filter(Boolean).join(", ");
  return (
    <li>
      <LinkRapido
        href={`/admin/clientes/${c.ref}`}
        className="painel-toque glass flex items-center gap-3 rounded-[16px] p-4 transition-colors hover:border-[var(--setor)]"
      >
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="min-w-0 break-words text-sm font-semibold text-ink">{c.nome ?? "Cliente sem nome"}</span>
            {c.fase && c.fase !== "nao_sei" ? (
              <span className="painel-selo rounded-full px-2 py-0.5 text-[0.68rem] font-bold">{NOME_DA_FASE[c.fase]}</span>
            ) : null}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            {[lugar, comprasEmPalavra(c)].filter(Boolean).join(" · ")}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
            {c.telefone ? <span className="numeros text-ink">{legivel(c.telefone)}</span> : <span>{c.email ?? "Sem telefone"}</span>}
            {c.noGrupo ? (
              <span className="inline-flex items-center gap-1">
                <UsersRound size={12} aria-hidden="true" /> no grupo de ofertas
              </span>
            ) : null}
            {c.responsavel ? <span>com {c.responsavel}</span> : null}
          </p>
        </div>
        <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden="true" />
      </LinkRapido>
    </li>
  );
}
