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

export type OrigemDoNumero = "real" | "estimado" | "falta";
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
  /** O custo de cada peça (da conta da Margem), com o motivo quando falta. */
  itens: { nome: string; quantidade: number; custo: number | null; falta: string | null }[];
  /** O anúncio por venda, rateado, e como se chegou nele. Nulo sem gasto lançado. */
  anuncioPorVenda: number | null;
  anuncioDetalhe?: string | null;
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

export function montarCascata(e: EntradaDaCascata): Cascata {
  const p = e.parametros;
  const linhas: LinhaDaCascata[] = [];

  // Taxa do gateway: a lida da Appmax vale; sem ela, a média da Margem.
  if (e.taxaReal) {
    linhas.push({
      tipo: "taxa",
      rotulo: "Taxa da Appmax",
      valor: centavos(e.taxaReal.descontado),
      origem: "real",
      detalhe: `Lida na Appmax: ${reais(e.taxaReal.processamento)} de processamento e ${reais(e.taxaReal.gateway)} de gateway e antifraude.`,
    });
  } else if (p.taxa !== null || n(p.tarifaFixa) > 0) {
    linhas.push({
      tipo: "taxa",
      rotulo: "Taxa do gateway",
      valor: centavos(e.total * n(p.taxa) + n(p.tarifaFixa)),
      origem: "estimado",
      detalhe: "Estimada com a taxa média da Margem. A Appmax ainda não devolveu o valor deste pedido.",
    });
  } else {
    linhas.push({ tipo: "taxa", rotulo: "Taxa do gateway", valor: null, origem: "falta", detalhe: "Sem leitura da Appmax e sem taxa na Margem." });
  }

  // Imposto: sempre estimativa, é o percentual da Margem.
  linhas.push(
    p.imposto === null
      ? { tipo: "imposto", rotulo: "Imposto", valor: null, origem: "falta", detalhe: "Falta o imposto nos parâmetros da Margem." }
      : { tipo: "imposto", rotulo: "Imposto", valor: centavos(e.total * p.imposto), origem: "estimado", detalhe: `${(p.imposto * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% sobre o total, o percentual da Margem.` },
  );

  // Custo das peças: a conta da Margem, produto a produto. Parcial conta o que sabe e diz o que falta.
  const comCusto = e.itens.filter((i) => i.custo !== null);
  const somaDoCusto = centavos(comCusto.reduce((s, i) => s + (i.custo as number) * Math.max(i.quantidade, 1), 0));
  if (e.itens.length === 0) {
    linhas.push({ tipo: "custo", rotulo: "Custo das peças", valor: null, origem: "falta", detalhe: "O pedido não trouxe as peças." });
  } else if (comCusto.length === e.itens.length) {
    linhas.push({ tipo: "custo", rotulo: "Custo das peças", valor: somaDoCusto, origem: "real", detalhe: "Peso, preço do grama e resto de cada peça, pela conta da Margem." });
  } else {
    const semCusto = e.itens.filter((i) => i.custo === null);
    linhas.push({
      tipo: "custo",
      rotulo: "Custo das peças",
      valor: comCusto.length ? somaDoCusto : null,
      origem: "falta",
      detalhe: `${semCusto.length === 1 ? "Falta o custo de 1 peça" : `Falta o custo de ${semCusto.length} peças`} (${e.itens.length === 1 ? "o pedido tem 1" : `de ${e.itens.length} no pedido`})${semCusto[0]?.falta ? `: ${semCusto[0].falta.toLowerCase()}` : ""}.${comCusto.length ? " O valor soma só as que têm custo." : ""}`,
    });
  }

  // Frete: o que o cliente pagou é repassado à transportadora (suposição); no frete grátis, o médio da Margem.
  if (e.freteCobrado > 0) {
    linhas.push({ tipo: "frete", rotulo: "Frete", valor: centavos(e.freteCobrado), origem: "estimado", detalhe: "O cliente pagou este frete. Supõe-se repassado à transportadora, sem sobra nem perda." });
  } else if (p.frete !== null) {
    linhas.push({ tipo: "frete", rotulo: "Frete", valor: centavos(p.frete), origem: "estimado", detalhe: "Frete grátis para o cliente: vale o frete médio que a JK paga, da Margem." });
  } else {
    linhas.push({ tipo: "frete", rotulo: "Frete", valor: null, origem: "falta", detalhe: "Frete grátis e sem o frete médio nos parâmetros da Margem." });
  }

  linhas.push(
    p.embalagem === null
      ? { tipo: "embalagem", rotulo: "Embalagem e brinde", valor: null, origem: "falta", detalhe: "Falta a embalagem nos parâmetros da Margem." }
      : { tipo: "embalagem", rotulo: "Embalagem e brinde", valor: centavos(p.embalagem), origem: "estimado", detalhe: "O valor por pedido da Margem." },
  );

  linhas.push(
    e.anuncioPorVenda === null
      ? { tipo: "anuncio", rotulo: "Anúncio", valor: null, origem: "falta", detalhe: "Sem gasto de anúncio lançado nos últimos 30 dias." }
      : { tipo: "anuncio", rotulo: "Anúncio", valor: centavos(e.anuncioPorVenda), origem: "estimado", detalhe: e.anuncioDetalhe ?? "Rateio: o gasto de anúncio dos últimos 30 dias dividido pelos pedidos pagos." },
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
  completas: number;
} {
  const tipos: TipoDaLinha[] = ["taxa", "imposto", "custo", "frete", "embalagem", "anuncio"];
  const porTipo = {} as Record<TipoDaLinha, number | null>;
  const comNumero = {} as Record<TipoDaLinha, number>;
  const inteiras = {} as Record<TipoDaLinha, number>;
  for (const t of tipos) {
    const linhas = cascatas.map((c) => c.linhas.find((l) => l.tipo === t));
    const valores = linhas.map((l) => (typeof l?.valor === "number" ? l.valor : null));
    comNumero[t] = valores.filter((v) => v !== null).length;
    inteiras[t] = linhas.filter((l) => l && l.origem !== "falta").length;
    porTipo[t] = comNumero[t] ? centavos(valores.reduce<number>((s, v) => s + (v ?? 0), 0) / cascatas.length) : null;
  }
  const total = centavos(cascatas.reduce((s, c) => s + c.total, 0));
  const sobra = centavos(cascatas.reduce((s, c) => s + c.sobra, 0));
  return { vendas: cascatas.length, total, sobra, fracao: total > 0 ? sobra / total : null, porTipo, comNumero, inteiras, completas: cascatas.filter((c) => c.completa).length };
}
