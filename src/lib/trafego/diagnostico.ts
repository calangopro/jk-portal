/**
 * Diagnóstico de campanha, conjunto e anúncio: o que está bom, o que está ruim
 * e em que etapa do funil o dinheiro se perde.
 *
 * Tudo aqui é CONTA, como os sinais do painel: cada veredito diz o número que o
 * disparou. Nada é opinião de modelo de linguagem.
 *
 * A RÉGUA É A PRÓPRIA CONTA. Cada item é comparado com a média da plataforma
 * para o mesmo objetivo (custo por compra, por conversa ou por clique). Isso
 * tem um motivo: o número absoluto da plataforma é inflado (ela conta pedido
 * criado e atribui venda por visualização), mas a inflação pega todos os itens
 * mais ou menos igual. Comparar um anúncio com os vizinhos continua valendo
 * mesmo quando o total não vale.
 *
 * O OBJETIVO vem do que a campanha declara, não do nome. Campanha de visita ao
 * perfil é julgada pelo clique, e não pela venda que ela não foi feita para
 * trazer. O que a tela faz é mostrar quanto da verba vai para objetivo que não
 * mede venda, que é a pergunta de quem paga a conta.
 *
 * CAMPANHA DE ENGAJAMENTO NÃO GANHA VEREDITO. Live e impulsionamento de
 * publicação buscam visualização e interação, que o painel não lê. A primeira
 * versão julgava essas campanhas pelo custo do clique e marcava toda live como
 * "ruim", contra uma régua que não é a dela. Sem a métrica certa, o item fica
 * como "pouco dado" e a tela diz por quê.
 *
 * Arquivo puro, para o teste rodar sem banco.
 */

export type Nivel = "campanha" | "conjunto" | "anuncio";
export type Objetivo = "venda" | "conversa" | "clique" | "engajamento";
export type Veredito = "bom" | "na_media" | "atencao" | "ruim" | "sem_dado";

export type Item = {
  nivel: Nivel;
  id: string;
  nome: string;
  campanha_id: string | null;
  conjunto_id: string | null;
  tipo: string | null;
  ativo: boolean | null;
  gasto: number;
  impressoes: number;
  cliques: number;
  cliques_todos: number | null;
  visitas: number | null;
  carrinhos: number | null;
  checkouts: number | null;
  compras: number | null;
  valor: number | null;
  conversas: number | null;
};

export type Etapa = "clique" | "visita" | "carrinho" | "checkout" | "compra";

export type Gargalo = { etapa: Etapa; taxa: number; daConta: number; texto: string };

export type Avaliado = Item & {
  objetivo: Objetivo;
  resultados: number;
  /** Custo por resultado. `null` sem resultado. */
  custo: number | null;
  /** Valor de compra que a plataforma diz, dividido pelo gasto. */
  retorno: number | null;
  veredito: Veredito;
  motivo: string;
  gargalo: Gargalo | null;
  filhos: Avaliado[];
};

export type LinhaDoFunil = {
  etapa: "impressao" | Etapa;
  nome: string;
  quantidade: number;
  /** Quanta gente havia na etapa anterior. `null` na primeira. */
  base: number | null;
  /** Quanto da etapa anterior chegou aqui. `null` na primeira e quando a anterior é zero. */
  taxa: number | null;
  /** Gasto dividido pela quantidade. Na impressão, o custo por mil. */
  custo: number | null;
};

export type VerbaPorObjetivo = { objetivo: Objetivo; nome: string; gasto: number; fatia: number; resultados: number; custo: number | null; itens: number };

export type Achado = { tipo: "rever" | "crescer"; nivel: Nivel; objetivo: Objetivo; nome: string; dentroDe: string | null; texto: string; peso: number };

export type Diagnostico = {
  campanhas: Avaliado[];
  funil: LinhaDoFunil[];
  /** A etapa do site em que menos gente passa, dita em frase. `null` sem volume. */
  maiorPerda: string | null;
  verba: VerbaPorObjetivo[];
  achados: Achado[];
  totais: { gasto: number; compras: number; valor: number; conversas: number };
};

const reais = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (n: number) => `${Math.round(n * 100)}%`;
const pct1 = (n: number) => `${(n * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const n0 = (v: number | null | undefined) => Number(v ?? 0);

export const NOME_DO_OBJETIVO: Record<Objetivo, string> = {
  venda: "Venda no site",
  conversa: "Conversa no WhatsApp",
  clique: "Visita e clique",
  engajamento: "Engajamento e alcance",
};

type Palavra = { um: string; varios: string; uma: string; nenhuma: string };

/** A palavra do resultado, com o artigo certo. No Google "compra" é a conversão que a conta configurou. */
export function resultadoEmPalavra(objetivo: Objetivo, plataforma: "meta" | "google"): Palavra {
  if (objetivo === "conversa") return { um: "conversa", varios: "conversas", uma: "uma", nenhuma: "nenhuma" };
  if (objetivo === "clique" || objetivo === "engajamento") return { um: "clique", varios: "cliques", uma: "um", nenhuma: "nenhum" };
  return plataforma === "google"
    ? { um: "conversão", varios: "conversões", uma: "uma", nenhuma: "nenhuma" }
    : { um: "compra", varios: "compras", uma: "uma", nenhuma: "nenhuma" };
}

/**
 * O que a campanha quer, pelo objetivo declarado. A exceção é campanha de
 * venda que roda para mensagem: sem compra nenhuma e com dez conversas ou
 * mais, o resultado dela é a conversa.
 */
export function objetivoDe(i: Pick<Item, "tipo" | "compras" | "conversas">): Objetivo {
  const compras = n0(i.compras);
  const conversas = n0(i.conversas);
  if (i.tipo === "vendas") return compras === 0 && conversas >= 10 ? "conversa" : "venda";
  if (i.tipo === "pesquisa" || i.tipo === "shopping" || i.tipo === "pmax" || i.tipo === "display" || i.tipo === "video" || i.tipo === "demand_gen") return "venda";
  if (i.tipo === "mensagens" || i.tipo === "engajamento") return conversas >= 5 ? "conversa" : "engajamento";
  if (i.tipo === "alcance") return "engajamento";
  return "clique";
}

function resultadosDe(i: Item, objetivo: Objetivo): number {
  if (objetivo === "venda") return n0(i.compras);
  if (objetivo === "conversa") return n0(i.conversas);
  if (objetivo === "engajamento") return 0;
  // Campanha de perfil quase não tem clique no link: vale o clique no anúncio.
  return i.cliques > 0 ? i.cliques : n0(i.cliques_todos);
}

type Taxas = Partial<Record<Etapa, number>>;

/** Mínimo de gente na etapa anterior para a taxa querer dizer alguma coisa. */
const BASE_MINIMA: Record<Etapa, number> = { clique: 1000, visita: 30, carrinho: 30, checkout: 5, compra: 5 };

function taxasDe(i: Pick<Item, "impressoes" | "cliques" | "visitas" | "carrinhos" | "checkouts" | "compras">, comFunilDoSite: boolean): Taxas {
  const t: Taxas = {};
  const div = (etapa: Etapa, num: number, den: number) => {
    if (den >= BASE_MINIMA[etapa]) t[etapa] = num / den;
  };
  div("clique", i.cliques, i.impressoes);
  if (comFunilDoSite) {
    div("visita", n0(i.visitas), i.cliques);
    div("carrinho", n0(i.carrinhos), n0(i.visitas));
    div("checkout", n0(i.checkouts), n0(i.carrinhos));
    div("compra", n0(i.compras), n0(i.checkouts));
  } else {
    div("compra", n0(i.compras), i.cliques);
  }
  return t;
}

const TEXTO_DO_GARGALO: Record<Etapa, (a: string, b: string) => string> = {
  clique: (a, b) => `Pouca gente clica: ${a} de quem vê, contra ${b} na conta. É o criativo ou o público.`,
  visita: (a, b) => `Clica e não chega a ver a página: ${a} chegam, contra ${b} na conta. Página lenta ou clique sem querer.`,
  carrinho: (a, b) => `Chega na página e não põe no carrinho: ${a}, contra ${b} na conta. Produto, preço ou a página de destino.`,
  checkout: (a, b) => `Põe no carrinho e não começa a compra: ${a}, contra ${b} na conta.`,
  compra: (a, b) => `Começa e não termina a compra: ${a}, contra ${b} na conta. Frete, pagamento ou cartão recusado.`,
};

/** A etapa em que o item mais perde em relação à conta. Só conta perda de 40% ou mais. */
function gargaloDe(item: Taxas, conta: Taxas, plataforma: "meta" | "google"): Gargalo | null {
  let pior: Gargalo | null = null;
  let menor = 0.6;
  for (const etapa of Object.keys(item) as Etapa[]) {
    const taxa = item[etapa];
    const daConta = conta[etapa];
    if (taxa === undefined || daConta === undefined || daConta <= 0) continue;
    const razao = taxa / daConta;
    if (razao < menor) {
      menor = razao;
      const texto =
        etapa === "compra" && plataforma === "google"
          ? `Clica e não converte: ${pct1(taxa)} dos cliques, contra ${pct1(daConta)} na conta.`
          : TEXTO_DO_GARGALO[etapa](pct1(taxa), pct1(daConta));
      pior = { etapa, taxa, daConta, texto };
    }
  }
  return pior;
}

function julgar(
  i: Item,
  objetivo: Objetivo,
  resultados: number,
  media: number | null,
  plataforma: "meta" | "google",
): { veredito: Veredito; motivo: string } {
  const { um, varios, uma, nenhuma } = resultadoEmPalavra(objetivo, plataforma);
  if (i.gasto <= 0) return { veredito: "sem_dado", motivo: "Sem gasto no período." };
  if (objetivo === "engajamento") {
    return { veredito: "sem_dado", motivo: "O painel não mede o resultado deste tipo de campanha (interação em publicação, vídeo ou live). Aqui aparece só o gasto e quantos viram." };
  }
  if (media === null || media <= 0) {
    return { veredito: "sem_dado", motivo: `A conta não teve ${nenhuma} ${um} nesse objetivo no período, então falta régua para comparar.` };
  }

  if (resultados === 0) {
    if (i.gasto >= 2 * media) {
      return { veredito: "ruim", motivo: `Gastou ${reais(i.gasto)} e não trouxe ${nenhuma} ${um}. Na conta, cada ${um} custa ${reais(media)} em média.` };
    }
    if (i.gasto >= media) {
      return { veredito: "atencao", motivo: `Já gastou ${reais(i.gasto)}, o preço médio de ${uma} ${um} na conta (${reais(media)}), e ainda não trouxe ${nenhuma}.` };
    }
    return { veredito: "sem_dado", motivo: `Gastou ${reais(i.gasto)}, pouco para julgar: ${uma} ${um} custa ${reais(media)} em média.` };
  }

  const custo = i.gasto / resultados;
  const razao = custo / media;
  const quantos = `${resultados.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${resultados === 1 ? um : varios}`;
  if (razao >= 1.5 && i.gasto >= media) {
    return { veredito: "ruim", motivo: `Cada ${um} sai por ${reais(custo)}, ${pct(razao - 1)} acima da média da conta (${reais(media)}).` };
  }
  if (razao >= 1.2 && i.gasto >= media) {
    return { veredito: "atencao", motivo: `Cada ${um} sai por ${reais(custo)}, ${pct(razao - 1)} acima da média da conta (${reais(media)}).` };
  }
  if (razao <= 0.7 && resultados >= 2) {
    return { veredito: "bom", motivo: `Cada ${um} sai por ${reais(custo)}, ${pct(1 - razao)} abaixo da média da conta (${reais(media)}), em ${quantos}.` };
  }
  return { veredito: "na_media", motivo: `Cada ${um} sai por ${reais(custo)}, perto da média da conta (${reais(media)}), em ${quantos}.` };
}

/** Monta a árvore, julga cada item e tira o funil, a verba por objetivo e os achados. */
export function diagnosticar(itens: Item[], plataforma: "meta" | "google"): Diagnostico {
  const comFunilDoSite = plataforma === "meta";
  const campanhasCruas = itens.filter((i) => i.nivel === "campanha");
  const objetivoDaCampanha = new Map(campanhasCruas.map((c) => [c.id, objetivoDe(c)]));

  // Régua: custo médio por resultado e taxas do funil, por objetivo, no nível de campanha.
  const regua = new Map<Objetivo, { gasto: number; resultados: number }>();
  for (const c of campanhasCruas) {
    const o = objetivoDaCampanha.get(c.id)!;
    const r = regua.get(o) ?? { gasto: 0, resultados: 0 };
    r.gasto += c.gasto;
    r.resultados += resultadosDe(c, o);
    regua.set(o, r);
  }
  const media = (o: Objetivo) => {
    const r = regua.get(o);
    return r && r.resultados > 0 ? r.gasto / r.resultados : null;
  };

  const deVenda = campanhasCruas.filter((c) => objetivoDaCampanha.get(c.id) === "venda");
  const soma = (lista: Item[], campo: keyof Item) => lista.reduce((s, i) => s + n0(i[campo] as number | null), 0);
  const contaDeVenda = {
    impressoes: soma(deVenda, "impressoes"),
    cliques: soma(deVenda, "cliques"),
    visitas: soma(deVenda, "visitas"),
    carrinhos: soma(deVenda, "carrinhos"),
    checkouts: soma(deVenda, "checkouts"),
    compras: soma(deVenda, "compras"),
  };
  const taxasDaConta = taxasDe(contaDeVenda, comFunilDoSite);

  const avaliar = (i: Item): Avaliado => {
    // Conjunto e anúncio herdam o objetivo da campanha: é ela que declara.
    const objetivo = (i.campanha_id ? objetivoDaCampanha.get(i.campanha_id) : undefined) ?? objetivoDaCampanha.get(i.id) ?? objetivoDe(i);
    const resultados = resultadosDe(i, objetivo);
    const { veredito, motivo } = julgar(i, objetivo, resultados, media(objetivo), plataforma);
    return {
      ...i,
      objetivo,
      resultados,
      custo: resultados > 0 ? i.gasto / resultados : null,
      retorno: i.gasto > 0 && n0(i.valor) > 0 ? n0(i.valor) / i.gasto : null,
      veredito,
      motivo,
      gargalo: objetivo === "venda" ? gargaloDe(taxasDe(i, comFunilDoSite), taxasDaConta, plataforma) : null,
      filhos: [],
    };
  };

  const porGasto = (a: Avaliado, b: Avaliado) => b.gasto - a.gasto;
  const anuncios = itens.filter((i) => i.nivel === "anuncio").map(avaliar);
  const conjuntos = itens.filter((i) => i.nivel === "conjunto").map(avaliar);
  const campanhas = campanhasCruas.map(avaliar);

  const conjuntoPorId = new Map(conjuntos.map((c) => [c.id, c]));
  const campanhaPorId = new Map(campanhas.map((c) => [c.id, c]));
  for (const a of anuncios) (a.conjunto_id ? conjuntoPorId.get(a.conjunto_id) : undefined)?.filhos.push(a);
  for (const c of conjuntos) {
    c.filhos.sort(porGasto);
    (c.campanha_id ? campanhaPorId.get(c.campanha_id) : undefined)?.filhos.push(c);
  }
  for (const c of campanhas) c.filhos.sort(porGasto);
  campanhas.sort(porGasto);

  // Funil da plataforma, só com campanha de venda: misturar campanha de perfil derrubaria toda taxa.
  const gastoDeVenda = soma(deVenda, "gasto");
  const funil: LinhaDoFunil[] = [];
  const etapaDoFunil = (etapa: LinhaDoFunil["etapa"], nome: string, quantidade: number, anterior: number | null) => {
    funil.push({
      etapa,
      nome,
      quantidade,
      base: anterior,
      taxa: anterior === null || anterior <= 0 ? null : quantidade / anterior,
      custo: quantidade > 0 ? (etapa === "impressao" ? (gastoDeVenda / quantidade) * 1000 : gastoDeVenda / quantidade) : null,
    });
  };
  etapaDoFunil("impressao", "Viram o anúncio", contaDeVenda.impressoes, null);
  etapaDoFunil("clique", "Clicaram", contaDeVenda.cliques, contaDeVenda.impressoes);
  if (comFunilDoSite) {
    etapaDoFunil("visita", "Chegaram na página", contaDeVenda.visitas, contaDeVenda.cliques);
    etapaDoFunil("carrinho", "Puseram no carrinho", contaDeVenda.carrinhos, contaDeVenda.visitas);
    etapaDoFunil("checkout", "Começaram a compra", contaDeVenda.checkouts, contaDeVenda.carrinhos);
    etapaDoFunil("compra", "Compraram, segundo o Meta", contaDeVenda.compras, contaDeVenda.checkouts);
  } else {
    etapaDoFunil("compra", "Converteram, segundo o Google", contaDeVenda.compras, contaDeVenda.cliques);
  }

  // A maior perda dentro do site: a etapa com a menor passagem, entre as que têm volume.
  const NO_SITE: Partial<Record<LinhaDoFunil["etapa"], string>> = {
    carrinho: "entre chegar na página e pôr no carrinho",
    checkout: "entre pôr no carrinho e começar a compra",
    compra: "entre começar e terminar a compra",
  };
  const doSite = funil.filter((f) => NO_SITE[f.etapa] && f.taxa !== null && (f.base ?? 0) >= 30);
  const pior = comFunilDoSite && doSite.length >= 2 ? [...doSite].sort((a, b) => (a.taxa ?? 1) - (b.taxa ?? 1))[0] : null;
  const maiorPerda = pior && pior.taxa !== null
    ? `A maior perda está ${NO_SITE[pior.etapa]}: de cada 100 pessoas que chegam nessa etapa, ${Math.round(pior.taxa * 100)} ${Math.round(pior.taxa * 100) === 1 ? "passa" : "passam"}.`
    : null;

  // Para onde vai a verba, por objetivo.
  const gastoTotal = soma(campanhasCruas, "gasto");
  const verba: VerbaPorObjetivo[] = (["venda", "conversa", "clique", "engajamento"] as Objetivo[])
    .map((objetivo) => {
      const lista = campanhasCruas.filter((c) => objetivoDaCampanha.get(c.id) === objetivo);
      const gasto = soma(lista, "gasto");
      const resultados = lista.reduce((s, c) => s + resultadosDe(c, objetivo), 0);
      return { objetivo, nome: NOME_DO_OBJETIVO[objetivo], gasto, fatia: gastoTotal > 0 ? gasto / gastoTotal : 0, resultados, custo: resultados > 0 ? gasto / resultados : null, itens: lista.length };
    })
    .filter((v) => v.gasto > 0);

  // Achados: o nível MAIS ALTO em que o veredito vale. Campanha ruim não repete os anúncios dela.
  const achados: Achado[] = [];
  const nomeDoNivel: Record<Nivel, string> = { campanha: "Campanha", conjunto: "Conjunto", anuncio: "Anúncio" };
  const minimoParaTarefa = Math.max(50, gastoTotal * 0.005);
  const colher = (lista: Avaliado[], dentroDe: string | null, paiRuim: boolean, paiBom: boolean) => {
    for (const i of lista) {
      // Item pausado não é tarefa: já foi resolvido por alguém.
      const ligado = i.ativo !== false;
      const ruim = i.veredito === "ruim";
      const bom = i.veredito === "bom";
      // Tarefa precisa valer o trabalho: anúncio de R$ 12 sem resultado é "ruim" pela régua e irrelevante no bolso.
      if (i.gasto < minimoParaTarefa) {
        colher(i.filhos, `${nomeDoNivel[i.nivel]} ${i.nome}`, paiRuim || ruim, paiBom || bom);
        continue;
      }
      if (ligado && ruim && !paiRuim) achados.push({ tipo: "rever", nivel: i.nivel, objetivo: i.objetivo, nome: i.nome, dentroDe, texto: i.gargalo ? `${i.motivo} ${i.gargalo.texto}` : i.motivo, peso: i.gasto });
      if (ligado && bom && !paiBom) achados.push({ tipo: "crescer", nivel: i.nivel, objetivo: i.objetivo, nome: i.nome, dentroDe, texto: i.motivo, peso: i.gasto });
      colher(i.filhos, `${nomeDoNivel[i.nivel]} ${i.nome}`, paiRuim || ruim, paiBom || bom);
    }
  };
  colher(campanhas, null, false, false);
  // Primeiro o que mexe com venda, depois conversa, depois clique; dentro de cada um, o que mais gastou.
  // Sem isso a lista enchia de anúncio de visita ao perfil e a campanha de venda ficava no fim.
  const prioridade: Record<Objetivo, number> = { venda: 0, conversa: 1, clique: 2, engajamento: 3 };
  achados.sort((a, b) => prioridade[a.objetivo] - prioridade[b.objetivo] || b.peso - a.peso);

  return {
    campanhas,
    funil,
    maiorPerda,
    verba,
    achados,
    totais: { gasto: gastoTotal, compras: soma(campanhasCruas, "compras"), valor: soma(campanhasCruas, "valor"), conversas: soma(campanhasCruas, "conversas") },
  };
}
