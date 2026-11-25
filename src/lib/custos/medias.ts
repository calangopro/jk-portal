/**
 * Os custos da empresa como MÉDIAS POR VENDA, e o CPA ideal que sai delas
 * (cartão 81). Conta pura, sem rede e sem `server-only`: roda no teste
 * (`scripts/teste-pedidos-tray.mts`) e nas telas.
 *
 * POR QUE MÉDIA. A lista de Custos guarda o que a empresa gasta por mês
 * (frete, imposto, caixinha, folha...) e por pedido (a caixa, o papel). Isso
 * não diz quanto custou ESTE pedido, e fingir que diz seria inventar. O que dá
 * para fazer com honestidade é dividir pelo que o período vendeu:
 *
 *   mensal por venda = valor mensal x (dias do período / 30,4375) / vendas pagas
 *
 * e usar o exato onde ele existe (taxa lida na Appmax, frete que o cliente
 * pagou, custo da peça pela Margem). A média só entra onde não há o exato, e a
 * tela sempre diz que é média.
 *
 * O FRETE tem uma conta própria, porque o cliente também paga frete e isso
 * entra no valor do pedido: o que a JK desembolsa com transportadora (o mensal)
 * menos o que os clientes pagaram é o que sobra para os pedidos de frete grátis.
 *
 * O CPA IDEAL sai da margem de contribuição: ticket médio menos os custos que
 * variam com cada venda (peças, taxa, imposto, frete, embalagem). O custo FIXO
 * (folha, aluguel, plataformas) não entra no CPA de contribuição, porque não
 * muda com a venda; ele só entra no CPA que dá lucro de verdade.
 */

export type DespesaParaMedia = {
  nome?: string;
  categoria: string;
  tipo: "mensal" | "por_pedido";
  valor: number;
  ativo: boolean;
  confirmado?: boolean;
};

export type EntradaDasMedias = {
  despesas: DespesaParaMedia[];
  /** Dias do período. */
  dias: number;
  /** Pedidos pagos no período. */
  vendas: number;
  /** O que os pedidos pagos somam, frete incluso. */
  faturamento: number;
  /** O frete que os clientes pagaram, e em quantos pedidos. */
  freteCobradoTotal: number;
  vendasComFreteCobrado: number;
  /** O que a Appmax descontou nos pedidos já lidos e o que esses pedidos somam. */
  taxaMedida: { total: number; descontado: number; pedidos: number } | null;
  /** O gasto de anúncio lançado no período. */
  anuncioReal: number | null;
  /** O custo das peças nas vendas em que TODAS as peças têm custo. */
  custoDasPecas: { vendas: number; receita: number; custo: number } | null;
  /**
   * A caixinha das alianças já está no custo de cada produto (regras da Margem,
   * cartão 82): a despesa de embalagem com "caixinha" no nome sai da média,
   * senão a mesma caixinha contaria duas vezes.
   */
  caixinhaNoProduto?: boolean;
};

/** A despesa que é a caixinha das alianças: sai da média quando a caixinha já está no custo do produto. */
export const ehCaixinhaDasAliancas = (d: { nome?: string; categoria: string }) => d.categoria === "embalagem" && /caixinha/i.test(d.nome ?? "");

export type Medias = {
  dias: number;
  vendas: number;
  faturamento: number;
  ticket: number | null;
  /** R$ por venda: o por pedido da lista mais a parte mensal rateada. Nulo sem despesa de embalagem. */
  embalagem: { porVenda: number; porPedido: number; mensalRateada: number } | null;
  frete: {
    /** O que a JK gasta com frete, no período. */
    custoNoPeriodo: number;
    /** O que os clientes pagaram de frete, no período. */
    cobradoNoPeriodo: number;
    /** O custo médio de frete por venda (todas as vendas). */
    porVenda: number;
    /** O frete que fica com a JK por venda: o custo menos o que os clientes pagam. É o que o preço do produto precisa cobrir. */
    liquidoPorVenda: number;
    /** O custo médio de frete por venda de frete grátis. Nulo se toda venda pagou frete. */
    porVendaGratis: number | null;
  } | null;
  /** O imposto do período sobre o faturamento, em fração. */
  imposto: { fracao: number; valorNoPeriodo: number } | null;
  /** A taxa do gateway medida, em fração do que se vendeu. */
  taxa: { fracao: number; pedidos: number } | null;
  anuncio: { porVenda: number; gasto: number } | null;
  pecas: { fracaoDaReceita: number; vendasComCusto: number; cobertura: number; confiavel: boolean } | null;
  /** O custo fixo (pessoas, estrutura, plataformas, serviços) do período e por venda. */
  fixo: { porVenda: number; noPeriodo: number } | null;
};

const DIAS_DO_MES = 30.4375;
/** Em quantas vendas e em que parte delas a média das peças vira estimativa para as vendas sem custo. */
export const MINIMO_DE_VENDAS_COM_CUSTO = 15;
export const MINIMO_DE_COBERTURA = 0.2;

/** As categorias que NÃO são custo fixo: cada uma tem a sua conta. */
const FORA_DO_FIXO = new Set(["anuncios", "embalagem", "frete", "impostos_e_taxas"]);

const centavos = (v: number) => Math.round(v * 100) / 100;

export function calcularMedias(e: EntradaDasMedias): Medias {
  const ativas = e.despesas.filter((d) => d.ativo && !(e.caixinhaNoProduto && ehCaixinhaDasAliancas(d)));
  const fator = e.dias > 0 ? e.dias / DIAS_DO_MES : 0;
  const soma = (f: (d: DespesaParaMedia) => boolean) => ativas.filter(f).reduce((s, d) => s + d.valor, 0);
  const tem = (f: (d: DespesaParaMedia) => boolean) => ativas.some(f);
  const vendas = e.vendas;
  const porVenda = (total: number) => (vendas > 0 ? total / vendas : 0);

  const ehEmbalagem = (d: DespesaParaMedia) => d.categoria === "embalagem";
  const embalagem = tem(ehEmbalagem) && vendas > 0
    ? (() => {
        const porPedido = soma((d) => ehEmbalagem(d) && d.tipo === "por_pedido");
        const mensalRateada = porVenda(soma((d) => ehEmbalagem(d) && d.tipo === "mensal") * fator);
        return { porVenda: centavos(porPedido + mensalRateada), porPedido: centavos(porPedido), mensalRateada: centavos(mensalRateada) };
      })()
    : null;

  const ehFrete = (d: DespesaParaMedia) => d.categoria === "frete";
  const frete = tem(ehFrete) && vendas > 0
    ? (() => {
        const custoNoPeriodo = soma((d) => ehFrete(d) && d.tipo === "mensal") * fator + soma((d) => ehFrete(d) && d.tipo === "por_pedido") * vendas;
        const cobradoNoPeriodo = e.freteCobradoTotal;
        const liquido = Math.max(custoNoPeriodo - cobradoNoPeriodo, 0);
        const gratis = vendas - e.vendasComFreteCobrado;
        return {
          custoNoPeriodo: centavos(custoNoPeriodo),
          cobradoNoPeriodo: centavos(cobradoNoPeriodo),
          porVenda: centavos(custoNoPeriodo / vendas),
          liquidoPorVenda: centavos(liquido / vendas),
          porVendaGratis: gratis > 0 ? centavos(liquido / gratis) : null,
        };
      })()
    : null;

  const ehImposto = (d: DespesaParaMedia) => d.categoria === "impostos_e_taxas" && d.tipo === "mensal" && /imposto/i.test(d.nome ?? "");
  const impostoNoPeriodo = soma(ehImposto) * fator;
  const imposto = tem(ehImposto) && e.faturamento > 0 ? { fracao: impostoNoPeriodo / e.faturamento, valorNoPeriodo: centavos(impostoNoPeriodo) } : null;

  const taxa = e.taxaMedida && e.taxaMedida.total > 0 && e.taxaMedida.pedidos > 0 ? { fracao: e.taxaMedida.descontado / e.taxaMedida.total, pedidos: e.taxaMedida.pedidos } : null;

  const anuncio = e.anuncioReal !== null && e.anuncioReal > 0 && vendas > 0 ? { porVenda: centavos(e.anuncioReal / vendas), gasto: centavos(e.anuncioReal) } : null;

  const p = e.custoDasPecas;
  const pecas = p && p.receita > 0 && p.vendas > 0 && vendas > 0
    ? {
        fracaoDaReceita: p.custo / p.receita,
        vendasComCusto: p.vendas,
        cobertura: p.vendas / vendas,
        confiavel: p.vendas >= MINIMO_DE_VENDAS_COM_CUSTO && p.vendas / vendas >= MINIMO_DE_COBERTURA,
      }
    : null;

  const ehFixo = (d: DespesaParaMedia) => !FORA_DO_FIXO.has(d.categoria) && d.tipo === "mensal";
  const fixoNoPeriodo = soma(ehFixo) * fator;
  const fixo = tem(ehFixo) && vendas > 0 ? { porVenda: centavos(fixoNoPeriodo / vendas), noPeriodo: centavos(fixoNoPeriodo) } : null;

  return {
    dias: e.dias,
    vendas,
    faturamento: centavos(e.faturamento),
    ticket: vendas > 0 ? centavos(e.faturamento / vendas) : null,
    embalagem,
    frete,
    imposto,
    taxa,
    anuncio,
    pecas,
    fixo,
  };
}

// ------------------------------------------------------------------ o CPA ideal

export type EntradaDoCpa = {
  ticket: number;
  /** Custos médios por venda, em reais. Nulo = não há número (e o CPA sai parcial). */
  pecas: number | null;
  taxa: number | null;
  imposto: number | null;
  frete: number | null;
  embalagem: number | null;
  fixo: number | null;
  /** Fração, como na Margem (0,3 = 30%). Nula = sem margem mínima. */
  margemMinima: number | null;
  /** O gasto de anúncio por venda no período. Nulo sem gasto lançado. */
  cpaReal: number | null;
};

export type SituacaoDoCpa = "dentro" | "acima_do_ideal" | "acima_do_empate" | "sem_gasto";

export type CpaIdeal = {
  ticket: number;
  /** O que sobra de cada venda antes do anúncio e do custo fixo. */
  contribuicao: number;
  /** Quanto cada linha tira, para a tela explicar a conta. */
  variaveis: { chave: "pecas" | "taxa" | "imposto" | "frete" | "embalagem"; valor: number | null }[];
  /** Falta algum custo variável: a contribuição, e portanto o CPA, estão otimistas. */
  parcial: boolean;
  faltam: string[];
  /** O máximo por venda para a contribuição ficar em zero (gastou isso, empatou a contribuição). */
  cpaDeEmpate: number;
  /** O máximo por venda mantendo a margem mínima do ticket. Nulo sem margem mínima. */
  cpaComMargem: number | null;
  /** O máximo por venda para o lucro, depois do custo fixo, ficar em zero. Nulo sem custo fixo. */
  cpaDeLucro: number | null;
  cpaReal: number | null;
  roasDeEmpate: number | null;
  roasDeLucro: number | null;
  roasReal: number | null;
  situacao: SituacaoDoCpa;
};

const ROTULO_DA_VARIAVEL = { pecas: "custo das peças", taxa: "taxa do gateway", imposto: "imposto", frete: "frete", embalagem: "embalagem" } as const;

export function calcularCpaIdeal(e: EntradaDoCpa): CpaIdeal {
  const variaveis = [
    { chave: "pecas" as const, valor: e.pecas },
    { chave: "taxa" as const, valor: e.taxa },
    { chave: "imposto" as const, valor: e.imposto },
    { chave: "frete" as const, valor: e.frete },
    { chave: "embalagem" as const, valor: e.embalagem },
  ];
  const soma = variaveis.reduce((s, v) => s + (v.valor ?? 0), 0);
  const contribuicao = centavos(e.ticket - soma);
  const faltam = variaveis.filter((v) => v.valor === null).map((v) => ROTULO_DA_VARIAVEL[v.chave]);

  const cpaDeEmpate = contribuicao;
  const cpaComMargem = e.margemMinima !== null ? centavos(contribuicao - e.margemMinima * e.ticket) : null;
  const cpaDeLucro = e.fixo !== null ? centavos(contribuicao - e.fixo) : null;
  const roas = (cpa: number | null) => (cpa !== null && cpa > 0 ? e.ticket / cpa : null);

  // A régua da situação é o CPA de empate da contribuição; o "ideal" é o de lucro, quando há custo fixo, senão o com margem, senão o de empate.
  const ideal = cpaDeLucro ?? cpaComMargem ?? cpaDeEmpate;
  const situacao: SituacaoDoCpa =
    e.cpaReal === null ? "sem_gasto" : e.cpaReal > cpaDeEmpate ? "acima_do_empate" : e.cpaReal > ideal ? "acima_do_ideal" : "dentro";

  return {
    ticket: centavos(e.ticket),
    contribuicao,
    variaveis: variaveis.map((v) => ({ chave: v.chave, valor: v.valor === null ? null : centavos(v.valor) })),
    parcial: faltam.length > 0,
    faltam,
    cpaDeEmpate,
    cpaComMargem,
    cpaDeLucro,
    cpaReal: e.cpaReal,
    roasDeEmpate: roas(cpaDeEmpate),
    roasDeLucro: roas(cpaDeLucro),
    roasReal: e.cpaReal !== null && e.cpaReal > 0 ? e.ticket / e.cpaReal : null,
    situacao,
  };
}
