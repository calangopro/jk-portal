import Link from "next/link";
import { Hammer, HandCoins, Receipt, Sun } from "lucide-react";
import { NOME_DA_ETAPA, lerEtapa } from "@/lib/fabrica/etapas";
import { CANAIS, DIAS_PARA_TRAS, FORMAS, NOME_DA_FORMA, NOME_DO_CANAL_DE_VENDA, type ResumoPorFora, type VendaLancadaAgora, type VendaNaFabrica } from "@/lib/vendas/por-fora";
import { diaCurto, nomeDoMes, primeiroDoMes, somarDias } from "@/lib/vendas/periodo";
import { Cartao, Dinheiro, reais } from "../vendas/PainelDeVendas";
import { BotaoDeAcao } from "../recuperacao/BotaoDeAcao";
import { FormularioDeVenda } from "./FormularioDeVenda";
import type { ProdutoDoFormulario } from "./ProducaoDaVenda";
import { CompletarProducao, type VendaParaCompletar } from "./CompletarProducao";

/** A parte da tela de registrar venda que só desenha. Sem `estornar` (na prévia) o botão de estorno não aparece. */
export function TelaDeRegistrarVenda({
  mes, lancadas = null, vendedores, veTodas, hoje, estornar, naFabrica = {}, produtos, lojas, completar = null, completarSumiu = false,
}: {
  /** Veio completar uma produção que não está mais esperando (já na fábrica, estornada, ou de outra pessoa). */
  completarSumiu?: boolean;
  /** A venda da Kommo cuja produção a pessoa veio completar (`?producao=`, cartão 51). */
  completar?: VendaParaCompletar | null;
  /** O que a pessoa lançou hoje e ontem, seja qual for o dia da venda. É de onde sai quem ela ainda pode estornar. */
  lancadas?: VendaLancadaAgora[] | null;
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
  // O vendedor estorna o que LANÇOU hoje ou ontem (a regra é do banco, 0115). Venda antiga lançada agora fica de
  // fora da lista do mês, e por isso ganha a própria lista embaixo.
  const lancadasAgora = new Set((lancadas ?? []).map((v) => v.id));
  const inicioDoMes = primeiroDoMes(hoje);
  const antigas = (lancadas ?? []).filter((v) => v.dia < inicioDoMes);
  const comAno = (dia: string) => dia.split("-").reverse().join("/");

  return (
    <div data-painel-largo>
      <header>
        <p className="eyebrow">Vendas</p>
        <h1 className="font-display mt-2 text-4xl text-ink">Registrar venda</h1>
        <p className="mt-3 max-w-3xl text-muted">
          Toda venda fechada fora do site entra aqui: Pix direto, link de pagamento, venda pelo WhatsApp. Pedido pago
          pelo site não precisa, porque já vem da Tray. Venda antiga entra com o dia em que aconteceu, até um ano para trás.
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

      {completar ? <CompletarProducao venda={completar} produtos={produtos ?? []} lojas={lojas ?? []} /> : null}
      {completarSumiu ? (
        <p role="status" className="glass mt-6 rounded-[14px] p-4 text-sm text-ink">
          Essa venda não está mais esperando a produção: ela já foi para a fábrica, foi estornada ou não é sua.
        </p>
      ) : null}

      <section className="glass mt-6 rounded-[18px] p-5" aria-labelledby="nova-venda">
        <h2 id="nova-venda" className="font-display text-2xl text-ink">Nova venda</h2>
        <FormularioDeVenda
          formas={FORMAS.map((f) => ({ ...f }))}
          canais={CANAIS.filter((c) => c.chave !== "recuperacao").map((c) => ({ ...c }))}
          vendedores={vendedores}
          hoje={hoje}
          maisAntigo={somarDias(hoje, -DIAS_PARA_TRAS)}
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
                      {estornar && (veTodas || lancadasAgora.has(v.id)) ? (
                        <form action={estornar} className="mt-1.5 sm:hidden">
                          <input type="hidden" name="id" value={v.id} />
                          <BotaoDeAcao>Estornar</BotaoDeAcao>
                        </form>
                      ) : null}
                    </td>
                    <td className="hidden py-2.5 text-right sm:table-cell">
                      {estornar && (veTodas || lancadasAgora.has(v.id)) ? (
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
          Venda lançada errada se estorna, não se apaga. O vendedor estorna a própria venda lançada hoje ou ontem.
        </p>
      </section>

      {antigas.length > 0 ? (
        <section className="glass mt-6 rounded-[18px] p-5" aria-labelledby="vendas-antigas">
          <h2 id="vendas-antigas" className="font-display text-2xl text-ink">Vendas antigas lançadas hoje e ontem</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted">
            São de outros meses, então não aparecem na lista de cima. Cada uma entra no mês em que aconteceu.
          </p>
          <ul className="mt-3 grid grid-cols-1 divide-y divide-border/50">
            {antigas.map((v) => (
              <li key={v.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5 py-2.5">
                <div className="min-w-0 flex-1 basis-56">
                  <p className="text-sm text-ink [overflow-wrap:anywhere]">
                    <span className="numeros font-semibold">{comAno(v.dia)}</span> {v.cliente ?? "Sem nome"}
                  </p>
                  <p className="text-xs text-muted [overflow-wrap:anywhere]">
                    {v.produto ?? "Sem descrição"}, {NOME_DA_FORMA[v.forma] ?? v.forma}
                  </p>
                  {v.conferir ? <p className="mt-0.5 text-xs font-semibold" style={{ color: "#b45309" }}>Conferir: {v.conferir}</p> : null}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="numeros text-sm text-ink">{reais(v.valor)}</span>
                  {estornar ? (
                    <form action={estornar}>
                      <input type="hidden" name="id" value={v.id} />
                      <BotaoDeAcao>Estornar</BotaoDeAcao>
                    </form>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
