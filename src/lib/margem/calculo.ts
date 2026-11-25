/**
 * A conta de custo e margem, igual à da planilha do dono.
 *
 *   custo        = custo fixo do produto, se houver
 *                = gramas gravadas x preço do grama + resto  (peso do Carlos, família)
 *                = pelas REGRAS, lendo o nome do produto:   (o resto do catálogo, cartão 82)
 *                  largura x gramas por mm x fator do modelo x peças x preço do grama
 *                  + pedras + folga sobre o estimado + brinde + caixinha
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
  /** Resto da peça de prata, por produto: o que não é prata, fora o brinde e a caixinha (que estão nas regras). */
  prataResto: number | null;
  /** As regras do custo das peças (cartão 82). Ausente: tudo vazio. */
  regras?: RegrasDeCusto;
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
  | { valor: number; detalhe: string; falta: null; origem?: OrigemDoCusto }
  | { valor: null; detalhe: null; falta: string; motivo?: MotivoDaFalta };

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
const numTexto = (v: number, casas = 4) => v.toLocaleString("pt-BR", { maximumFractionDigits: casas });
const centavos = (v: number) => Math.round(v * 100) / 100;

// ------------------------------------------------------------------ regras de custo (cartão 82)

/**
 * O custo das peças por REGRAS, para o catálogo inteiro ter custo sem ninguém
 * preencher produto por produto. O painel lê o nome do produto (largura, par ou
 * peça, aliança ou anel, modelo, pedras, brinde) e calcula:
 *
 *   metal   = largura x gramas por mm (do material e do tipo) x fator do modelo x peças x preço do grama
 *   pedras  = pedras da meia volta ou da volta completa x custo da pedra (numa peça só do par)
 *   folga   = % sobre o que é ESTIMADO (metal pelas regras e pedras), nunca sobre o peso gravado
 *   brinde  = anel solitário que vem junto ("+ Anel Solitário ...")
 *   caixinha= uma por produto de aliança
 *
 * Peso gravado no produto (planilha do Carlos) e custo fixo vencem as regras.
 * Regra vazia NÃO vira zero escondido: falta o número, o produto fica sem custo
 * e diz o que falta; parte pequena vazia (pedras, brinde) sai no detalhe.
 */

export const TIPOS_DE_PECA = ["alianca", "anel"] as const;
export type TipoDePeca = (typeof TIPOS_DE_PECA)[number];

/** Os modelos que mudam o peso. "Reta" é a base: fator 1, sempre. */
export const MODELOS = ["anatomica", "chanfrada", "abaulada", "fio_de_ouro"] as const;
export type Modelo = (typeof MODELOS)[number] | "reta";

export const ROTULO_DO_MODELO: Record<Modelo, string> = {
  reta: "Reta",
  anatomica: "Anatômica",
  chanfrada: "Chanfrada",
  abaulada: "Abaulada",
  fio_de_ouro: "Com fio de ouro",
};

/** Os tamanhos de zircônia que a JK compra, em mm. */
export const TAMANHOS_DE_PEDRA = ["1,00", "1,25", "1,50"] as const;
export type TamanhoDePedra = (typeof TAMANHOS_DE_PEDRA)[number];

/** Os materiais que as gramas por mm atendem (prata com ouro não: a parte de ouro não sai da largura). */
export const MATERIAIS_POR_MM = ["prata_950", "ouro_18k", "ouro_10k"] as const;
export type MaterialPorMm = (typeof MATERIAIS_POR_MM)[number];

export type RegrasDeCusto = {
  /** Gramas por milímetro de largura, numa peça (uma aliança, um anel). */
  gramasPorMm: Record<MaterialPorMm, Record<TipoDePeca, number | null>>;
  /** Quanto o modelo pesa em relação à reta (1,33 = 33% mais). Vazio: conta como reta. */
  fatorDoModelo: Record<(typeof MODELOS)[number], number | null>;
  /** Custo de UMA pedra de zircônia, por tamanho. */
  custoDaPedra: Record<TamanhoDePedra, number | null>;
  pedrasMeiaVolta: number | null;
  pedrasVoltaCompleta: number | null;
  /** O anel solitário que vai junto ("+ Anel Solitário Brinde"). */
  brinde: number | null;
  /** A caixinha das alianças, uma por produto de aliança. */
  caixinha: number | null;
  /** Folga sobre o custo estimado, em fração (0,05 = 5%). */
  folga: number | null;
};

const doTipo = (): Record<TipoDePeca, number | null> => ({ alianca: null, anel: null });

export const REGRAS_VAZIAS: RegrasDeCusto = {
  gramasPorMm: { prata_950: doTipo(), ouro_18k: doTipo(), ouro_10k: doTipo() },
  fatorDoModelo: { anatomica: null, chanfrada: null, abaulada: null, fio_de_ouro: null },
  custoDaPedra: { "1,00": null, "1,25": null, "1,50": null },
  pedrasMeiaVolta: null,
  pedrasVoltaCompleta: null,
  brinde: null,
  caixinha: null,
  folga: null,
};

/**
 * Lê as regras do jeito que vierem (do banco ou do formulário) e devolve só o
 * que é número válido. O que não reconhece fica vazio, nunca vira zero.
 */
export function lerRegras(cru: unknown): RegrasDeCusto {
  const o = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
  const num = (v: unknown, max = Infinity): number | null =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max ? v : null;
  const r = o(cru);
  const g = o(r.gramasPorMm);
  const f = o(r.fatorDoModelo);
  const p = o(r.custoDaPedra);
  const folga = num(r.folga, 0.99);
  return {
    gramasPorMm: Object.fromEntries(
      MATERIAIS_POR_MM.map((m) => [m, Object.fromEntries(TIPOS_DE_PECA.map((t) => [t, num(o(g[m])[t], 50) || null]))]),
    ) as RegrasDeCusto["gramasPorMm"],
    fatorDoModelo: Object.fromEntries(MODELOS.map((m) => [m, num(f[m], 10) || null])) as RegrasDeCusto["fatorDoModelo"],
    custoDaPedra: Object.fromEntries(TAMANHOS_DE_PEDRA.map((t) => [t, num(p[t], 10000)])) as RegrasDeCusto["custoDaPedra"],
    pedrasMeiaVolta: num(r.pedrasMeiaVolta, 1000),
    pedrasVoltaCompleta: num(r.pedrasVoltaCompleta, 1000),
    brinde: num(r.brinde, 100000),
    caixinha: num(r.caixinha, 100000),
    folga,
  };
}

/** O que o NOME do produto diz, para a conta das regras. Função pura, com teste. */
export type LeituraDoNome = {
  material: Material | null;
  semijoia: boolean;
  tipo: TipoDePeca | null;
  largura: number | null;
  pecas: 1 | 2;
  modelo: Modelo;
  /** O modelo veio escrito no nome (sem ele, conta como reta e o detalhe não comenta). */
  modeloNoNome: boolean;
  pedras: "meia_volta" | "volta_completa" | null;
  /** "+ Anel Solitário ...": o anel que vai junto do par. */
  comBrinde: boolean;
};

export function lerNome(nome: string): LeituraDoNome {
  const t = ` ${nome.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")} `;
  const semijoia = /banhad|semijoia/.test(t);
  // O que vem depois do primeiro "+" é o que acompanha; o tipo e o modelo saem do que vem antes.
  const mais = t.indexOf("+");
  const antes = mais >= 0 ? t.slice(0, mais) : t;
  const depois = mais >= 0 ? t.slice(mais) : "";
  const tipo: TipoDePeca | null = /alianc/.test(antes) ? "alianca" : /\banel\b|\baneis\b/.test(antes) ? "anel" : null;
  const modelo: Modelo = /fio de ouro/.test(antes)
    ? "fio_de_ouro"
    : /anat/.test(antes)
      ? "anatomica"
      : /chanfrad/.test(antes)
        ? "chanfrada"
        : /abaulad/.test(antes)
          ? "abaulada"
          : "reta";
  const pedras = /volta completa|volta inteira|eternity/.test(antes)
    ? "volta_completa"
    : /meia volta|meia-volta|cravejad|zirconia/.test(antes)
      ? "meia_volta"
      : null;
  return {
    material: materialPeloNome(nome),
    semijoia,
    tipo,
    largura: larguraDoNome(antes),
    pecas: pecasDoNome(nome),
    modelo,
    modeloNoNome: modelo !== "reta" || /\breta\b/.test(antes),
    pedras,
    comBrinde: /\banel\b/.test(depois),
  };
}

/** Os extras que o nome pede, somados ao custo do metal: pedras (estimado), brinde e caixinha (preço da unidade). */
type Extras = { estimado: number; fixo: number; partes: string[]; avisos: string[] };

function extrasDoNome(l: LeituraDoNome, r: RegrasDeCusto): Extras {
  const e: Extras = { estimado: 0, fixo: 0, partes: [], avisos: [] };
  if (l.pedras) {
    const qtd = l.pedras === "volta_completa" ? r.pedrasVoltaCompleta : r.pedrasMeiaVolta;
    // O nome não diz o tamanho da pedra: vale a mais cara que estiver preenchida.
    const custo = TAMANHOS_DE_PEDRA.map((k) => r.custoDaPedra[k]).filter((v): v is number => v !== null);
    const nomeDaVolta = l.pedras === "volta_completa" ? "volta completa" : "meia volta";
    if (qtd && custo.length) {
      const unidade = Math.max(...custo);
      e.estimado += qtd * unidade;
      e.partes.push(`${qtd} pedras da ${nomeDaVolta} x ${reais(unidade)}${l.pecas === 2 ? " (numa peça do par)" : ""}`);
    } else {
      e.avisos.push(`pedras da ${nomeDaVolta} sem ${qtd ? "custo da pedra" : "quantidade"} nas regras, não entraram`);
    }
  }
  if (l.comBrinde) {
    if (r.brinde !== null) {
      e.fixo += r.brinde;
      e.partes.push(`${reais(r.brinde)} do anel de brinde`);
    } else e.avisos.push("anel de brinde sem valor nas regras, não entrou");
  }
  if (l.tipo === "alianca") {
    if (r.caixinha !== null) {
      e.fixo += r.caixinha;
      e.partes.push(`${reais(r.caixinha)} da caixinha`);
    } else e.avisos.push("caixinha sem valor nas regras, não entrou");
  }
  return e;
}

/** Por que um produto ficou sem custo. É o que a cobertura agrupa. */
export type MotivoDaFalta =
  | "semijoia"
  | "sem_material"
  | "prata_com_ouro"
  | "nao_e_alianca_nem_anel"
  | "sem_largura"
  | "falta_gramas_por_mm"
  | "falta_preco_do_grama";

export const ROTULO_DO_MOTIVO: Record<MotivoDaFalta, string> = {
  semijoia: "Semijoia: a JK ainda não passou o custo",
  sem_material: "O nome não diz o material (caixinha, conjunto, personalizado)",
  prata_com_ouro: "Prata com ouro: falta quanto ouro vai em cada peça",
  nao_e_alianca_nem_anel: "Não é aliança nem anel (corrente, brinco, conjunto)",
  sem_largura: "Sem largura em mm no nome",
  falta_gramas_por_mm: "Falta as gramas por mm nas regras",
  falta_preco_do_grama: "Falta o preço do grama",
};

/** De onde veio o custo: custo fixo do produto, peso gravado (produto ou família) ou as regras. */
export type OrigemDoCusto = "fixo" | "gravado" | "regras";

const falta = (motivo: MotivoDaFalta, texto: string): Custo => ({ valor: null, detalhe: null, falta: texto, motivo });

/** Junta o metal, os extras e a folga num custo só, com o detalhe por extenso. */
function montarCusto(
  metal: { valor: number; texto: string; estimado: boolean },
  outros: { resto: number | null; extras: Extras | null },
  folga: number | null,
  origem: OrigemDoCusto,
): Custo {
  const ex = outros.extras;
  const estimado = (metal.estimado ? metal.valor : 0) + (ex?.estimado ?? 0);
  const valorDaFolga = folga && estimado > 0 ? estimado * folga : 0;
  const valor = centavos(metal.valor + n(outros.resto) + (ex ? ex.estimado + ex.fixo : 0) + valorDaFolga);
  const partes = [metal.texto, outros.resto !== null ? `${reais(outros.resto)} de resto` : null, ...(ex?.partes ?? [])].filter(Boolean);
  if (valorDaFolga > 0) partes.push(`${porcento(folga!, 0)} de folga sobre o estimado (${reais(centavos(valorDaFolga))})`);
  const avisos = ex?.avisos.length ? `. Atenção: ${ex.avisos.join("; ")}` : "";
  return { valor, detalhe: `${partes.join(" + ")}${avisos}`, falta: null, origem };
}

/** As gramas por mm que valem para o material e o tipo. Na prata, o número antigo (um só) serve de reserva. */
function gramasPorMmDe(material: MaterialPorMm, tipo: TipoDePeca, p: Parametros): number | null {
  const r = p.regras ?? REGRAS_VAZIAS;
  return r.gramasPorMm[material][tipo] ?? (material === "prata_950" ? p.prataGramasPorMm : null);
}

/** O metal pelas regras: largura x gramas por mm x fator do modelo x peças. */
function metalPelasRegras(
  material: MaterialPorMm,
  l: LeituraDoNome,
  p: Parametros,
): { ok: true; gramas: number; texto: string } | { ok: false; custo: Custo } {
  const nomeDoMaterial = ROTULO_DO_MATERIAL[material].toLowerCase();
  if (!l.tipo) return { ok: false, custo: falta("nao_e_alianca_nem_anel", "Não é aliança nem anel: informe o peso ou o custo da peça") };
  if (l.largura === null) return { ok: false, custo: falta("sem_largura", "Sem largura no nome: informe o peso ou o custo da peça") };
  const gmm = gramasPorMmDe(material, l.tipo, p);
  if (!gmm) {
    return { ok: false, custo: falta("falta_gramas_por_mm", `Falta as gramas por mm ${l.tipo === "alianca" ? "da aliança" : "do anel"} de ${nomeDoMaterial}`) };
  }
  const r = p.regras ?? REGRAS_VAZIAS;
  const fator = l.modelo === "reta" ? 1 : (r.fatorDoModelo[l.modelo] ?? 1);
  const gramas = Math.round(l.largura * gmm * fator * l.pecas * 1000) / 1000;
  const modelo =
    l.modelo === "reta"
      ? ""
      : r.fatorDoModelo[l.modelo] !== null
        ? ` x ${numTexto(fator, 3)} (${ROTULO_DO_MODELO[l.modelo].toLowerCase()})`
        : `, ${ROTULO_DO_MODELO[l.modelo].toLowerCase()} sem fator nas regras: conta como reta`;
  const texto = `${l.pecas === 2 ? "2 peças x " : ""}${mmTexto(l.largura)} x ${numTexto(gmm)} g/mm${modelo}`;
  return { ok: true, gramas, texto };
}

/**
 * O custo de um produto. `nome` é o do catálogo: com ele, o produto sem linha
 * de custo (ou de ouro sem peso) sai calculado pelas regras.
 */
export function custoDoProduto(
  c: CustoGravado | null,
  familias: Map<string, Familia>,
  p: Parametros,
  nome: string | null = null,
): Custo {
  if (c?.custoFixo !== null && c?.custoFixo !== undefined) return { valor: c.custoFixo, detalhe: "Custo fixo", falta: null, origem: "fixo" };
  const l = nome ? lerNome(nome) : null;
  const material = c?.material ?? l?.material ?? null;
  if (!material) {
    if (l?.semijoia) return falta("semijoia", "Semijoia: sem custo informado");
    return falta("sem_material", "Sem custo");
  }
  const regras = p.regras ?? REGRAS_VAZIAS;
  const folga = regras.folga;
  const cotacao = cotacaoDo(material, p);
  const nomeDoGrama =
    material === "prata_950" ? "Falta o preço do grama da prata 950" : `Falta o preço do grama do ${material === "ouro_10k" ? "ouro 10k" : "ouro 18k"}`;

  // Peso gravado: do produto, da família ou, na prata, o resto geral.
  const familia = c?.familia ? familias.get(c.familia) : undefined;
  const gramas = c?.gramas ?? (material === "prata_950" ? null : (familia?.gramas ?? null));
  const restoGravado = c?.resto ?? (material === "prata_950" ? null : (familia?.resto ?? null));
  // Os extras do nome só entram quando ninguém escreveu o "resto" da peça (o resto já cobre o que não é metal).
  const extras = l && restoGravado === null ? extrasDoNome(l, regras) : null;
  const restoGeral = material === "prata_950" ? (restoGravado ?? p.prataResto) : restoGravado;

  if (gramas !== null || (material !== "prata_950" && restoGravado !== null)) {
    if (gramas !== null && !cotacao) return falta("falta_preco_do_grama", nomeDoGrama);
    const deOnde = c?.gramas !== null && c?.gramas !== undefined ? "peso do produto" : familia ? `família ${familia.codigo}` : "do produto";
    const metal = gramas !== null ? { valor: gramas * n(cotacao), texto: `${gramasTexto(gramas)} x ${reais(n(cotacao))} (${deOnde})`, estimado: false } : { valor: 0, texto: "", estimado: false };
    return montarCusto(metal, { resto: restoGeral, extras }, folga, "gravado");
  }

  // Sem peso gravado: as regras. Prata com ouro não sai da largura.
  if (material === "prata_com_ouro") {
    return falta("prata_com_ouro", familia ? `Falta o peso da família ${familia.codigo}` : "Prata com ouro: falta o peso");
  }
  if (!l) return falta("sem_largura", c ? "Falta o peso" : "Sem custo");
  const m = metalPelasRegras(material, l, p);
  if (!m.ok) return m.custo;
  if (!cotacao) return falta("falta_preco_do_grama", nomeDoGrama);
  return montarCusto(
    { valor: m.gramas * cotacao, texto: `${gramasTexto(m.gramas)} x ${reais(cotacao)} (${m.texto})`, estimado: true },
    { resto: restoGeral, extras },
    folga,
    "regras",
  );
}

// ------------------------------------------------------------------ cobertura

export type CoberturaDoCusto = {
  total: number;
  /** Produtos e quanto já venderam (a contagem da loja), por origem do custo. */
  porOrigem: Record<OrigemDoCusto, { produtos: number; vendidos: number }>;
  semCusto: { produtos: number; vendidos: number };
  /** Os motivos de quem ficou sem custo, do que mais vende para o que menos vende. */
  faltas: { motivo: MotivoDaFalta; rotulo: string; produtos: number; vendidos: number; exemplos: string[] }[];
};

/** Quantos produtos o painel calcula sozinho, quantos têm valor gravado e quantos ficam de fora, e por quê. */
export function coberturaDoCusto(itens: { nome: string; vendidos: number; custo: Custo }[]): CoberturaDoCusto {
  const porOrigem: CoberturaDoCusto["porOrigem"] = { fixo: { produtos: 0, vendidos: 0 }, gravado: { produtos: 0, vendidos: 0 }, regras: { produtos: 0, vendidos: 0 } };
  const semCusto = { produtos: 0, vendidos: 0 };
  const faltas = new Map<MotivoDaFalta, { produtos: number; vendidos: number; exemplos: { nome: string; vendidos: number }[] }>();
  for (const i of itens) {
    const v = Math.max(0, i.vendidos || 0);
    if (i.custo.valor !== null) {
      const o = porOrigem[i.custo.origem ?? "gravado"];
      o.produtos++;
      o.vendidos += v;
      continue;
    }
    semCusto.produtos++;
    semCusto.vendidos += v;
    const motivo = i.custo.motivo ?? "sem_material";
    const f = faltas.get(motivo) ?? { produtos: 0, vendidos: 0, exemplos: [] };
    f.produtos++;
    f.vendidos += v;
    f.exemplos.push({ nome: i.nome, vendidos: v });
    faltas.set(motivo, f);
  }
  return {
    total: itens.length,
    porOrigem,
    semCusto,
    faltas: [...faltas.entries()]
      .map(([motivo, f]) => ({
        motivo,
        rotulo: ROTULO_DO_MOTIVO[motivo],
        produtos: f.produtos,
        vendidos: f.vendidos,
        exemplos: f.exemplos.sort((a, b) => b.vendidos - a.vendidos).slice(0, 3).map((e) => e.nome),
      }))
      .sort((a, b) => b.vendidos - a.vendidos || b.produtos - a.produtos),
  };
}

/**
 * As gramas por mm que os pesos JÁ GRAVADOS dão (a planilha do Carlos), por
 * material e modelo: a mediana de gramas / (largura x peças). É referência para
 * a tela, não entra na conta sozinha.
 */
export function gramasPorMmMedidas(
  itens: { nome: string; material: Material | null; gramas: number | null }[],
): { material: MaterialPorMm; modelo: Modelo; mediana: number; produtos: number }[] {
  const grupos = new Map<string, number[]>();
  for (const i of itens) {
    if (i.gramas === null || !i.material || !(MATERIAIS_POR_MM as readonly string[]).includes(i.material)) continue;
    const l = lerNome(i.nome);
    if (l.largura === null || l.tipo !== "alianca") continue;
    const k = `${i.material}|${l.modelo}`;
    grupos.set(k, [...(grupos.get(k) ?? []), i.gramas / (l.largura * l.pecas)]);
  }
  return [...grupos.entries()]
    .filter(([, v]) => v.length >= 5)
    .map(([k, v]) => {
      const [material, modelo] = k.split("|") as [MaterialPorMm, Modelo];
      const o = [...v].sort((a, b) => a - b);
      const meio = Math.floor(o.length / 2);
      const mediana = o.length % 2 ? o[meio] : (o[meio - 1] + o[meio]) / 2;
      return { material, modelo, mediana: Math.round(mediana * 1000) / 1000, produtos: v.length };
    })
    .sort((a, b) => a.material.localeCompare(b.material) || a.modelo.localeCompare(b.modelo));
}

/** De onde veio o valor que a conta usa: o que a diretoria preencheu na Margem, ou a média da lista de Custos. */
export type OrigemDoParametro = "margem" | "custos" | null;

/**
 * Os parâmetros que a conta USA: o que a Margem tem preenchido vence, e o vazio
 * cai na média da lista de Custos (cartão 81). Só imposto, frete e embalagem têm
 * média; o resto (preço do grama, margem mínima) é decisão de gente.
 *
 * O frete da média é o que fica com a JK por venda, já descontado o que o cliente
 * paga: é o que o preço do PRODUTO precisa cobrir, que é o que a margem por
 * produto conta.
 */
export function parametrosComMedias(
  p: Parametros,
  m: { imposto: number | null; frete: number | null; embalagem: number | null } | null,
): { efetivos: Parametros; origens: Record<"imposto" | "frete" | "embalagem", OrigemDoParametro> } {
  const escolhe = (propria: number | null, media: number | null | undefined): [number | null, OrigemDoParametro] =>
    propria !== null ? [propria, "margem"] : media !== null && media !== undefined ? [media, "custos"] : [null, null];
  const [imposto, oImposto] = escolhe(p.imposto, m?.imposto);
  const [frete, oFrete] = escolhe(p.frete, m?.frete);
  const [embalagem, oEmbalagem] = escolhe(p.embalagem, m?.embalagem);
  return { efetivos: { ...p, imposto, frete, embalagem }, origens: { imposto: oImposto, frete: oFrete, embalagem: oEmbalagem } };
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
