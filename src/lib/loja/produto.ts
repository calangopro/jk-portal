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
 * O QUE A TRAY FAZ, MEDIDO NA LOJA DE TESTES EM 18/11/2026 (produto 93525),
 * porque a documentação não conta:
 *   - `title` é o título que vai para o Google, e ela copia sozinha para a
 *     metatag de título.
 *   - A descrição curta (`description_small`) e a metatag de descrição são O
 *     MESMO CAMPO com dois nomes: gravar qualquer um muda o outro, nos dois
 *     sentidos, e o último a ser gravado vence. Por isso a tela tem um campo só
 *     ("Descrição curta", que é também a do Google) e a metatag de descrição
 *     nunca é mandada.
 *   - A metatag de palavras-chave vai no mesmo envio, só com o tipo
 *     `keywords`; os outros tipos ficam como estão. Texto vazio apaga.
 *   - Peso é em gramas INTEIRAS e maior que zero ("2.5" e "0" são recusados).
 *     Medida com casa decimal é arredondada para centímetro inteiro, calada.
 *   - Vídeo vazio é IGNORADO; o que apaga é um espaço. Os outros textos apagam
 *     com vazio.
 *   - `free_shipping` responde "Saved" e não muda: fica fora daqui.
 *   - Categoria principal inexistente é recusada; categoria relacionada
 *     inexistente é descartada calada (a releitura pega).
 *   - Texto volta exatamente como foi, com acento e com HTML.
 *
 * O endereço do produto (`slug`) fica de fora de propósito: trocar o endereço
 * de uma página que já tem histórico de busca derruba a posição dela no Google.
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
  // Google e SEO
  titulo: string;
  palavrasChave: string;
  // Textos da página
  /** A descrição curta. Na Tray é também a metatag de descrição (ver o topo). */
  resumo: string;
  descricao: string;
  itensInclusos: string;
  mensagemAdicional: string;
  // Catálogo
  categoria: string | null;
  /** Categorias em que o produto também aparece, ids da Tray em ordem crescente. */
  outrasCategorias: string[];
  marca: string;
  modelo: string;
  referencia: string;
  // Envio e prazo
  peso: number | null;
  comprimento: number | null;
  largura: number | null;
  altura: number | null;
  prazo: string;
  prazoDias: number | null;
  estoqueMinimo: number;
  // Outros
  garantia: string;
  video: string;
  ean: string;
  ncm: string;
  destaque: boolean;
  lancamento: boolean;
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
  titulo: "Título no Google",
  palavrasChave: "Palavras-chave",
  resumo: "Descrição curta e no Google",
  descricao: "Descrição da página",
  itensInclusos: "Itens inclusos",
  mensagemAdicional: "Mensagem adicional",
  categoria: "Categoria principal",
  outrasCategorias: "Outras categorias",
  marca: "Marca",
  modelo: "Modelo",
  referencia: "Referência",
  peso: "Peso (g)",
  comprimento: "Comprimento (cm)",
  largura: "Largura (cm)",
  altura: "Altura (cm)",
  prazo: "Texto do prazo",
  prazoDias: "Prazo em dias",
  estoqueMinimo: "Estoque mínimo",
  garantia: "Garantia",
  video: "Vídeo",
  ean: "EAN",
  ncm: "NCM",
  destaque: "Destaque",
  lancamento: "Lançamento",
};

/** Os campos de texto, com o maior tamanho aceito. Os longos guardam quebra de linha e HTML. */
const TEXTO_CURTO: Partial<Record<Campo, number>> = {
  titulo: 255, palavrasChave: 1000, resumo: 1000, marca: 120, modelo: 120, referencia: 60, prazo: 200, garantia: 200, video: 500, ean: 20, ncm: 20,
};
const TEXTO_LONGO: Partial<Record<Campo, number>> = { descricao: 200_000, itensInclusos: 5000, mensagemAdicional: 2000 };
const MEDIDAS: Campo[] = ["comprimento", "largura", "altura"];

const DE_PRECO: Campo[] = ["preco", "promocional", "promocaoDe", "promocaoAte"];
const CAMPOS = Object.keys(ROTULO_DO_CAMPO) as Campo[];

/** Para onde cada campo vai no corpo do PUT. Palavras-chave, vídeo e NCM têm tratamento próprio. */
const NA_TRAY: Partial<Record<Campo, string>> = {
  nome: "name", estoque: "stock", titulo: "title", resumo: "description_small", descricao: "description", itensInclusos: "included_items",
  mensagemAdicional: "additional_message", categoria: "category_id", outrasCategorias: "related_categories", marca: "brand", modelo: "model",
  referencia: "reference", peso: "weight", comprimento: "length", largura: "width", altura: "height", prazo: "availability",
  prazoDias: "availability_days", estoqueMinimo: "minimum_stock", garantia: "warranty", video: "video", ean: "ean", ncm: "ncm",
  destaque: "hot", lancamento: "release", disponivel: "available",
};

const reais = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const centavos = (n: number) => Math.round(n * 100) / 100;

const numero = (v: unknown): number | null => {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/** Texto de uma linha: sem espaço sobrando. */
const linha = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim();
/** Texto longo: guarda as quebras, tira só o espaço das pontas e o `\r`. */
const bloco = (v: unknown) => String(v ?? "").replace(/\r\n?/g, "\n").trim();
const umOuZero = (v: unknown) => String(v ?? "0") === "1";
const idDeCategoria = (v: unknown) => {
  const s = String(v ?? "").trim();
  return /^\d{1,12}$/.test(s) && s !== "0" ? s : null;
};
const listaDeCategorias = (v: unknown): string[] =>
  [...new Set((Array.isArray(v) ? v : []).map(idDeCategoria).filter((c): c is string => c !== null))].sort((a, b) => Number(a) - Number(b));

/** `AAAA-MM-DD` válido, ou `null`. A Tray escreve "0000-00-00" quando não há data. */
export function diaOuNulo(v: unknown): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v ?? "").trim());
  if (!m || m[1] === "0000") return null;
  const d = new Date(`${m[0]}T12:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== m[0] ? null : m[0];
}

const diaPorExtenso = (d: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : "sem data");

/** O começo do texto, sem as marcas de HTML, para o "antes e depois" de um texto longo. */
function resumoDeTexto(t: string): string {
  if (!t) return "vazio";
  const solto = t.replace(/<\/?(strong|b|em|i|u|span|a|small|sup|sub)\b[^>]*>/gi, "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&[a-z]+;/gi, (e) => ENTIDADES[e.toLowerCase()] ?? e).replace(/\s+/g, " ").trim();
  const inicio = solto.length > 90 ? `${solto.slice(0, 90).trimEnd()}…` : solto;
  return `${t.length.toLocaleString("pt-BR")} caracteres: "${inicio}"`;
}
const ENTIDADES: Record<string, string> = {
  "&amp;": "&", "&ccedil;": "ç", "&atilde;": "ã", "&otilde;": "õ", "&aacute;": "á", "&eacute;": "é", "&iacute;": "í", "&oacute;": "ó", "&uacute;": "ú",
  "&acirc;": "â", "&ecirc;": "ê", "&ocirc;": "ô", "&agrave;": "à", "&quot;": '"', "&lt;": "<", "&gt;": ">",
};

export function emPalavra(campo: Campo, v: EstadoNaLoja[Campo]): string {
  if (campo === "preco") return reais(v as number);
  if (campo === "promocional") return v === null ? "sem promoção" : reais(v as number);
  if (campo === "promocaoDe" || campo === "promocaoAte") return diaPorExtenso(v as string | null);
  if (typeof v === "boolean") return v ? "sim" : "não";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "nenhuma";
  if (v === null || v === undefined) return "vazio";
  if (typeof v === "number") return v.toLocaleString("pt-BR");
  if (campo in TEXTO_LONGO) return resumoDeTexto(String(v));
  return String(v) === "" ? "vazio" : String(v);
}

/** O produto como a API da Tray devolve (`GET /products/:id`), no formato do painel. `null` se não der para ler. */
export function lerEstado(cru: Record<string, unknown> | null | undefined): EstadoNaLoja | null {
  if (!cru) return null;
  const preco = numero(cru.price);
  const nome = linha(cru.name);
  if (preco === null || !nome) return null;
  const promo = numero(cru.promotional_price);
  const metatags = Array.isArray(cru.metatag) ? (cru.metatag as { type?: unknown; content?: unknown }[]) : [];
  const meta = (tipo: string) => linha(metatags.find((m) => m?.type === tipo)?.content);
  const inteiroOuNulo = (v: unknown) => {
    const n = numero(v);
    return n === null || n <= 0 ? null : Math.round(n);
  };
  return {
    nome,
    preco: centavos(preco),
    promocional: promo && promo > 0 ? centavos(promo) : null,
    promocaoDe: diaOuNulo(cru.start_promotion),
    promocaoAte: diaOuNulo(cru.end_promotion),
    estoque: Math.max(0, Math.trunc(numero(cru.stock) ?? 0)),
    disponivel: String(cru.available ?? "0") === "1",
    titulo: linha(cru.title),
    palavrasChave: meta("keywords"),
    resumo: linha(cru.description_small),
    descricao: bloco(cru.description),
    itensInclusos: bloco(cru.included_items),
    mensagemAdicional: bloco(cru.additional_message),
    categoria: idDeCategoria(cru.category_id),
    outrasCategorias: listaDeCategorias(cru.related_categories),
    marca: linha(cru.brand),
    modelo: linha(cru.model),
    referencia: linha(cru.reference),
    peso: inteiroOuNulo(cru.weight),
    comprimento: inteiroOuNulo(cru.length),
    largura: inteiroOuNulo(cru.width),
    altura: inteiroOuNulo(cru.height),
    prazo: linha(cru.availability),
    prazoDias: numero(cru.availability_days) === null ? null : Math.max(0, Math.trunc(numero(cru.availability_days)!)),
    estoqueMinimo: Math.max(0, Math.trunc(numero(cru.minimum_stock) ?? 0)),
    garantia: linha(cru.warranty),
    video: linha(cru.video),
    ean: linha(cru.ean),
    ncm: linha(cru.ncm),
    destaque: umOuZero(cru.hot),
    lancamento: umOuZero(cru.release),
  };
}

/** Igualdade de valor de campo (as listas de categoria são comparadas pelo conteúdo). */
export function igual(a: EstadoNaLoja[Campo], b: EstadoNaLoja[Campo]): boolean {
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => x === b[i]);
  return a === b;
}

export type Preparo =
  | {
      ok: true;
      mudancas: Mudanca[];
      avisos: string[];
      /** O corpo do PUT. */
      corpo: Record<string, string | number | string[] | { type: string; content: string }[]>;
      final: EstadoNaLoja;
    }
  | { ok: false; erro: string };

const travessao = /[—–]/;

/**
 * Confere a edição contra o estado atual e monta o que vai para a Tray.
 * Campo igual ao atual não entra: a Tray só recebe o que muda.
 */
export function prepararEdicao(atual: EstadoNaLoja, edicao: Edicao, opcoes: { podePreco: boolean }): Preparo {
  const final: EstadoNaLoja = { ...atual, outrasCategorias: [...atual.outrasCategorias] };
  const por = final as Record<Campo, unknown>;
  const pedidos = (Object.keys(edicao) as Campo[]).filter((c) => CAMPOS.includes(c) && edicao[c] !== undefined);
  const falha = (erro: string) => ({ ok: false as const, erro });

  for (const campo of pedidos) {
    const v = edicao[campo];
    const curto = TEXTO_CURTO[campo];
    const longo = TEXTO_LONGO[campo];
    // Número que pode faltar: vazio é "sem valor", e a recusa (se mudou) vem depois.
    const podeFaltar = campo === "peso" || campo === "prazoDias" || campo === "categoria" || MEDIDAS.includes(campo);
    if (podeFaltar && (v === null || String(v).trim() === "")) {
      por[campo] = null;
      continue;
    }
    if (campo === "nome") {
      const nome = linha(v);
      if (nome.length < 3 || nome.length > 200) return falha("O nome precisa ter entre 3 e 200 letras.");
      final.nome = nome;
    } else if (campo === "preco") {
      const n = numero(v);
      if (n === null || n <= 0 || n > 1_000_000) return falha("O preço precisa ser maior que zero.");
      final.preco = centavos(n);
    } else if (campo === "promocional") {
      if (v === null || v === "" || numero(v) === 0) final.promocional = null;
      else {
        const n = numero(v);
        if (n === null || n < 0 || n > 1_000_000) return falha("O preço promocional não é um valor válido.");
        final.promocional = centavos(n);
      }
    } else if (campo === "promocaoDe" || campo === "promocaoAte") {
      if (v === null || v === "") final[campo] = null;
      else {
        const d = diaOuNulo(v);
        if (!d) return falha("A data da promoção precisa ser um dia válido.");
        final[campo] = d;
      }
    } else if (campo === "estoque" || campo === "estoqueMinimo") {
      const n = numero(v);
      if (n === null || !Number.isInteger(n) || n < 0 || n > 99_999) return falha(`${ROTULO_DO_CAMPO[campo]} precisa ser um número inteiro, de 0 a 99.999.`);
      final[campo] = n;
    } else if (campo === "disponivel" || campo === "destaque" || campo === "lancamento") {
      final[campo] = Boolean(v);
    } else if (curto !== undefined) {
      const t = linha(v);
      if (t.length > curto && t !== atual[campo]) return falha(`${ROTULO_DO_CAMPO[campo]} passa de ${curto.toLocaleString("pt-BR")} letras.`);
      por[campo] = t;
    } else if (longo !== undefined) {
      const t = bloco(v);
      if (t.length > longo && t !== atual[campo]) return falha(`${ROTULO_DO_CAMPO[campo]} passa de ${longo.toLocaleString("pt-BR")} caracteres.`);
      por[campo] = t;
    } else if (campo === "peso") {
      const n = numero(v);
      if (n === null || !Number.isInteger(n) || n < 1 || n > 1_000_000) return falha("O peso precisa ser em gramas inteiras, maior que zero (a Tray recusa zero e casa decimal).");
      final.peso = n;
    } else if (MEDIDAS.includes(campo)) {
      const n = numero(v);
      if (n === null || !Number.isInteger(n) || n < 1 || n > 10_000) return falha(`${ROTULO_DO_CAMPO[campo]} precisa ser em centímetros inteiros, maior que zero (a Tray arredonda casa decimal sem avisar).`);
      por[campo] = n;
    } else if (campo === "prazoDias") {
      const n = numero(v);
      if (n === null || !Number.isInteger(n) || n < 0 || n > 365) return falha("O prazo em dias precisa ser um número inteiro, de 0 a 365.");
      final.prazoDias = n;
    } else if (campo === "categoria") {
      const id = idDeCategoria(v);
      if (!id) return falha("Escolha a categoria principal.");
      final.categoria = id;
    } else if (campo === "outrasCategorias") {
      if (!Array.isArray(v) || v.some((c) => idDeCategoria(c) === null)) return falha("As outras categorias precisam ser categorias da loja.");
      final.outrasCategorias = listaDeCategorias(v);
    }
  }

  // Tirar a promoção leva as datas junto: data de promoção sem preço não quer dizer nada.
  if (final.promocional === null) {
    final.promocaoDe = null;
    final.promocaoAte = null;
  } else {
    if (final.promocional >= final.preco) return falha("O preço promocional precisa ser menor que o preço.");
    if (!final.promocaoDe || !final.promocaoAte) return falha("Promoção precisa de dia de começo e de fim.");
    if (final.promocaoDe > final.promocaoAte) return falha("A promoção termina antes de começar.");
  }
  // Formato só se confere no que a pessoa mudou: valor antigo esquisito na loja não trava o resto da edição.
  if (final.video !== atual.video && final.video && !/^https:\/\/\S+$/.test(final.video)) return falha("O vídeo precisa ser um endereço que começa com https://.");
  if (final.ean !== atual.ean && final.ean && !/^\d{8}$|^\d{12,14}$/.test(final.ean)) return falha("O EAN tem 8, 12, 13 ou 14 números, sem espaço.");
  if (final.ncm !== atual.ncm && final.ncm && !/^\d{8}$/.test(final.ncm.replace(/\./g, ""))) return falha("O NCM tem 8 números.");

  const mudou = CAMPOS.filter((c) => !igual(final[c], atual[c]));
  if (!opcoes.podePreco && mudou.some((c) => DE_PRECO.includes(c))) return falha("Só administrador, dono ou GM muda preço e promoção.");
  // Campo que estava vazio na loja e continua sem valor não tem como ser "apagado" pela Tray.
  for (const c of ["peso", ...MEDIDAS, "prazoDias", "categoria"] as Campo[]) {
    if (mudou.includes(c) && final[c] === null) return falha(`${ROTULO_DO_CAMPO[c]} não pode ficar vazio.`);
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
  avisos.push(...avisosDeSeo(atual, final, mudou));

  const corpo: Record<string, string | number | string[] | { type: string; content: string }[]> = {};
  for (const campo of mudou) {
    if (campo === "preco") corpo.price = final.preco.toFixed(2);
    else if (campo === "promocional") corpo.promotional_price = (final.promocional ?? 0).toFixed(2);
    else if (campo === "promocaoDe") corpo.start_promotion = final.promocaoDe ?? "";
    else if (campo === "promocaoAte") corpo.end_promotion = final.promocaoAte ?? "";
    else if (campo === "video") corpo.video = final.video || " ";
    else if (campo === "ncm") corpo.ncm = final.ncm.replace(/\./g, "");
    else if (campo === "palavrasChave") corpo.metatag = [{ type: "keywords", content: final.palavrasChave }];
    else if (NA_TRAY[campo]) {
      const v = final[campo];
      corpo[NA_TRAY[campo]!] = typeof v === "boolean" ? (v ? 1 : 0) : Array.isArray(v) ? v : typeof v === "number" ? (campo === "estoque" ? v : String(v)) : String(v ?? "");
    }
  }

  return { ok: true, mudancas, avisos, corpo, final };
}

/** O que o Google e as regras da casa pedem, só sobre o que mudou. */
function avisosDeSeo(atual: EstadoNaLoja, final: EstadoNaLoja, mudou: Campo[]): string[] {
  const avisos: string[] = [];
  if (mudou.includes("titulo")) {
    if (!final.titulo) avisos.push("Sem título próprio, a loja usa o nome do produto no Google.");
    else if (final.titulo.length > 65) avisos.push(`O título no Google tem ${final.titulo.length} letras; passando de 65, o Google costuma cortar.`);
  }
  if (mudou.includes("resumo")) {
    if (!final.resumo) avisos.push("Sem descrição curta, o Google escolhe sozinho um trecho da página.");
    else if (final.resumo.length > 160) avisos.push(`A descrição curta tem ${final.resumo.length} letras; passando de 160, o Google costuma cortar.`);
    else if (final.resumo.length < 70) avisos.push(`A descrição curta tem só ${final.resumo.length} letras; com menos de 70, o Google costuma escrever outra no lugar.`);
  }
  if (mudou.includes("descricao")) {
    if (!final.descricao) avisos.push("A página do produto fica sem descrição.");
    else if (atual.descricao.length > 400 && final.descricao.length < atual.descricao.length / 2) {
      avisos.push(`A descrição da página cai de ${atual.descricao.length.toLocaleString("pt-BR")} para ${final.descricao.length.toLocaleString("pt-BR")} caracteres. Confira se nada foi apagado sem querer.`);
    }
    if (/<script\b/i.test(final.descricao)) avisos.push("A descrição tem um <script>. A loja pode rodar esse código na página do produto.");
  }
  if (mudou.includes("categoria") || mudou.includes("outrasCategorias")) {
    const antes = new Set([atual.categoria, ...atual.outrasCategorias].filter(Boolean));
    const depois = new Set([final.categoria, ...final.outrasCategorias].filter(Boolean));
    const saiu = [...antes].filter((c) => !depois.has(c));
    if (saiu.length) avisos.push(`O produto sai ${saiu.length === 1 ? "da categoria" : "das categorias"} ${saiu.join(", ")} da loja.`);
  }
  const comTravessao = mudou.filter((c) => typeof final[c] === "string" && travessao.test(final[c] as string)).map((c) => ROTULO_DO_CAMPO[c].toLowerCase());
  if (comTravessao.length) avisos.push(`Tem travessão em: ${comTravessao.join(", ")}. A regra da casa é trocar por vírgula, ponto ou parênteses.`);
  return avisos;
}

/** Os campos pedidos que NÃO ficaram como pedido, depois de a Tray responder que gravou. */
export function naoPegaram(pedido: EstadoNaLoja, lido: EstadoNaLoja, campos: Campo[]): Campo[] {
  return campos.filter((c) => !igual(pedido[c], lido[c]));
}

/** As causas de uma recusa da Tray, que chegam em lista ou por campo (`{"Product":{"weight":["..."]}}`). */
export function causasDaTray(corpo: unknown): string[] {
  const causas = (corpo as { causes?: unknown } | null)?.causes;
  const saida: string[] = [];
  const andar = (v: unknown) => {
    if (typeof v === "string") saida.push(v);
    else if (Array.isArray(v)) v.forEach(andar);
    else if (v && typeof v === "object") Object.values(v).forEach(andar);
  };
  andar(causas);
  return saida;
}
