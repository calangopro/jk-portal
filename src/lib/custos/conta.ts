/**
 * Quanto a empresa já gastou no mês, até hoje.
 *
 * São três parcelas: os custos mensais na proporção dos dias que já passaram,
 * o custo por pedido vezes os pedidos pagos, e o anúncio.
 *
 * O ANÚNCIO TEM DUAS FONTES, e somar as duas contaria o mesmo dinheiro duas
 * vezes. A lista de custos traz uma estimativa por mês. O tráfego traz o gasto
 * de verdade, por dia. Quando há gasto lançado no mês, ele entra no lugar da
 * estimativa: a linha de anúncio sai da parte mensal, entra o gasto real dos
 * dias lançados e, para os dias que ainda faltam (hoje costuma faltar), vale a
 * estimativa por dia. Sem nada lançado, a conta segue só com a estimativa.
 *
 * O custo das peças NÃO entra aqui: mora em Margem. Arquivo puro, para o teste
 * rodar sem banco.
 */

export type DespesaDaConta = { tipo: "mensal" | "por_pedido"; categoria: string; valor: number; ativo: boolean };

export type EntradaDaConta = {
  despesas: DespesaDaConta[];
  /** Dia de São Paulo, AAAA-MM-DD. */
  hoje: string;
  diasNoMes: number;
  pedidosPagos: number;
  /** Gasto lançado no tráfego do dia 1 até hoje, e em quantos dias. `null` quando não foi lido. */
  anuncioReal?: { gasto: number; dias: number } | null;
};

export type ContaDoMes = {
  /** Custos mensais, sem anúncio, na proporção dos dias passados. */
  fixoAteHoje: number;
  porPedidoAteHoje: number;
  /** O que entrou na conta como anúncio. */
  anuncioAteHoje: number;
  /** A estimativa da lista de custos para os mesmos dias, para comparar. */
  anuncioEstimado: number;
  /** Quanto do anúncio é gasto de verdade, lançado no tráfego. */
  anuncioReal: number;
  diasComGastoReal: number;
  /** Dias do mês, até hoje, cobertos só pela estimativa. */
  diasSoNaEstimativa: number;
  total: number;
};

const centavos = (n: number) => Math.round(n * 100) / 100;

export function contaDoMes(e: EntradaDaConta): ContaDoMes {
  const ativas = e.despesas.filter((d) => d.ativo);
  const dia = Number(e.hoje.slice(8, 10));
  const fracao = e.diasNoMes > 0 ? dia / e.diasNoMes : 0;

  const mensais = ativas.filter((d) => d.tipo === "mensal");
  const anuncioNoMes = mensais.filter((d) => d.categoria === "anuncios").reduce((s, d) => s + d.valor, 0);
  const restoNoMes = mensais.filter((d) => d.categoria !== "anuncios").reduce((s, d) => s + d.valor, 0);
  const porPedido = ativas.filter((d) => d.tipo === "por_pedido").reduce((s, d) => s + d.valor, 0);

  const fixoAteHoje = centavos(restoNoMes * fracao);
  const porPedidoAteHoje = centavos(porPedido * e.pedidosPagos);
  const anuncioEstimado = centavos(anuncioNoMes * fracao);

  const real = e.anuncioReal && e.anuncioReal.dias > 0 ? e.anuncioReal : null;
  const diasComGastoReal = real ? Math.min(real.dias, dia) : 0;
  const diasSoNaEstimativa = dia - diasComGastoReal;
  const porDiaEstimado = e.diasNoMes > 0 ? anuncioNoMes / e.diasNoMes : 0;
  const anuncioAteHoje = real ? centavos(real.gasto + porDiaEstimado * diasSoNaEstimativa) : anuncioEstimado;

  return {
    fixoAteHoje,
    porPedidoAteHoje,
    anuncioAteHoje,
    anuncioEstimado,
    anuncioReal: real ? centavos(real.gasto) : 0,
    diasComGastoReal,
    diasSoNaEstimativa,
    total: centavos(fixoAteHoje + porPedidoAteHoje + anuncioAteHoje),
  };
}
