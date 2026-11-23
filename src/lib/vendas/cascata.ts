/**
 * A cascata de UMA venda: do valor que o cliente pagou até o que sobrou para a
 * JK (cartão 80). Conta pura, sem rede e sem `server-only`: roda no teste
 * (`scripts/teste-pedidos-tray.mts`) e nas telas.
 *
 *   sobra = total do pedido
 *           - taxa do gateway     (REAL, lida da Appmax; sem ela, a média da Margem)
 *           - imposto             (estimativa: o percentual da Margem sobre o total)
 *           - custo das peças     (a conta da Margem, produto a produto)
 *           - frete               (o que o cliente pagou é repassado; frete grátis usa o médio da Margem)
 *           - embalagem           (da Margem)
 *           - anúncio             (rateio: gasto de 30 dias dividido pelos pedidos pagos)
 *
 * O QUE FALTA NUNCA VIRA ZERO ESCONDIDO. Cada linha diz de onde veio o número
 * (`real`, `estimado` ou `falta`), e a sobra só é "completa" quando nenhuma
 * linha falta. Antecipação, saque e estorno ficam de fora: a API da Appmax não
 * entrega esses por pedido, e a tela diz isso.
 */

/**
 * `real`: o exato desta venda (lido na Appmax, calculado pela Margem).
 * `media`: a média geral do período, calculada da lista de Custos e dos pedidos (cartão 81).
 * `estimado`: um valor informado à mão (parâmetro da Margem) ou uma suposição.
 * `falta`: não há como calcular.
 */
export type OrigemDoNumero = "real" | "media" | "estimado" | "falta";
export type TipoDaLinha = "taxa" | "imposto" | "custo" | "frete" | "embalagem" | "anuncio";

export type LinhaDaCascata = {
  tipo: TipoDaLinha;
  rotulo: string;
  /** Em reais, positivo (é o que SAI). Nulo quando não há como calcular. */
  valor: number | null;
  origem: OrigemDoNumero;
  /** De onde vem o número, em uma frase. */
  detalhe: string;
};

export type EntradaDaCascata = {
  /** O que o cliente pagou, frete incluso. */
  total: number;
  /** O frete que o cliente pagou (zero no frete grátis). */
  freteCobrado: number;
  /** O que a Appmax descontou, quando já foi lido. */
  taxaReal: { processamento: number; gateway: number; descontado: number } | null;
  /** Os parâmetros da Margem (frações e reais). */
  parametros: { taxa: number | null; tarifaFixa?: number | null; imposto: number | null; frete: number | null; embalagem: number | null };
  /** O custo de cada peça (da conta da Margem), com o motivo quando falta. `preco` é o unitário, para estimar a peça sem custo. */
  itens: { nome: string; quantidade: number; custo: number | null; falta: string | null; preco?: number | null }[];
  /** O anúncio por venda, rateado, e como se chegou nele. Nulo sem gasto lançado. */
  anuncioPorVenda: number | null;
  anuncioDetalhe?: string | null;
  /** As médias do período (cartão 81), para onde não há o exato nem parâmetro preenchido. */
  medias?: MediasParaCascata | null;
};

/** O que a cascata pega da média do período, em números simples. */
export type MediasParaCascata = {
  /** A taxa do gateway medida na Appmax, em fração do que se vendeu. */
  taxaFracao: number | null;
  /** O imposto do período sobre o faturamento, em fração. */
  impostoFracao: number | null;
  /** O custo médio de frete por venda de frete grátis. */
  freteGratis: number | null;
  /** A embalagem média por venda. */
  embalagem: number | null;
  /** O custo das peças como fração do preço, nas vendas que têm custo inteiro. Nulo sem cobertura mínima. */
  pecasFracao: number | null;
};

export type Cascata = {
  total: number;
  linhas: LinhaDaCascata[];
  /** A soma do que saiu (só as linhas com número). */
  descontos: number;
  sobra: number;
  /** A sobra sobre o total, em fração. */
  fracao: number | null;
  /** Nenhuma linha falta. Sem isso, a sobra é "antes do que falta". */
  completa: boolean;
  faltam: string[];
};

const n = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const centavos = (v: number) => Math.round(v * 100) / 100;
const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pctTexto = (f: number) => `${(f * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

export function montarCascata(e: EntradaDaCascata): Cascata {
  const p = e.parametros;
  const m = e.medias ?? null;
  const linhas: LinhaDaCascata[] = [];

  // Taxa do gateway: a lida na Appmax é a exata; sem ela, a média medida; sem ela, a da Margem.
  if (e.taxaReal) {
    linhas.push({
      tipo: "taxa",
      rotulo: "Taxa da Appmax",
      valor: centavos(e.taxaReal.descontado),
      origem: "real",
      detalhe: `Lida na Appmax: ${reais(e.taxaReal.processamento)} de processamento e ${reais(e.taxaReal.gateway)} de gateway e antifraude.`,
    });
  } else if (m?.taxaFracao !== null && m?.taxaFracao !== undefined) {
    linhas.push({
      tipo: "taxa",
      rotulo: "Taxa do gateway",
      valor: centavos(e.total * m.taxaFracao),
      origem: "media",
      detalhe: `Média lida na Appmax: ${pctTexto(m.taxaFracao)} do que se vendeu. A Appmax ainda não devolveu o valor deste pedido.`,
    });
  } else if (p.taxa !== null || n(p.tarifaFixa) > 0) {
    linhas.push({
      tipo: "taxa",
      rotulo: "Taxa do gateway",
      valor: centavos(e.total * n(p.taxa) + n(p.tarifaFixa)),
      origem: "estimado",
      detalhe: "Estimada com a taxa da Margem. A Appmax ainda não devolveu o valor deste pedido.",
    });
  } else {
    linhas.push({ tipo: "taxa", rotulo: "Taxa do gateway", valor: null, origem: "falta", detalhe: "Sem leitura da Appmax e sem taxa na Margem." });
  }

  // Imposto: o percentual da Margem, se houver; senão o da lista de Custos sobre o faturamento.
  if (p.imposto !== null) {
    linhas.push({ tipo: "imposto", rotulo: "Imposto", valor: centavos(e.total * p.imposto), origem: "estimado", detalhe: `${pctTexto(p.imposto)} sobre o total, o percentual da Margem.` });
  } else if (m?.impostoFracao !== null && m?.impostoFracao !== undefined) {
    linhas.push({ tipo: "imposto", rotulo: "Imposto", valor: centavos(e.total * m.impostoFracao), origem: "media", detalhe: `Média: ${pctTexto(m.impostoFracao)} do faturamento, o imposto do mês na lista de Custos.` });
  } else {
    linhas.push({ tipo: "imposto", rotulo: "Imposto", valor: null, origem: "falta", detalhe: "Falta o imposto nos parâmetros da Margem e na lista de Custos." });
  }

  // Custo das peças: o exato por item. Para a peça sem custo, a média das vendas que têm (só com cobertura mínima).
  const comCusto = e.itens.filter((i) => i.custo !== null);
  const semCusto = e.itens.filter((i) => i.custo === null);
  const somaDoCusto = centavos(comCusto.reduce((s, i) => s + (i.custo as number) * Math.max(i.quantidade, 1), 0));
  if (e.itens.length === 0) {
    linhas.push({ tipo: "custo", rotulo: "Custo das peças", valor: null, origem: "falta", detalhe: "O pedido não trouxe as peças." });
  } else if (semCusto.length === 0) {
    linhas.push({ tipo: "custo", rotulo: "Custo das peças", valor: somaDoCusto, origem: "real", detalhe: "Peso, preço do grama e resto de cada peça, pela conta da Margem." });
  } else if (m?.pecasFracao !== null && m?.pecasFracao !== undefined && semCusto.every((i) => typeof i.preco === "number" && i.preco > 0)) {
    const receitaSemCusto = semCusto.reduce((s, i) => s + (i.preco as number) * Math.max(i.quantidade, 1), 0);
    const estimado = centavos(receitaSemCusto * m.pecasFracao);
    linhas.push({
      tipo: "custo",
      rotulo: "Custo das peças",
      valor: centavos(somaDoCusto + estimado),
      origem: "media",
      detalhe: `${semCusto.length === 1 ? "1 peça" : `${semCusto.length} peças`} sem custo na Margem ${semCusto.length === 1 ? "entra" : "entram"} pela média das vendas que têm custo: ${pctTexto(m.pecasFracao)} do preço.${comCusto.length ? " As outras usam o custo da Margem." : ""}`,
    });
  } else {
    linhas.push({
      tipo: "custo",
      rotulo: "Custo das peças",
      valor: comCusto.length ? somaDoCusto : null,
      origem: "falta",
      detalhe: `${semCusto.length === 1 ? "Falta o custo de 1 peça" : `Falta o custo de ${semCusto.length} peças`} (${e.itens.length === 1 ? "o pedido tem 1" : `de ${e.itens.length} no pedido`})${semCusto[0]?.falta ? `: ${semCusto[0].falta.toLowerCase()}` : ""}.${comCusto.length ? " O valor soma só as que têm custo." : ""}`,
    });
  }

  // Frete: o que o cliente pagou é repassado à transportadora (suposição); no frete grátis, o valor da Margem ou a média da lista de Custos.
  if (e.freteCobrado > 0) {
    linhas.push({ tipo: "frete", rotulo: "Frete", valor: centavos(e.freteCobrado), origem: "estimado", detalhe: "O cliente pagou este frete. Supõe-se repassado à transportadora, sem sobra nem perda." });
  } else if (p.frete !== null) {
    linhas.push({ tipo: "frete", rotulo: "Frete", valor: centavos(p.frete), origem: "estimado", detalhe: "Frete grátis para o cliente: vale o frete médio que a JK paga, da Margem." });
  } else if (m?.freteGratis !== null && m?.freteGratis !== undefined) {
    linhas.push({ tipo: "frete", rotulo: "Frete", valor: centavos(m.freteGratis), origem: "media", detalhe: "Média do frete grátis: o custo de frete do mês na lista de Custos, menos o que os clientes pagaram, dividido pelos pedidos de frete grátis." });
  } else {
    linhas.push({ tipo: "frete", rotulo: "Frete", valor: null, origem: "falta", detalhe: "Frete grátis e sem frete médio na Margem nem na lista de Custos." });
  }

  if (p.embalagem !== null) {
    linhas.push({ tipo: "embalagem", rotulo: "Embalagem e brinde", valor: centavos(p.embalagem), origem: "estimado", detalhe: "O valor por pedido da Margem." });
  } else if (m?.embalagem !== null && m?.embalagem !== undefined) {
    linhas.push({ tipo: "embalagem", rotulo: "Embalagem e brinde", valor: centavos(m.embalagem), origem: "media", detalhe: "Média: o que a lista de Custos tem por pedido, mais a parte mensal dividida pelas vendas do período." });
  } else {
    linhas.push({ tipo: "embalagem", rotulo: "Embalagem e brinde", valor: null, origem: "falta", detalhe: "Falta a embalagem na Margem e na lista de Custos." });
  }

  linhas.push(
    e.anuncioPorVenda === null
      ? { tipo: "anuncio", rotulo: "Anúncio", valor: null, origem: "falta", detalhe: "Sem gasto de anúncio lançado no período." }
      : { tipo: "anuncio", rotulo: "Anúncio", valor: centavos(e.anuncioPorVenda), origem: "media", detalhe: e.anuncioDetalhe ?? "Rateio: o gasto de anúncio do período dividido pelos pedidos pagos." },
  );

  const total = centavos(e.total);
  const descontos = centavos(linhas.reduce((s, l) => s + n(l.valor), 0));
  const sobra = centavos(total - descontos);
  const faltam = linhas.filter((l) => l.origem === "falta").map((l) => l.rotulo);
  return { total, linhas, descontos, sobra, fracao: total > 0 ? sobra / total : null, completa: faltam.length === 0, faltam };
}

/**
 * A média por venda de várias cascatas. Cada linha é a soma sobre TODAS as vendas
 * dividida por todas (o que não tem número conta zero naquela venda), para as
 * linhas e a sobra fecharem com o ticket médio. Se NENHUMA venda tem número numa
 * linha, ela fica nula e a tela diz "falta".
 */
export function mediaDasCascatas(cascatas: Cascata[]): {
  vendas: number;
  total: number;
  sobra: number;
  fracao: number | null;
  porTipo: Record<TipoDaLinha, number | null>;
  /** Em quantas vendas cada linha tem número. */
  comNumero: Record<TipoDaLinha, number>;
  /** Em quantas vendas a linha é inteira (lida ou calculada, sem faltar peça nem parâmetro). */
  inteiras: Record<TipoDaLinha, number>;
  /** Em quantas vendas a linha está em falta (mesmo que outra parte dela tenha número). */
  faltaEm: Record<TipoDaLinha, number>;
  completas: number;
} {
  const tipos: TipoDaLinha[] = ["taxa", "imposto", "custo", "frete", "embalagem", "anuncio"];
  const porTipo = {} as Record<TipoDaLinha, number | null>;
  const comNumero = {} as Record<TipoDaLinha, number>;
  const inteiras = {} as Record<TipoDaLinha, number>;
  const faltaEm = {} as Record<TipoDaLinha, number>;
  for (const t of tipos) {
    const linhas = cascatas.map((c) => c.linhas.find((l) => l.tipo === t));
    const valores = linhas.map((l) => (typeof l?.valor === "number" ? l.valor : null));
    comNumero[t] = valores.filter((v) => v !== null).length;
    inteiras[t] = linhas.filter((l) => l && l.origem !== "falta").length;
    faltaEm[t] = linhas.filter((l) => l?.origem === "falta").length;
    porTipo[t] = comNumero[t] ? centavos(valores.reduce<number>((s, v) => s + (v ?? 0), 0) / cascatas.length) : null;
  }
  const total = centavos(cascatas.reduce((s, c) => s + c.total, 0));
  const sobra = centavos(cascatas.reduce((s, c) => s + c.sobra, 0));
  return { vendas: cascatas.length, total, sobra, fracao: total > 0 ? sobra / total : null, porTipo, comNumero, inteiras, faltaEm, completas: cascatas.filter((c) => c.completa).length };
}
