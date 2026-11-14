import { HandCoins, Receipt, Sun } from "lucide-react";
import { CANAIS, FORMAS, NOME_DA_FORMA, NOME_DO_CANAL_DE_VENDA, type ResumoPorFora } from "@/lib/vendas/por-fora";
import { diaCurto, nomeDoMes, somarDias } from "@/lib/vendas/periodo";
import { Cartao, Dinheiro, reais } from "../vendas/PainelDeVendas";
import { BotaoDeAcao } from "../recuperacao/BotaoDeAcao";
import { FormularioDeVenda } from "./FormularioDeVenda";

/** A parte da tela de registrar venda que só desenha. Sem `estornar` (na prévia) o botão de estorno não aparece. */
export function TelaDeRegistrarVenda({
  mes, vendedores, veTodas, hoje, estornar,
}: {
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
        />
      </section>

      <section className="glass mt-6 rounded-[18px] p-5" aria-labelledby="vendas-do-mes">
        <h2 id="vendas-do-mes" className="font-display text-2xl text-ink">Vendas do mês</h2>
        {mes === null ? (
          <p className="mt-3 text-sm text-muted">Não deu para ler as vendas agora. Recarregue a página em alguns segundos.</p>
        ) : mes.ultimas.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nenhuma venda registrada neste mês.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse">
              <thead>
                <tr className="border-b border-border text-left text-[0.68rem] uppercase tracking-wider text-muted">
                  <th scope="col" className="py-2 pr-4 font-semibold">Dia</th>
                  <th scope="col" className="py-2 pr-4 font-semibold">Cliente e produto</th>
                  <th scope="col" className="py-2 pr-4 font-semibold">Pagamento</th>
                  {veTodas ? <th scope="col" className="py-2 pr-4 font-semibold">Vendedor</th> : null}
                  <th scope="col" className="py-2 pr-4 text-right font-semibold">Valor</th>
                  <th scope="col" className="py-2 text-right font-semibold"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {mes.ultimas.map((v) => (
                  <tr key={v.id} className="border-b border-border/50 align-top last:border-0">
                    <td className="numeros py-2.5 pr-4 text-sm text-ink">{diaCurto(v.dia)}</td>
                    <td className="max-w-[22rem] py-2.5 pr-4">
                      <span className="block truncate text-sm text-ink">{v.cliente ?? "Sem nome"}</span>
                      <span className="block truncate text-xs text-muted">{v.produto ?? "Sem descrição"}</span>
                      {v.conferir ? <span className="mt-0.5 block text-xs font-semibold" style={{ color: "#b45309" }}>Conferir: {v.conferir}</span> : null}
                    </td>
                    <td className="py-2.5 pr-4 text-xs text-muted">
                      {NOME_DA_FORMA[v.forma] ?? v.forma}
                      <span className="block">{NOME_DO_CANAL_DE_VENDA[v.canal] ?? v.canal}</span>
                    </td>
                    {veTodas ? <td className="py-2.5 pr-4 text-sm text-ink">{v.vendedor}</td> : null}
                    <td className="numeros py-2.5 pr-4 text-right text-sm text-ink">{reais(Number(v.valor))}</td>
                    <td className="py-2.5 text-right">
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
