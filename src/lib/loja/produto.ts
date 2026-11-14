/**
 * O que dá para mudar num produto da loja pelo painel, e as regras de cada campo.
 *
 * A Tray continua sendo a fonte de verdade: o estado "atual" que entra aqui é
 * sempre o que acabou de ser lido da API, nunca o espelho do banco. É contra
 * ele que a pessoa confere o "antes e depois" e é dele que sai o registro.
 *
 * PREÇO É MAIS FECHADO. Mudar preço, promoção ou datas pede `podePreco`
 * (administrador, dono e GM). Sem essa trava, editar o produto passaria por
 * cima da aprovação de campanha, que existe justamente para desconto.
 *
 * Arquivo puro, para o teste rodar sem rede.
 */

export type EstadoNaLoja = {
  nome: string;
  preco: number;
  /** `null` quando o produto não tem preço promocional. */
  promocional: number | null;
  promocaoDe: string | null;
  promocaoAte: string | null;
  estoque: number;
  disponivel: boolean;
};

export type Edicao = Partial<EstadoNaLoja>;
export type Campo = keyof EstadoNaLoja;
export type Mudanca = { campo: Campo; rotulo: string; antes: string; depois: string };

export const ROTULO_DO_CAMPO: Record<Campo, string> = {
  nome: "Nome",
  preco: "Preço",
  promocional: "Preço promocional",
  promocaoDe: "Promoção começa em",
  promocaoAte: "Promoção termina em",
  estoque: "Estoque",
  disponivel: "Disponível para venda",
};

const DE_PRECO: Campo[] = ["preco", "promocional", "promocaoDe", "promocaoAte"];

const reais = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const centavos = (n: number) => Math.round(n * 100) / 100;

const numero = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/** `AAAA-MM-DD` válido, ou `null`. A Tray escreve "0000-00-00" quando não há data. */
export function diaOuNulo(v: unknown): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v ?? "").trim());
  if (!m || m[1] === "0000") return null;
  const d = new Date(`${m[0]}T12:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== m[0] ? null : m[0];
}

const diaPorExtenso = (d: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : "sem data");

export function emPalavra(campo: Campo, v: EstadoNaLoja[Campo]): string {
  if (campo === "nome") return String(v);
  if (campo === "preco") return reais(v as number);
  if (campo === "promocional") return v === null ? "sem promoção" : reais(v as number);
  if (campo === "promocaoDe" || campo === "promocaoAte") return diaPorExtenso(v as string | null);
  if (campo === "estoque") return String(v);
  return v ? "sim" : "não";
}

/** O produto como a API da Tray devolve (`GET /products/:id`), no formato do painel. `null` se não der para ler. */
export function lerEstado(cru: Record<string, unknown> | null | undefined): EstadoNaLoja | null {
  if (!cru) return null;
  const preco = numero(cru.price);
  const nome = String(cru.name ?? "").trim();
  if (preco === null || !nome) return null;
  const promo = numero(cru.promotional_price);
  return {
    nome,
    preco: centavos(preco),
    promocional: promo && promo > 0 ? centavos(promo) : null,
    promocaoDe: diaOuNulo(cru.start_promotion),
    promocaoAte: diaOuNulo(cru.end_promotion),
    estoque: Math.max(0, Math.trunc(numero(cru.stock) ?? 0)),
    disponivel: String(cru.available ?? "0") === "1",
  };
}

export type Preparo =
  | { ok: true; mudancas: Mudanca[]; avisos: string[]; corpo: Record<string, string | number>; final: EstadoNaLoja }
  | { ok: false; erro: string };

/**
 * Confere a edição contra o estado atual e monta o que vai para a Tray.
 * Campo igual ao atual não entra: a Tray só recebe o que muda.
 */
export function prepararEdicao(atual: EstadoNaLoja, edicao: Edicao, opcoes: { podePreco: boolean }): Preparo {
  const final: EstadoNaLoja = { ...atual };
  const pedidos = (Object.keys(edicao) as Campo[]).filter((c) => edicao[c] !== undefined);

  for (const campo of pedidos) {
    const v = edicao[campo];
    if (campo === "nome") {
      const nome = String(v ?? "").replace(/\s+/g, " ").trim();
      if (nome.length < 3 || nome.length > 200) return { ok: false, erro: "O nome precisa ter entre 3 e 200 letras." };
      final.nome = nome;
    } else if (campo === "preco") {
      const n = numero(v);
      if (n === null || n <= 0 || n > 1_000_000) return { ok: false, erro: "O preço precisa ser maior que zero." };
      final.preco = centavos(n);
    } else if (campo === "promocional") {
      if (v === null || v === "" || numero(v) === 0) final.promocional = null;
      else {
        const n = numero(v);
        if (n === null || n < 0 || n > 1_000_000) return { ok: false, erro: "O preço promocional não é um valor válido." };
        final.promocional = centavos(n);
      }
    } else if (campo === "promocaoDe" || campo === "promocaoAte") {
      if (v === null || v === "") final[campo] = null;
      else {
        const d = diaOuNulo(v);
        if (!d) return { ok: false, erro: "A data da promoção precisa ser um dia válido." };
        final[campo] = d;
      }
    } else if (campo === "estoque") {
      const n = numero(v);
      if (n === null || !Number.isInteger(n) || n < 0 || n > 99_999) return { ok: false, erro: "O estoque precisa ser um número inteiro, de 0 a 99.999." };
      final.estoque = n;
    } else if (campo === "disponivel") {
      final.disponivel = Boolean(v);
    }
  }

  // Tirar a promoção leva as datas junto: data de promoção sem preço não quer dizer nada.
  if (final.promocional === null) {
    final.promocaoDe = null;
    final.promocaoAte = null;
  } else {
    if (final.promocional >= final.preco) return { ok: false, erro: "O preço promocional precisa ser menor que o preço." };
    if (!final.promocaoDe || !final.promocaoAte) return { ok: false, erro: "Promoção precisa de dia de começo e de fim." };
    if (final.promocaoDe > final.promocaoAte) return { ok: false, erro: "A promoção termina antes de começar." };
  }

  const mudou = (Object.keys(ROTULO_DO_CAMPO) as Campo[]).filter((c) => final[c] !== atual[c]);
  if (!opcoes.podePreco && mudou.some((c) => DE_PRECO.includes(c))) {
    return { ok: false, erro: "Só administrador, dono ou GM muda preço e promoção." };
  }

  const mudancas = mudou.map((campo) => ({ campo, rotulo: ROTULO_DO_CAMPO[campo], antes: emPalavra(campo, atual[campo]), depois: emPalavra(campo, final[campo]) }));

  const avisos: string[] = [];
  if (mudou.includes("preco") && atual.preco > 0) {
    const variacao = (final.preco - atual.preco) / atual.preco;
    if (Math.abs(variacao) >= 0.3) avisos.push(`O preço ${variacao > 0 ? "sobe" : "cai"} ${Math.round(Math.abs(variacao) * 100)}%. Confira se não sobrou ou faltou um zero.`);
  }
  if (final.promocional !== null && (mudou.includes("promocional") || mudou.includes("preco"))) {
    const desconto = 1 - final.promocional / final.preco;
    if (desconto >= 0.5) avisos.push(`O desconto fica em ${Math.round(desconto * 100)}%.`);
  }
  if (mudou.includes("disponivel") && !final.disponivel) avisos.push("O produto sai da vitrine da loja e do site de dicas.");
  if (final.disponivel && final.estoque === 0 && (mudou.includes("estoque") || mudou.includes("disponivel"))) {
    avisos.push("O produto fica disponível com estoque zero.");
  }

  const corpo: Record<string, string | number> = {};
  for (const campo of mudou) {
    if (campo === "nome") corpo.name = final.nome;
    else if (campo === "preco") corpo.price = final.preco.toFixed(2);
    else if (campo === "promocional") corpo.promotional_price = (final.promocional ?? 0).toFixed(2);
    else if (campo === "promocaoDe") corpo.start_promotion = final.promocaoDe ?? "";
    else if (campo === "promocaoAte") corpo.end_promotion = final.promocaoAte ?? "";
    else if (campo === "estoque") corpo.stock = final.estoque;
    else if (campo === "disponivel") corpo.available = final.disponivel ? 1 : 0;
  }
  return { ok: true, mudancas, avisos, corpo, final };
}

/** Os campos pedidos que NÃO ficaram como pedido, depois de a Tray responder que gravou. */
export function naoPegaram(pedido: EstadoNaLoja, lido: EstadoNaLoja, campos: Campo[]): Campo[] {
  return campos.filter((c) => pedido[c] !== lido[c]);
}
