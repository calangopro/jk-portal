/**
 * A conta de custo e margem, igual à da planilha do dono.
 *
 *   custo        = gramas x preço do grama + resto da peça   (ouro)
 *                = largura (mm) x gramas por mm x peças x preço do grama
 *                  da prata + resto da peça                  (prata 950)
 *                = custo fixo                                (semijoia, o que não tem largura)
 *   líquido      = preço x (1 - taxa - imposto)
 *   margem (R$)  = líquido - tarifa fixa - custo - frete - embalagem
 *   margem (%)   = margem / preço
 *   desconto máx = 1 - (custo + frete + embalagem + tarifa fixa) / (preço cheio x (1 - taxa - imposto - margem mínima))
 *
 * A taxa é a efetiva do gateway (`taxaEfetiva`): a soma das partes do cartão
 * (taxa, mais a antecipação paga), do Pix e da proporção entre os dois. A
 * tarifa fixa por venda (R$ 0,99 da Appmax) sai em reais, não em %.
 *
 * E o limite de anúncio, que é a mesma margem vista pelo lado de quem compra
 * mídia: quanto a venda aguenta pagar de anúncio.
 *   CPA de empate = margem (R$) no preço de venda: pagou isso, lucro zero
 *   CPA máximo    = CPA de empate - margem mínima x preço: pagou isso, sobra a mínima
 *   ROAS mínimo   = preço / CPA máximo: o retorno sobre o anúncio que mantém a mínima
 *
 * Parâmetro vazio conta como zero, como o N() da planilha: dá para ver margem
 * antes de saber o imposto, e ela só melhora de precisão.
 *
 * Função pura, sem `server-only` e sem atalho `@/`: roda no servidor, no
 * navegador e no teste `npm run verificar:margem`.
 */

export const MATERIAIS = ["ouro_18k", "ouro_10k", "prata_com_ouro", "prata_950"] as const;
export type Material = (typeof MATERIAIS)[number];

export const ROTULO_DO_MATERIAL: Record<Material, string> = {
  ouro_18k: "Ouro 18k",
  ouro_10k: "Ouro 10k",
  prata_com_ouro: "Prata com ouro",
  prata_950: "Prata 950",
};

/**
 * As partes da taxa do gateway, em frações (0,0349 = 3,49%). Tudo vazio = o
 * painel usa a `taxa` única de antes.
 */
export type TaxasDoGateway = {
  /** Taxa do cartão de crédito sobre a venda. */
  cartao: number | null;
  /** Taxa do Pix sobre a venda. */
  pix: number | null;
  /** Taxa de antecipação por mês (2,49% = 0,0249), proporcional aos dias. */
  antecipacaoAoMes: number | null;
  /** Que fração das vendas no cartão é antecipada (0 a 1). */
  fracaoAntecipada: number | null;
  /** Prazo médio, em meses, que a antecipação adianta o dinheiro. */
  prazoMeses: number | null;
  /** Que fração das vendas é no cartão (o resto é Pix). Vazio: tudo cartão. */
  proporcaoCartao: number | null;
};

export const GATEWAY_VAZIO: TaxasDoGateway = {
  cartao: null,
  pix: null,
  antecipacaoAoMes: null,
  fracaoAntecipada: null,
  prazoMeses: null,
  proporcaoCartao: null,
};

export type Parametros = {
  cotacao18k: number | null;
  cotacao10k: number | null;
  /** Preço médio do grama da prata 950 que a JK paga. */
  cotacaoPrata: number | null;
  /** Gramas de prata por milímetro de largura, numa peça (uma aliança). Média, não aro a aro. */
  prataGramasPorMm: number | null;
  /** Resto da peça de prata, por produto: feitio, solitário de brinde, caixinha. */
  prataResto: number | null;
  /**
   * Fração: 0,05 = 5%. É a taxa que a conta usa: sai das partes do gateway
   * quando alguma está preenchida, senão é a taxa única gravada antes.
   */
  taxa: number | null;
  /** As partes do gateway, como estão gravadas (para a tela). */
  gateway?: TaxasDoGateway;
  /** Tarifa fixa por venda, em reais (gateway e antifraude). */
  tarifaFixa?: number | null;
  imposto: number | null;
  /** Frete médio que a JK paga por pedido, em reais, já diluindo o frete grátis. */
  frete: number | null;
  embalagem: number | null;
  margemMinima: number | null;
};

export type Familia = {
  codigo: string;
  material: Material;
  tipo: string;
  largura: string;
  perfil: string;
  gramas: number | null;
  arosReferencia: string | null;
  resto: number | null;
};

/** A linha de `produto_custos`. Sem linha = produto de custo fixo ainda sem custo. */
export type CustoGravado = {
  material: Material | null;
  familia: string | null;
  gramas: number | null;
  resto: number | null;
  custoFixo: number | null;
};

export type Custo =
  | { valor: number; detalhe: string; falta: null }
  | { valor: null; detalhe: null; falta: string };

export type Margem = {
  custo: number;
  /** Na base do preço CHEIO. */
  reais: number;
  fracao: number;
  descontoMaximo: number;
  abaixoDoMinimo: boolean;
  /** Promoção valendo hoje: o desconto dela e a margem que sobra. */
  descontoHoje: number | null;
  fracaoHoje: number | null;
  /** A promoção de hoje passa do desconto máximo. */
  hojePassa: boolean;
  /** Quanto a venda aguenta de anúncio, no preço de HOJE (com a promoção, se houver). */
  anuncio: LimiteDeAnuncio;
};

export type LimiteDeAnuncio = {
  /** O preço em que a conta foi feita. */
  preco: number;
  /** O máximo por venda que ainda deixa a margem mínima. Zero ou negativo: não aguenta anúncio. */
  cpaMaximo: number;
  /** O máximo por venda para empatar (lucro zero). */
  cpaEmpate: number;
  /** Retorno mínimo sobre o anúncio para manter a margem mínima (5 = R$ 5 vendidos por R$ 1 de anúncio). */
  roasMinimo: number | null;
  /** Retorno mínimo para não ter prejuízo. */
  roasEmpate: number | null;
};

const n = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export const reais = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const porcento = (f: number, casas = 1) =>
  `${(f * 100).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;

const gramasTexto = (g: number) => `${g.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} g`;

/**
 * A taxa efetiva do gateway, como fração do preço. Nula quando nenhuma parte
 * foi preenchida (aí vale a taxa única).
 *   cartão efetivo = taxa do cartão + fração antecipada x taxa ao mês x prazo
 *   taxa           = proporção no cartão x cartão efetivo + (1 - proporção) x Pix
 */
export function taxaEfetiva(t: TaxasDoGateway | null | undefined): number | null {
  if (!t || (t.cartao === null && t.pix === null)) return null;
  const cartao = n(t.cartao) + n(t.fracaoAntecipada) * n(t.antecipacaoAoMes) * n(t.prazoMeses);
  const noCartao = t.proporcaoCartao ?? (t.cartao !== null ? 1 : 0);
  return noCartao * cartao + (1 - noCartao) * n(t.pix);
}

export function cotacaoDo(material: Material, p: Parametros): number | null {
  if (material === "prata_950") return p.cotacaoPrata;
  return material === "ouro_10k" ? p.cotacao10k : p.cotacao18k;
}

/** A largura escrita no nome ("Prata 950 3,5mm" dá 3,5). Sem "mm" no nome, nulo. */
export function larguraDoNome(nome: string): number | null {
  const m = nome.toLowerCase().match(/(\d+(?:[.,]\d+)?)\s*mm/);
  if (!m) return null;
  const v = Number(m[1].replace(",", "."));
  return Number.isFinite(v) && v > 0 && v <= 20 ? v : null;
}

/** Par de alianças tem duas peças; o resto, uma. A mesma leitura de `chaveDaFamilia`. */
export function pecasDoNome(nome: string): 1 | 2 {
  const t = ` ${nome.toLowerCase()}`;
  return t.includes(" par ") || t.includes("alianças") || t.includes("aliancas") ? 2 : 1;
}

const mmTexto = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} mm`;

/**
 * Prata 950: o peso sai da largura do nome, não de uma lista de produtos. O
 * peso gravado no produto vence a conta (peça que pesa diferente da média).
 */
function custoDaPrata(c: CustoGravado | null, nome: string | null, p: Parametros): Custo {
  const resto = c?.resto ?? p.prataResto;
  let gramas = c?.gramas ?? null;
  let comoPesou = "peso do produto";
  if (gramas === null) {
    if (!nome || !/alian|anel|anéis|aneis/i.test(nome)) {
      return { valor: null, detalhe: null, falta: "Não é aliança nem anel: informe o peso ou o custo da peça" };
    }
    const largura = larguraDoNome(nome);
    if (largura === null) {
      return { valor: null, detalhe: null, falta: "Sem largura no nome: informe o peso ou o custo da peça" };
    }
    if (!p.prataGramasPorMm) return { valor: null, detalhe: null, falta: "Falta as gramas por milímetro da prata" };
    const pecas = pecasDoNome(nome!);
    gramas = Math.round(largura * p.prataGramasPorMm * pecas * 1000) / 1000;
    comoPesou = `${pecas === 2 ? "2 peças x " : ""}${mmTexto(largura)} x ${p.prataGramasPorMm.toLocaleString("pt-BR", { maximumFractionDigits: 4 })} g/mm`;
  }
  if (!p.cotacaoPrata) return { valor: null, detalhe: null, falta: "Falta o preço do grama da prata 950" };
  const valor = Math.round((gramas * p.cotacaoPrata + n(resto)) * 100) / 100;
  const partes = [`${gramasTexto(gramas)} x ${reais(p.cotacaoPrata)}`, resto !== null ? `${reais(resto)} de resto` : null].filter(Boolean);
  return { valor, detalhe: `${partes.join(" + ")} (${comoPesou})`, falta: null };
}

/**
 * O custo de um produto. `nome` é o do catálogo: com ele, prata 950 sem linha
 * de custo já sai calculada pela largura.
 */
export function custoDoProduto(
  c: CustoGravado | null,
  familias: Map<string, Familia>,
  p: Parametros,
  nome: string | null = null,
): Custo {
  if (c?.custoFixo !== null && c?.custoFixo !== undefined) return { valor: c.custoFixo, detalhe: "Custo fixo", falta: null };
  if (!c) {
    if (nome && materialPeloNome(nome) === "prata_950") return custoDaPrata(null, nome, p);
    return { valor: null, detalhe: null, falta: "Sem custo" };
  }
  if (!c.material) return { valor: null, detalhe: null, falta: "Sem custo" };
  if (c.material === "prata_950") return custoDaPrata(c, nome, p);

  const familia = c.familia ? familias.get(c.familia) : undefined;
  const gramas = c.gramas ?? familia?.gramas ?? null;
  const resto = c.resto ?? familia?.resto ?? null;
  if (gramas === null && resto === null) {
    return { valor: null, detalhe: null, falta: familia ? `Falta o peso da família ${familia.codigo}` : "Falta o peso" };
  }
  const cotacao = cotacaoDo(c.material, p);
  if (gramas !== null && !cotacao) {
    return { valor: null, detalhe: null, falta: `Falta o preço do grama do ${c.material === "ouro_10k" ? "ouro 10k" : "ouro 18k"}` };
  }
  const valor = Math.round((n(gramas) * n(cotacao) + n(resto)) * 100) / 100;
  const partes = [
    gramas !== null ? `${gramasTexto(gramas)} x ${reais(n(cotacao))}` : null,
    resto !== null ? `${reais(resto)} de resto` : null,
  ].filter(Boolean);
  const deOnde = c.gramas !== null || c.resto !== null ? "do produto" : familia ? `da família ${familia.codigo}` : "do produto";
  return { valor, detalhe: `${partes.join(" + ")} (${deOnde})`, falta: null };
}

/** Margem a um preço qualquer. */
export function margemNoPreco(preco: number, custo: number, p: Parametros): { reais: number; fracao: number } {
  const liquido = preco * (1 - n(p.taxa) - n(p.imposto));
  const r = liquido - n(p.tarifaFixa) - custo - n(p.frete) - n(p.embalagem);
  return { reais: Math.round(r * 100) / 100, fracao: preco > 0 ? r / preco : 0 };
}

/** O maior desconto sobre o preço cheio que ainda deixa a margem mínima. */
export function descontoMaximo(precoCheio: number, custo: number, p: Parametros): number {
  const base = precoCheio * (1 - n(p.taxa) - n(p.imposto) - n(p.margemMinima));
  if (base <= 0) return 0;
  return Math.max(0, 1 - (custo + n(p.frete) + n(p.embalagem) + n(p.tarifaFixa)) / base);
}

/** Quanto uma venda a este preço aguenta pagar de anúncio. */
export function limiteDeAnuncio(preco: number, custo: number, p: Parametros): LimiteDeAnuncio {
  const empate = margemNoPreco(preco, custo, p).reais;
  const maximo = Math.round((empate - n(p.margemMinima) * preco) * 100) / 100;
  return {
    preco,
    cpaMaximo: maximo,
    cpaEmpate: empate,
    roasMinimo: maximo > 0 ? preco / maximo : null,
    roasEmpate: empate > 0 ? preco / empate : null,
  };
}

export function abaixoDoMinimo(fracao: number, p: Parametros): boolean {
  return fracao < n(p.margemMinima);
}

export function calcularMargem(
  precoCheio: number,
  precoHoje: number | null,
  custo: number,
  p: Parametros,
): Margem {
  const cheio = margemNoPreco(precoCheio, custo, p);
  const max = descontoMaximo(precoCheio, custo, p);
  const temPromo = precoHoje !== null && precoHoje < precoCheio;
  const hoje = temPromo ? margemNoPreco(precoHoje!, custo, p) : null;
  const descontoHoje = temPromo ? 1 - precoHoje! / precoCheio : null;
  return {
    custo,
    reais: cheio.reais,
    fracao: cheio.fracao,
    descontoMaximo: max,
    abaixoDoMinimo: abaixoDoMinimo(cheio.fracao, p),
    descontoHoje,
    fracaoHoje: hoje?.fracao ?? null,
    hojePassa: hoje !== null && abaixoDoMinimo(hoje.fracao, p),
    anuncio: limiteDeAnuncio(temPromo ? precoHoje! : precoCheio, custo, p),
  };
}

/**
 * Preço de vitrine: o maior valor terminado em ,90 que não passa do pedido.
 * Em centavos inteiros, porque 359,9 + 0,1 em ponto flutuante dá 359,999...
 */
export function terminadoEm90(valor: number): number {
  const c = Math.round(valor * 100);
  return (Math.floor((c + 10) / 100) * 100 - 10) / 100;
}

/** O menor valor terminado em ,90 que não fica abaixo do pedido (para não passar do desconto máximo). */
export function terminadoEm90ParaCima(valor: number): number {
  const c = Math.round(valor * 100);
  return (Math.ceil((c + 10) / 100) * 100 - 10) / 100;
}

/** Preço da campanha a partir do desconto, já em ,90. */
export function precoComDesconto(precoCheio: number, desconto: number): number {
  return terminadoEm90(precoCheio * (1 - desconto));
}

// ------------------------------------------------------------------ família de um produto novo

/**
 * A mesma regra da planilha do dono (material, tipo, largura e perfil saem do
 * nome), para produto que entrar no catálogo depois achar a família sozinho.
 */
export function materialPeloNome(nome: string): Material | null {
  const t = nome.toLowerCase();
  if (t.includes("banhad") || t.includes("semijoia")) return null;
  if (t.includes("prata") && t.includes("ouro")) return "prata_com_ouro";
  if (t.includes("prata")) return "prata_950";
  if (t.includes("10k")) return "ouro_10k";
  if (t.includes("ouro") || t.includes("18k")) return "ouro_18k";
  return null;
}

export function chaveDaFamilia(nome: string): { material: Material; tipo: string; largura: string; perfil: string } | null {
  const material = materialPeloNome(nome);
  if (!material || material === "prata_950") return null;
  const t = nome.toLowerCase();
  const m = t.match(/(\d+(?:[.,]\d+)?)\s*mm/);
  if (!m) return null;
  const largura = `${m[1].replace(".", ",")} mm`;
  const perfis = (
    [
      ["Abaulada", "abaulad"],
      ["Chanfrada", "chanfrad"],
      ["Reta", " reta"],
      ["Quadrada", "quadrad"],
    ] as const
  )
    .filter(([, chave]) => t.includes(chave))
    .map(([p]) => p as string);
  if (t.includes("anat")) perfis.push("Anatômica");
  const tipo = t.includes("par ") || t.includes("alianças") || t.includes("aliancas") ? "Par" : "Peça";
  return { material, tipo, largura, perfil: perfis.join(" ") || "Sem perfil no nome" };
}
