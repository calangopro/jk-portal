import Link from "next/link";
import { HandCoins, RotateCcw, Trophy, TriangleAlert } from "lucide-react";
import { NOME_DA_FORMA, type ResumoPorFora } from "@/lib/vendas/por-fora";
import { diaCurto, type ChaveDePeriodo } from "@/lib/vendas/periodo";
import { SeletorDePeriodo } from "../SeletorDePeriodo";
import { Cartao, Dinheiro, reais } from "../vendas/PainelDeVendas";

const COR = "#b8841f";

/** A parte da tela de vendedores que só desenha. */
export function TelaDeVendedores({
  atual, anterior, chave, de, ate, comparacao,
}: {
  atual: ResumoPorFora | null;
  anterior: ResumoPorFora | null;
  chave: ChaveDePeriodo;
  de: string;
  ate: string;
  comparacao: string;
}) {
  const lista = atual?.por_vendedor ?? [];
  const maior = Math.max(...lista.map((v) => Number(v.valor)), 1);
  const recuperado = lista.reduce((s, v) => s + Number(v.valor_recuperado), 0);
  const d = atual && anterior && anterior.valor > 0 ? Math.round(((atual.valor - anterior.valor) / anterior.valor) * 100) : null;
  const aConferir = (atual?.ultimas ?? []).filter((v) => v.conferir);

  return (
    <div data-painel-largo>
      <header>
        <p className="eyebrow">Vendas</p>
        <h1 className="font-display mt-2 text-4xl text-ink">Vendedores</h1>
        <p className="mt-3 max-w-3xl text-muted">
          Quanto cada pessoa vendeu por fora da loja, pelo que foi registrado em{" "}
          <Link href="/admin/registrar-venda" className="font-semibold text-brand-nav hover:underline">Registrar venda</Link>. Pedido
          pago pelo site não tem vendedor na Tray e não entra nesta conta.
        </p>
      </header>

      <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
        <h2 className="font-display text-2xl text-ink">De {diaCurto(de)} a {diaCurto(ate)}</h2>
        <SeletorDePeriodo atual={chave} />
      </div>

      {atual === null ? (
        <p className="glass mt-6 rounded-[18px] p-6 text-sm text-muted">Não deu para ler as vendas agora. Recarregue a página em alguns segundos.</p>
      ) : (
        <>
          <div className="mt-5 grid gap-5 sm:grid-cols-3">
            <Cartao Icone={HandCoins} rotulo="Vendido por fora" apoio={d === null ? `${atual.vendas} ${atual.vendas === 1 ? "venda" : "vendas"}` : `${d > 0 ? "+" : ""}${d}% ${comparacao}`}>
              <Dinheiro valor={atual.valor} />
            </Cartao>
            <Cartao Icone={Trophy} rotulo="Quem mais vendeu" apoio={lista[0] ? `${reais(Number(lista[0].valor))} em ${lista[0].vendas} ${lista[0].vendas === 1 ? "venda" : "vendas"}` : "nenhuma venda registrada"}>
              <span>{lista[0]?.vendedor ?? "Ninguém"}</span>
            </Cartao>
            <Cartao Icone={RotateCcw} rotulo="Veio de pedido recuperado" apoio="cliente que não tinha pago na loja">
              <Dinheiro valor={recuperado} />
            </Cartao>
          </div>

          <section className="glass mt-6 rounded-[18px] p-5" aria-label="Por vendedor">
            <p className="eyebrow">Por vendedor</p>
            {lista.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Nenhuma venda registrada no período.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[38rem] border-collapse">
                  <thead>
                    <tr className="border-b border-border text-left text-[0.68rem] uppercase tracking-wider text-muted">
                      <th scope="col" className="py-2 pr-4 font-semibold">Vendedor</th>
                      <th scope="col" className="w-2/5 py-2 pr-4 font-semibold">Vendido</th>
                      <th scope="col" className="py-2 pr-4 text-right font-semibold">Vendas</th>
                      <th scope="col" className="py-2 pr-4 text-right font-semibold">Ticket</th>
                      <th scope="col" className="py-2 text-right font-semibold">Recuperado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lista.map((v) => (
                      <tr key={v.vendedor_id} className="border-b border-border/50 last:border-0">
                        <td className="py-3 pr-4 text-sm font-semibold text-ink">{v.vendedor}</td>
                        <td className="py-3 pr-4">
                          <span className="numeros block text-sm text-ink">{reais(Number(v.valor))}</span>
                          <span className="mt-1 block h-2 rounded-full bg-border/60">
                            <span className="block h-2 rounded-full" style={{ width: `${Math.max((Number(v.valor) / maior) * 100, 1)}%`, background: COR }} />
                          </span>
                        </td>
                        <td className="numeros py-3 pr-4 text-right text-sm text-ink">{v.vendas}</td>
                        <td className="numeros py-3 pr-4 text-right text-sm text-muted">{reais(Number(v.valor) / v.vendas)}</td>
                        <td className="numeros py-3 text-right text-sm text-muted">
                          {v.recuperadas ? `${reais(Number(v.valor_recuperado))} (${v.recuperadas})` : "·"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {aConferir.length > 0 ? (
            <section className="glass mt-6 rounded-[18px] border-l-4 p-5" style={{ borderLeftColor: "#b45309" }} aria-label="Vendas para conferir">
              <p className="flex items-center gap-1.5 text-[0.68rem] font-bold uppercase tracking-wider" style={{ color: "#b45309" }}>
                <TriangleAlert size={14} aria-hidden /> Para conferir
              </p>
              <p className="mt-1 text-xs text-muted">Vendas lançadas mesmo parecendo repetidas. Confira se não foram contadas duas vezes.</p>
              <ul className="mt-3 divide-y divide-border/60">
                {aConferir.map((v) => (
                  <li key={v.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2 text-sm">
                    <span className="text-ink">
                      {diaCurto(v.dia)} · {v.vendedor} · {v.cliente ?? "Sem nome"} · {NOME_DA_FORMA[v.forma] ?? v.forma}
                      <span className="block text-xs text-muted">{v.conferir}</span>
                    </span>
                    <span className="numeros text-ink">{reais(Number(v.valor))}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
