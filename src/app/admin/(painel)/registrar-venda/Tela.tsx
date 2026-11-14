import Link from "next/link";
import { Hammer, HandCoins, Receipt, Sun } from "lucide-react";
import { NOME_DA_ETAPA, lerEtapa } from "@/lib/fabrica/etapas";
import { CANAIS, FORMAS, NOME_DA_FORMA, NOME_DO_CANAL_DE_VENDA, type ResumoPorFora, type VendaNaFabrica } from "@/lib/vendas/por-fora";
import { diaCurto, nomeDoMes, somarDias } from "@/lib/vendas/periodo";
import { Cartao, Dinheiro, reais } from "../vendas/PainelDeVendas";
import { BotaoDeAcao } from "../recuperacao/BotaoDeAcao";
import { FormularioDeVenda } from "./FormularioDeVenda";
import type { ProdutoDoFormulario } from "./ProducaoDaVenda";

/** A parte da tela de registrar venda que só desenha. Sem `estornar` (na prévia) o botão de estorno não aparece. */
export function TelaDeRegistrarVenda({
  mes, vendedores, veTodas, hoje, estornar, naFabrica = {}, produtos, lojas,
}: {
  /** A etapa da fábrica das vendas que foram para lá, pelo código da venda. */
  naFabrica?: Record<string, VendaNaFabrica>;
  /** O catálogo e as lojas, para a parte do formulário que vai para a fábrica. */
  produtos?: ProdutoDoFormulario[];
  lojas?: string[];
  mes: ResumoPorFora | null;
  /** Outras pessoas em nome de quem dá para lançar. Só chega para quem vê todas as vendas. */
  vendedores?: { id: string; nome: string }[];
  veTodas: boolean;
  hoje: string;
  estornar?: (f: FormData) => Promise<void>;
}) {
  const doDia = mes?.por_dia.find((d) => d.dia === hoje);
  const ontem = somarDias(hoje, -1);

  return (
    <div data-painel-largo>
      <header>
        <p className="eyebrow">Vendas</p>
        <h1 className="font-display mt-2 text-4xl text-ink">Registrar venda</h1>
        <p className="mt-3 max-w-3xl text-muted">
          Toda venda fechada fora do site entra aqui: Pix direto, link de pagamento, venda pelo WhatsApp. Pedido pago
          pelo site não precisa, porque já vem da Tray.
          {veTodas ? " Você vê as vendas de todos; cada vendedor vê só as dele." : " Aqui aparecem só as suas vendas."}
        </p>
      </header>

      <div className="mt-8 grid gap-5 sm:grid-cols-3">
        <Cartao Icone={Sun} rotulo={`Hoje, ${diaCurto(hoje)}`} apoio={`${doDia?.vendas ?? 0} ${(doDia?.vendas ?? 0) === 1 ? "venda" : "vendas"}`}>
          <Dinheiro valor={Number(doDia?.valor ?? 0)} />
        </Cartao>
        <Cartao Icone={HandCoins} rotulo={`${nomeDoMes(hoje)} até agora`} apoio={`${mes?.vendas ?? 0} ${(mes?.vendas ?? 0) === 1 ? "venda" : "vendas"} por fora da loja`}>
          <Dinheiro valor={mes?.valor ?? 0} />
        </Cartao>
        <Cartao Icone={Receipt} rotulo="Ticket médio" apoio="das vendas por fora no mês">
          <Dinheiro valor={mes && mes.vendas ? mes.valor / mes.vendas : 0} />
        </Cartao>
      </div>

      <section className="glass mt-6 rounded-[18px] p-5" aria-labelledby="nova-venda">
        <h2 id="nova-venda" className="font-display text-2xl text-ink">Nova venda</h2>
        <FormularioDeVenda
          formas={FORMAS.map((f) => ({ ...f }))}
          canais={CANAIS.filter((c) => c.chave !== "recuperacao").map((c) => ({ ...c }))}
          vendedores={vendedores}
          hoje={hoje}
          produtos={produtos}
          lojas={lojas}
        />
      </section>

      <section className="glass mt-6 rounded-[18px] p-5" aria-labelledby="vendas-do-mes">
        <h2 id="vendas-do-mes" className="font-display text-2xl text-ink">Vendas do mês</h2>
        {mes === null ? (
          <p className="mt-3 text-sm text-muted">Não deu para ler as vendas agora. Recarregue a página em alguns segundos.</p>
        ) : mes.ultimas.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nenhuma venda registrada neste mês.</p>
        ) : (
          // No celular a tabela cabe na tela: as colunas de pagamento e de vendedor somem, e as outras têm largura fixa.
          // Com a largura mínima de 40 rem valendo também no celular, a página inteira passava a ter 677 px.
          <div className="mt-3 overflow-x-auto">
            <table className="w-full table-fixed border-collapse sm:min-w-[40rem] sm:table-auto">
              <thead>
                <tr className="border-b border-border text-left text-[0.68rem] uppercase tracking-wider text-muted">
                  <th scope="col" className="w-[3.1rem] py-2 pr-2 font-semibold sm:w-auto sm:pr-4">Dia</th>
                  <th scope="col" className="py-2 pr-4 font-semibold">Cliente e produto</th>
                  <th scope="col" className="hidden py-2 pr-4 font-semibold sm:table-cell">Pagamento</th>
                  {veTodas ? <th scope="col" className="hidden py-2 pr-4 font-semibold sm:table-cell">Vendedor</th> : null}
                  <th scope="col" className="w-[5.6rem] py-2 text-right font-semibold sm:w-auto sm:pr-4">Valor</th>
                  <th scope="col" className="hidden py-2 text-right font-semibold sm:table-cell"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {mes.ultimas.map((v) => (
                  <tr key={v.id} className="border-b border-border/50 align-top last:border-0">
                    <td className="numeros py-2.5 pr-2 text-sm text-ink sm:pr-4">{diaCurto(v.dia)}</td>
                    <td className="max-w-[22rem] py-2.5 pr-2 sm:pr-4">
                      {/* A ficha abre pelo código da venda: o endereço não leva telefone. Venda sem telefone não tem ficha, e a tela de lá explica. */}
                      <Link href={`/admin/clientes/v${v.id}`} className="block truncate text-sm text-ink underline decoration-ink/20 underline-offset-4 hover:decoration-ink">
                        {v.cliente ?? "Sem nome"}
                      </Link>
                      <span className="block truncate text-xs text-muted">{v.produto ?? "Sem descrição"}</span>
                      <span className="block truncate text-xs text-muted sm:hidden">
                        {NOME_DA_FORMA[v.forma] ?? v.forma}
                        {veTodas ? `, ${v.vendedor}` : ""}
                      </span>
                      {v.conferir ? <span className="mt-0.5 block text-xs font-semibold" style={{ color: "#b45309" }}>Conferir: {v.conferir}</span> : null}
                      {naFabrica[v.id] ? (
                        <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-ink/[0.06] px-2 py-0.5 text-[0.68rem] font-semibold text-ink">
                          <Hammer size={11} aria-hidden="true" /> Fábrica: {NOME_DA_ETAPA[lerEtapa(naFabrica[v.id].etapa) ?? "a_produzir"].toLowerCase()}
                          {naFabrica[v.id].rastreio ? `, rastreio ${naFabrica[v.id].rastreio}` : ""}
                        </span>
                      ) : null}
                    </td>
                    <td className="hidden py-2.5 pr-4 text-xs text-muted sm:table-cell">
                      {NOME_DA_FORMA[v.forma] ?? v.forma}
                      <span className="block">{NOME_DO_CANAL_DE_VENDA[v.canal] ?? v.canal}</span>
                    </td>
                    {veTodas ? <td className="hidden py-2.5 pr-4 text-sm text-ink sm:table-cell">{v.vendedor}</td> : null}
                    <td className="numeros py-2.5 text-right text-sm text-ink sm:pr-4">
                      {reais(Number(v.valor))}
                      {/* No celular o estorno fica embaixo do valor: uma coluna só para o botão espremia o nome do cliente. */}
                      {estornar && (veTodas || v.dia >= ontem) ? (
                        <form action={estornar} className="mt-1.5 sm:hidden">
                          <input type="hidden" name="id" value={v.id} />
                          <BotaoDeAcao>Estornar</BotaoDeAcao>
                        </form>
                      ) : null}
                    </td>
                    <td className="hidden py-2.5 text-right sm:table-cell">
                      {estornar && (veTodas || v.dia >= ontem) ? (
                        <form action={estornar}>
                          <input type="hidden" name="id" value={v.id} />
                          <BotaoDeAcao>Estornar</BotaoDeAcao>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-muted">
          Venda lançada errada se estorna, não se apaga. O vendedor estorna a própria venda de hoje ou de ontem.
        </p>
      </section>
    </div>
  );
}
