/**
 * A conta de custo e margem, igual à da planilha do dono.
 *
 *   custo        = gramas x preço do grama + resto da peça   (ouro)
 *                = custo fixo                                (prata, semijoia)
 *   líquido      = preço x (1 - taxa - imposto)
 *   margem (R$)  = líquido - custo - frete - embalagem
 *   margem (%)   = margem / preço
 *   desconto máx = 1 - (custo + frete + embalagem) / (preço cheio x (1 - taxa - imposto - margem mínima))
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

export const MATERIAIS = ["ouro_18k", "ouro_10k", "prata_com_ouro"] as const;
export type Material = (typeof MATERIAIS)[number];

export const ROTULO_DO_MATERIAL: Record<Material, string> = {
  ouro_18k: "Ouro 18k",
  ouro_10k: "Ouro 10k",
  prata_com_ouro: "Prata com ouro",
};

export type Parametros = {
  cotacao18k: number | null;
  cotacao10k: number | null;
  /** Frações: 0,05 = 5%. */
  taxa: number | null;
  imposto: number | null;
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

export function cotacaoDo(material: Material, p: Parametros): number | null {
  return material === "ouro_10k" ? p.cotacao10k : p.cotacao18k;
}

export function custoDoProduto(c: CustoGravado | null, familias: Map<string, Familia>, p: Parametros): Custo {
  if (!c) return { valor: null, detalhe: null, falta: "Sem custo" };
  if (c.custoFixo !== null) return { valor: c.custoFixo, detalhe: "Custo fixo", falta: null };
  if (!c.material) return { valor: null, detalhe: null, falta: "Sem custo" };

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
  const r = liquido - custo - n(p.frete) - n(p.embalagem);
  return { reais: Math.round(r * 100) / 100, fracao: preco > 0 ? r / preco : 0 };
}

/** O maior desconto sobre o preço cheio que ainda deixa a margem mínima. */
export function descontoMaximo(precoCheio: number, custo: number, p: Parametros): number {
  const base = precoCheio * (1 - n(p.taxa) - n(p.imposto) - n(p.margemMinima));
  if (base <= 0) return 0;
  return Math.max(0, 1 - (custo + n(p.frete) + n(p.embalagem)) / base);
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
  if (t.includes("10k")) return "ouro_10k";
  if (t.includes("ouro") || t.includes("18k")) return "ouro_18k";
  return null;
}

export function chaveDaFamilia(nome: string): { material: Material; tipo: string; largura: string; perfil: string } | null {
  const material = materialPeloNome(nome);
  if (!material) return null;
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
