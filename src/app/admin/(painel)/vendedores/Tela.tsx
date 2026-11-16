import Link from "next/link";
import { HandCoins, RotateCcw, Store, Trophy, TriangleAlert } from "lucide-react";
import { NOME_DA_FORMA, type ResumoPorFora } from "@/lib/vendas/por-fora";
import { diaCurto, type ChaveDePeriodo } from "@/lib/vendas/periodo";
import type { LinhaDoRanking, Ranking } from "@/lib/vendas/ranking";
import { SeletorDePeriodo } from "../SeletorDePeriodo";
import { Cartao, Dinheiro, reais } from "../vendas/PainelDeVendas";

/**
 * A parte da tela de vendedores que só desenha.
 *
 * O ranking soma duas origens (0104): a venda registrada por fora da loja e o
 * pedido pago na loja que a pessoa marcou como dela no histórico do pedido.
 * As duas aparecem separadas em cada linha, para ninguém ler "na loja" como
 * dinheiro que entrou por fora. Sem o ranking (erro de leitura), a tela cai
 * na conta antiga, só por fora, e diz isso.
 */

/** Sem o ranking, a lista sai da conta por fora, com a parte da loja zerada. */
function soPorFora(atual: ResumoPorFora | null): LinhaDoRanking[] {
  return (atual?.por_vendedor ?? []).map((v) => ({
    vendedor_id: v.vendedor_id,
    vendedor: v.vendedor,
    fora_vendas: v.vendas,
    fora_valor: Number(v.valor),
    recuperadas: v.recuperadas,
    valor_recuperado: Number(v.valor_recuperado),
    loja_pedidos: 0,
    loja_valor: 0,
    vendas: v.vendas,
    valor: Number(v.valor),
  }));
}

const vendasEmPalavra = (n: number, um: string, muitos: string) => `${n} ${n === 1 ? um : muitos}`;

export function TelaDeVendedores({
  atual, anterior, ranking, chave, de, ate, comparacao,
}: {
  atual: ResumoPorFora | null;
  anterior: ResumoPorFora | null;
  ranking: Ranking | null;
  chave: ChaveDePeriodo;
  de: string;
  ate: string;
  comparacao: string;
}) {
  const lista = ranking?.por_vendedor ?? soPorFora(atual);
  const maior = Math.max(...lista.map((v) => v.valor), 1);
  const recuperado = lista.reduce((s, v) => s + v.valor_recuperado, 0);
  const d = atual && anterior && anterior.valor > 0 ? Math.round(((atual.valor - anterior.valor) / anterior.valor) * 100) : null;
  const aConferir = (atual?.ultimas ?? []).filter((v) => v.conferir);
  const semVendedor = ranking?.sem_vendedor ?? null;

  const partes = (v: LinhaDoRanking) => (
    <>
      <span className="block">
        Por fora: <span className="numeros text-ink">{v.fora_vendas ? `${reais(v.fora_valor)} (${v.fora_vendas})` : "·"}</span>
      </span>
      <span className="block">
        Na loja: <span className="numeros text-ink">{v.loja_pedidos ? `${reais(v.loja_valor)} (${v.loja_pedidos})` : "·"}</span>
      </span>
    </>
  );

  return (
    <div data-painel-largo>
      <header>
        <p className="eyebrow">Vendas</p>
        <h1 className="font-display mt-2 text-4xl text-ink">Vendedores</h1>
        <p className="mt-3 max-w-3xl text-muted">
          Quanto cada pessoa vendeu: o que ela registrou em{" "}
          <Link href="/admin/registrar-venda" className="font-semibold text-brand-nav hover:underline">Registrar venda</Link> (por fora da
          loja) e o pedido pago na loja que ela marcou como dela, no histórico do pedido. A Tray não guarda vendedor, então pedido pago sem
          marcação não entra.
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
          <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <Cartao Icone={Trophy} rotulo="Quem mais vendeu" apoio={lista[0] ? `${reais(lista[0].valor)} em ${vendasEmPalavra(lista[0].vendas, "venda", "vendas")}` : "nenhuma venda no período"}>
              <span>{lista[0]?.vendedor ?? "Ninguém"}</span>
            </Cartao>
            <Cartao
              Icone={HandCoins}
              rotulo="Vendido por fora"
              variacao={d === null ? undefined : { d: d / 100 }}
              apoio={d === null ? vendasEmPalavra(atual.vendas, "venda", "vendas") : comparacao}
            >
              <Dinheiro valor={atual.valor} />
            </Cartao>
            <Cartao
              Icone={Store}
              rotulo="Pedidos da loja marcados"
              apoio={
                ranking
                  ? `${vendasEmPalavra(ranking.loja.pedidos, "pedido", "pedidos")}; ${vendasEmPalavra(ranking.sem_vendedor.pedidos, "pedido pago", "pedidos pagos")} sem vendedor`
                  : "não deu para ler agora"
              }
            >
              <Dinheiro valor={ranking?.loja.valor ?? 0} />
            </Cartao>
            <Cartao Icone={RotateCcw} rotulo="Veio de pedido recuperado" apoio="cliente que não tinha pago na loja">
              <Dinheiro valor={recuperado} />
            </Cartao>
          </div>

          {ranking === null ? (
            <p className="mt-4 text-sm text-muted">Não deu para ler os pedidos da loja marcados agora: a lista abaixo mostra só as vendas por fora.</p>
          ) : semVendedor && semVendedor.pedidos > 0 ? (
            <p className="mt-4 max-w-3xl text-sm text-muted">
              {vendasEmPalavra(semVendedor.pedidos, "pedido pago", "pedidos pagos")} na loja no período ({reais(semVendedor.valor)}) ainda sem vendedor marcado. Quem
              vendeu marca no histórico do pedido, em &quot;Fui eu que vendi&quot;.
            </p>
          ) : null}

          <section className="glass mt-6 rounded-[18px] p-5" aria-label="Por vendedor">
            <p className="eyebrow">Por vendedor</p>
            {lista.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Nenhuma venda no período.</p>
            ) : (
              <>
                {/* Celular: um cartão por pessoa. A tabela não cabe em 375 px. */}
                <ol className="mt-3 grid grid-cols-1 gap-3 sm:hidden">
                  {lista.map((v, posicao) => (
                    <li key={v.vendedor_id} className="min-w-0 rounded-[14px] border border-border/70 bg-white p-3">
                      <p className="flex items-center gap-2.5 text-sm font-semibold text-ink">
                        <span className={`painel-selo numeros grid h-6 w-6 shrink-0 place-items-center rounded-full text-[0.7rem] font-bold ${posicao === 0 ? "painel-selo-ativo" : ""}`}>
                          {posicao + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{v.vendedor}</span>
                        <span className="numeros shrink-0">{reais(v.valor)}</span>
                      </p>
                      <span className="mt-2 block h-2 rounded-full bg-border/60">
                        <span className="painel-ponto block h-2 rounded-full" style={{ width: `${Math.max((v.valor / maior) * 100, 1)}%` }} />
                      </span>
                      <p className="mt-2 text-xs text-muted">{partes(v)}</p>
                      {v.recuperadas ? <p className="mt-1 text-xs text-muted">Recuperado: <span className="numeros text-ink">{reais(v.valor_recuperado)} ({v.recuperadas})</span></p> : null}
                    </li>
                  ))}
                </ol>

                <div className="mt-3 hidden overflow-x-auto sm:block">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-border text-left text-[0.68rem] uppercase tracking-wider text-muted">
                        <th scope="col" className="py-2 pr-4 font-semibold">Vendedor</th>
                        <th scope="col" className="w-1/3 py-2 pr-4 font-semibold">Vendido</th>
                        <th scope="col" className="py-2 pr-4 font-semibold">De onde</th>
                        <th scope="col" className="py-2 pr-4 text-right font-semibold">Ticket</th>
                        <th scope="col" className="py-2 text-right font-semibold">Recuperado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lista.map((v, posicao) => (
                        <tr key={v.vendedor_id} className="border-b border-border/50 last:border-0">
                          <td className="py-3 pr-4 text-sm font-semibold text-ink">
                            <span className="flex items-center gap-2.5">
                              {/* A posição no período. O primeiro lugar leva a cor cheia do setor. */}
                              <span className={`painel-selo numeros grid h-6 w-6 shrink-0 place-items-center rounded-full text-[0.7rem] font-bold ${posicao === 0 ? "painel-selo-ativo" : ""}`}>
                                {posicao + 1}
                              </span>
                              {v.vendedor}
                            </span>
                          </td>
                          <td className="py-3 pr-4">
                            <span className="numeros block text-sm text-ink">{reais(v.valor)}</span>
                            <span className="mt-1 block h-2 rounded-full bg-border/60">
                              <span className="painel-ponto block h-2 rounded-full" style={{ width: `${Math.max((v.valor / maior) * 100, 1)}%` }} />
                            </span>
                          </td>
                          <td className="py-3 pr-4 text-xs text-muted">{partes(v)}</td>
                          <td className="numeros py-3 pr-4 text-right text-sm text-muted">{v.vendas ? reais(v.valor / v.vendas) : "·"}</td>
                          <td className="numeros py-3 text-right text-sm text-muted">
                            {v.recuperadas ? `${reais(v.valor_recuperado)} (${v.recuperadas})` : "·"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
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
