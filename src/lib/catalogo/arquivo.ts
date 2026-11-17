/**
 * O arquivo de catálogo do Meta e do Google, montado pelo painel.
 *
 * ## Por que existe
 *
 * Até 01/12/2026 o catálogo "Products for JK Alianças" do Commerce Manager é
 * alimentado por um arquivo que a Tray publica de hora em hora
 * (`/xml/xml.php?Chave=...`). A integração "Facebook e Instagram" da Tray caiu
 * em 15/11 para todas as lojas, e o Filipe decidiu trazer o arquivo para o
 * painel. A troca acontece em 01/12, trocando o endereço na fonte de dados do
 * Commerce Manager (passo a passo em `docs/catalogo-pelo-painel.md`).
 *
 * ## A regra que manda em tudo: o código não muda
 *
 * `g:id` é o `tray_id`, o mesmo `content_id` que o pixel manda. Mudou o
 * código, o anúncio de catálogo perde o histórico e a marcação de produto do
 * Instagram quebra. Por isso este arquivo repete o da Tray campo por campo,
 * inclusive o que parece defeito (o `&gt;` literal no tipo do produto, ver
 * `SEPARADOR_DO_TIPO`), e a conferência (`npm run verificar:catalogo`) compara
 * os dois item a item antes da troca.
 *
 * ## De onde vem cada campo
 *
 * - Preço, promoção e disponibilidade: `products`, a sincronização de quinze
 *   em quinze minutos, com o preço resolvido por `precoVigente` (quem monta o
 *   produto chama, porque módulo puro aqui não importa função de irmão).
 * - Fotos, descrição completa, referência, GTIN, peso e medidas:
 *   `catalogo_detalhes`, lido de `GET /products/{id}` da API da Tray, porque a
 *   busca pública não traz nada disso (traz uma foto só e a descrição curta).
 * - Tipo do produto e quem entra: a árvore de categorias da loja
 *   (`catalogo_categorias`).
 *
 * Puro: sem banco, sem rede e sem `server-only`, para o teste rodar em node.
 */

export type Destino = "meta" | "google";

/**
 * O parâmetro que a Tray e o coletor de origem usam para reconhecer a venda
 * que veio do catálogo: 1516 é o Meta, 1517 é o Google Shopping. Sem ele, a
 * venda do anúncio de catálogo cai em "sem etiqueta".
 */
export const PARCEIRO: Record<Destino, string> = { meta: "1516", google: "1517" };

/** O cabeçalho do arquivo, com o texto que a Tray usa. */
export const CANAL = {
  titulo: "JK Alianças",
  link: "https://www.jkaliancas.com.br",
  descricao:
    "Encontre alianças de namoro, casamento e noivado na JK Alianças. Modelos em ouro e prata, com gravação, personalização e garantia vitalícia do teor dos materiais.",
};

/** A Tray corta a descrição em 5.000 caracteres (medido: três itens com exatamente 5.000). */
export const LIMITE_DA_DESCRICAO = 5000;

/**
 * A Tray manda no máximo três fotos além da principal (medido em 17/11/2026:
 * nenhum item com mais de três `additional_image_link`, e em 292 produtos a
 * loja tem mais fotos que isso). O Meta aceita até vinte; ficar em três deixa
 * a troca de 01/12 sem mudança nenhuma nas fotos. Subir é mudar este número.
 */
export const LIMITE_DE_FOTOS_EXTRAS = 3;

/**
 * O separador do caminho da categoria em `g:product_type`. A Tray escapa duas
 * vezes, e o valor que chega ao Meta é "Anéis &gt; Anéis de Prata", com o
 * `&gt;` escrito por extenso. Fica igual de propósito: conjunto de produtos do
 * Commerce Manager e grupo de produtos do Google podem filtrar pelo tipo, e
 * trocar o texto na virada tiraria produto de conjunto sem ninguém ver. Para
 * corrigir para " > ", primeiro confira os filtros dos conjuntos.
 */
export const SEPARADOR_DO_TIPO = " &gt; ";

// ---------------------------------------------------------------------------
// Quem entra

/**
 * O arquivo da Tray tinha 711 produtos e o painel 953 ativos e disponíveis.
 * Medido em 17/11/2026: a diferença é TODA de categoria. Entram as categorias
 * principais dos ramos abaixo, e nenhuma das outras; nenhum produto ativo e
 * disponível dessas categorias ficou de fora, e nenhum de fora delas entrou.
 *
 * Ramos inteiros: Alianças de Namoro (7), Alianças de Casamento (23) e Anéis
 * (233), cada um com todas as categorias de baixo.
 */
export const RAMOS_QUE_ENTRAM = ["7", "23", "233"];

/**
 * Categorias que entram SEM as de baixo: Joias (11), Joias de Prata (121) e
 * Joias de Ouro 18k (127). As filhas de Joias de Prata (brincos, conjuntos,
 * correntes, gargantilhas, pingentes, pulseiras e tornozeleiras) ficam fora,
 * e Caixinha de Joia (35) também.
 */
export const CATEGORIAS_QUE_ENTRAM_SOZINHAS = ["11", "121", "127"];

/** Dentro de um ramo que entra, o que fica fora: Anéis Semijoias (229). */
export const RAMOS_QUE_FICAM_FORA = ["229"];

export type Categoria = { id: string; nome: string; pai: string | null };

/** Da raiz até a categoria. `null` quando a categoria não está na árvore. */
export function caminhoDaCategoria(id: string | null, categorias: Map<string, Categoria>): Categoria[] | null {
  if (!id) return null;
  const caminho: Categoria[] = [];
  const vistos = new Set<string>();
  let atual = categorias.get(id);
  if (!atual) return null;
  while (atual) {
    if (vistos.has(atual.id)) return null; // árvore com ciclo não é árvore
    vistos.add(atual.id);
    caminho.unshift(atual);
    atual = atual.pai ? categorias.get(atual.pai) : undefined;
  }
  return caminho;
}

export function categoriaEntra(caminho: Categoria[]): boolean {
  if (caminho.length === 0) return false;
  const ids = caminho.map((c) => c.id);
  if (CATEGORIAS_QUE_ENTRAM_SOZINHAS.includes(ids[ids.length - 1])) return true;
  if (ids.some((id) => RAMOS_QUE_FICAM_FORA.includes(id))) return false;
  return RAMOS_QUE_ENTRAM.includes(ids[0]);
}

/**
 * A árvore como `web_api/categories/tree` devolve, achatada com o pai de cada
 * uma. Categoria sem id ou sem nome é ignorada.
 */
export function categoriasDaArvore(json: unknown): Categoria[] {
  const lista: Categoria[] = [];
  const andar = (nos: unknown, pai: string | null) => {
    if (!Array.isArray(nos)) return;
    for (const no of nos as Record<string, unknown>[]) {
      const c = ((no && typeof no === "object" && "Category" in no ? no.Category : no) ?? {}) as Record<string, unknown>;
      const id = c.id == null ? "" : String(c.id).trim();
      const nome = c.name == null ? "" : String(c.name).trim();
      if (/^\d+$/.test(id) && nome) lista.push({ id, nome, pai });
      andar(c.children, /^\d+$/.test(id) ? id : pai);
    }
  };
  const raiz = (json ?? {}) as Record<string, unknown>;
  andar(raiz.Category ?? json, null);
  return lista;
}

// ---------------------------------------------------------------------------
// O que vem da API

export type DetalheDaLoja = {
  encontrado: boolean;
  descricaoHtml: string | null;
  imagens: string[];
  referencia: string | null;
  modelo: string | null;
  ean: string | null;
  peso: number | null;
  comprimento: number | null;
  largura: number | null;
  altura: number | null;
  estoque: number | null;
  modificadoNaLoja: string | null;
};

const textoOuNulo = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
};

const numeroOuNulo = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/** O `Product` de `GET /products/{id}`, reduzido ao que o arquivo usa. */
export function detalheDaApi(produto: Record<string, unknown>): DetalheDaLoja {
  const fotos = Array.isArray(produto.ProductImage) ? (produto.ProductImage as Record<string, unknown>[]) : [];
  const imagens = fotos
    .map((f) => textoOuNulo(f?.https) ?? textoOuNulo(f?.http))
    .filter((u): u is string => Boolean(u));
  const descricao = typeof produto.description === "string" ? produto.description : null;
  const estoque = numeroOuNulo(produto.stock);
  return {
    encontrado: true,
    descricaoHtml: descricao,
    imagens,
    referencia: textoOuNulo(produto.reference),
    modelo: textoOuNulo(produto.model),
    ean: textoOuNulo(produto.ean),
    peso: numeroOuNulo(produto.weight),
    comprimento: numeroOuNulo(produto.length),
    largura: numeroOuNulo(produto.width),
    altura: numeroOuNulo(produto.height),
    estoque: estoque === null ? null : Math.trunc(estoque),
    modificadoNaLoja: textoOuNulo(produto.modified),
  };
}

/** Produto que a API disse não existir. */
export const DETALHE_NAO_ENCONTRADO: DetalheDaLoja = {
  encontrado: false, descricaoHtml: null, imagens: [], referencia: null, modelo: null, ean: null,
  peso: null, comprimento: null, largura: null, altura: null, estoque: null, modificadoNaLoja: null,
};

/** Depois de quantos dias um produto é lido de novo, mesmo sem sinal de mudança. */
export const DIAS_PARA_RELER = 3;

export type ParaLer = { trayId: string; motivo: "nunca_lido" | "foto_mudou" | "leitura_velha" };

/**
 * Quem a rotina lê agora, em ordem: o que nunca foi lido, depois o que tem a
 * foto principal diferente da que o espelho mostra (sinal de que alguém mexeu
 * no produto na loja), depois o que foi lido há mais de `DIAS_PARA_RELER`
 * dias, do mais velho para o mais novo.
 *
 * Mudança de preço NÃO pede leitura: preço vem do espelho, e na Black o preço
 * muda o dia inteiro.
 */
export function quemLer(
  produtos: { trayId: string; imagemPrincipal: string | null }[],
  detalhes: { trayId: string; primeiraImagem: string | null; lidoEm: string; encontrado: boolean }[],
  agora: Date,
  maximo: number,
): ParaLer[] {
  const porId = new Map(detalhes.map((d) => [d.trayId, d]));
  const limite = agora.getTime() - DIAS_PARA_RELER * 24 * 3600_000;
  const nunca: ParaLer[] = [];
  const foto: ParaLer[] = [];
  const velhos: { p: ParaLer; quando: number }[] = [];
  for (const p of produtos) {
    const d = porId.get(p.trayId);
    if (!d) nunca.push({ trayId: p.trayId, motivo: "nunca_lido" });
    else if (d.encontrado && p.imagemPrincipal && d.primeiraImagem !== p.imagemPrincipal) foto.push({ trayId: p.trayId, motivo: "foto_mudou" });
    else {
      const quando = Date.parse(d.lidoEm);
      if (!Number.isFinite(quando) || quando < limite) velhos.push({ p: { trayId: p.trayId, motivo: "leitura_velha" }, quando: Number.isFinite(quando) ? quando : 0 });
    }
  }
  velhos.sort((a, b) => a.quando - b.quando);
  return [...nunca, ...foto, ...velhos.map((v) => v.p)].slice(0, Math.max(0, maximo));
}

// ---------------------------------------------------------------------------
// Descrição

const ENTIDADES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0",
  aacute: "á", Aacute: "Á", agrave: "à", Agrave: "À", acirc: "â", Acirc: "Â", atilde: "ã", Atilde: "Ã", auml: "ä", Auml: "Ä",
  eacute: "é", Eacute: "É", egrave: "è", Egrave: "È", ecirc: "ê", Ecirc: "Ê", euml: "ë", Euml: "Ë",
  iacute: "í", Iacute: "Í", igrave: "ì", Igrave: "Ì", icirc: "î", Icirc: "Î", iuml: "ï", Iuml: "Ï",
  oacute: "ó", Oacute: "Ó", ograve: "ò", Ograve: "Ò", ocirc: "ô", Ocirc: "Ô", otilde: "õ", Otilde: "Õ", ouml: "ö", Ouml: "Ö",
  uacute: "ú", Uacute: "Ú", ugrave: "ù", Ugrave: "Ù", ucirc: "û", Ucirc: "Û", uuml: "ü", Uuml: "Ü",
  ccedil: "ç", Ccedil: "Ç", ntilde: "ñ", Ntilde: "Ñ",
  ordm: "º", ordf: "ª", deg: "°", sup1: "¹", sup2: "²", sup3: "³", frac12: "½", frac14: "¼", frac34: "¾",
  middot: "·", bull: "•", hellip: "…", ndash: "\u2013", mdash: "\u2014", lsquo: "\u2018", rsquo: "\u2019", ldquo: "\u201c", rdquo: "\u201d",
  laquo: "«", raquo: "»", copy: "©", reg: "®", trade: "™", times: "×", divide: "÷", euro: "€", cent: "¢", pound: "£",
  iexcl: "¡", iquest: "¿", shy: "\u00ad", zwj: "\u200d", zwnj: "\u200c",
};

/** Troca entidade HTML (com nome ou número) pelo caractere. Entidade desconhecida fica como está. */
export function decodificarEntidades(texto: string): string {
  return texto.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z][a-zA-Z0-9]*);/g, (inteira, corpo: string) => {
    if (corpo[0] === "#") {
      const n = corpo[1] === "x" || corpo[1] === "X" ? parseInt(corpo.slice(2), 16) : parseInt(corpo.slice(1), 10);
      if (!Number.isFinite(n) || n <= 0 || n > 0x10ffff || (n >= 0xd800 && n <= 0xdfff)) return inteira;
      return String.fromCodePoint(n);
    }
    return ENTIDADES[corpo] ?? inteira;
  });
}

/**
 * A descrição da loja (HTML) como texto, do jeito que a Tray põe no arquivo
 * (medido contra o arquivo dela em 17/11/2026):
 *
 * - sem as marcações, e cada quebra de linha virando um espaço, a tabulação
 *   sumindo e os espaços que sobram ficando (a Tray não junta espaços);
 * - travessão e meia-risca viram hífen, como a Tray faz com `&ndash;` e
 *   `&mdash;` (e como a regra da casa pede);
 * - pontas aparadas como o `trim` do PHP: espaço, tabulação e quebra de linha,
 *   mas NÃO o espaço inseparável.
 *
 * Uma diferença de propósito: a Tray deixa como texto a entidade que não cabe
 * em Latin-1 (o Meta mostrava "&ldquo;querido&rdquo;" escrito assim), e aqui
 * ela vira o caractere.
 */
export function descricaoEmTexto(html: string | null | undefined): string {
  if (!html) return "";
  const semMarcacao = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<\/?[a-zA-Z][^>]*>/g, "");
  return decodificarEntidades(semMarcacao)
    .replace(/\r/g, "")
    .replace(/\n/g, " ")
    .replace(/\t/g, "")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/^[ \t\n\r\0\x0b]+|[ \t\n\r\0\x0b]+$/g, "");
}

/**
 * Por que a descrição da Tray e a do painel diferem, quando é por um motivo
 * conhecido. `null` quando a diferença não tem explicação e precisa ser
 * olhada. Usada pela conferência, para separar o que é defeito da Tray do que
 * é diferença de verdade.
 */
export function porQueADescricaoDifere(tray: string, painel: string): string | null {
  if (!tray && painel) return "a Tray manda vazio; o painel manda a descrição curta ou o nome";
  const decodificada = decodificarEntidades(tray);
  if (decodificada === painel) return "a Tray deixa como texto a entidade que não cabe em Latin-1 (&ldquo;, &bull;, &zwj;)";
  // A Tray conta cada entidade inteira no limite de 5.000 (um emoji vale nove
  // caracteres), então corta antes, às vezes no meio de uma entidade.
  const semPontaQuebrada = decodificada.replace(/&#?[a-zA-Z0-9]*$/, "").replace(/[ \t\n\r\0\x0b]+$/, "");
  if (Array.from(tray).length >= 4000 && semPontaQuebrada.length > 0 && painel.startsWith(semPontaQuebrada)) {
    return "a Tray corta antes dos 5.000 caracteres, porque conta cada entidade inteira";
  }
  return null;
}

/** Corta em `limite` caracteres sem partir emoji ao meio. */
export function cortar(texto: string, limite: number): string {
  const letras = Array.from(texto);
  return letras.length <= limite ? texto : letras.slice(0, limite).join("");
}

// ---------------------------------------------------------------------------
// O item

export type ProdutoDoArquivo = {
  trayId: string;
  /** O nome como a loja escreveu (`raw.name`), sem aparar: a Tray não apara. */
  nome: string;
  url: string | null;
  ativo: boolean;
  disponivel: boolean;
  categoriaId: string | null;
  /** `raw.brand`. Vazio quer dizer sem marca no arquivo, como na Tray. */
  marca: string | null;
  imagemPrincipal: string | null;
  descricaoCurta: string | null;
  /** O que `precoVigente` respondeu para hoje. */
  preco: { atual: number | null; anterior: number | null };
  /** As datas da promoção como a Tray guarda (`AAAA-MM-DD` ou vazio). */
  promocao: { inicio: string | null; fim: string | null };
  detalhe: DetalheDaLoja | null;
};

/** Um campo do item, como aparece no arquivo: nome sem o `g:` e o texto. */
export type Campo = [nome: string, valor: string];
export type ItemDoArquivo = { id: string; campos: Campo[] };

export type MotivoDeFora = "inativo" | "indisponivel" | "categoria_desconhecida" | "categoria_fora" | "sem_preco" | "sem_foto" | "sem_link";

export const MOTIVO_EM_PALAVRAS: Record<MotivoDeFora, string> = {
  inativo: "desativado no espelho (sumiu da busca da loja)",
  indisponivel: "indisponível na loja",
  categoria_desconhecida: "a categoria principal não está na árvore guardada",
  categoria_fora: "a categoria principal não entra no catálogo",
  sem_preco: "sem preço",
  sem_foto: "sem foto",
  sem_link: "sem endereço na loja",
};

const dataValida = (v: string | null): string | null => {
  const s = (v ?? "").trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !s.startsWith("0000") ? s : null;
};

const dinheiro = (n: number) => `${n.toFixed(2)} BRL`;

/** 10 vira "10", 2.5 vira "2.5": a Tray escreve o número como está guardado. */
const numeroCurto = (n: number) => (Number.isInteger(n) ? String(n) : String(Number(n.toFixed(3))));

export function linkComParceiro(url: string, destino: Destino): string {
  return `${url}${url.includes("?") ? "&" : "?"}parceiro=${PARCEIRO[destino]}`;
}

/**
 * O porquê de um produto não entrar, ou `null` quando entra. É a mesma
 * resposta que a conferência usa para explicar diferença item por item.
 */
export function motivoDeFora(p: ProdutoDoArquivo, caminho: Categoria[] | null): MotivoDeFora | null {
  if (!p.ativo) return "inativo";
  if (!p.disponivel) return "indisponivel";
  if (!caminho) return "categoria_desconhecida";
  if (!categoriaEntra(caminho)) return "categoria_fora";
  if (p.preco.atual == null) return "sem_preco";
  if (!p.url) return "sem_link";
  if (!p.imagemPrincipal && !(p.detalhe?.imagens.length)) return "sem_foto";
  return null;
}

/**
 * O item do arquivo, na mesma ordem de campos da Tray. Quem chama já
 * conferiu `motivoDeFora`.
 *
 * Fotos: a lista da API só vale se a primeira for a mesma foto principal que o
 * espelho mostra. Se não for, alguém trocou a foto depois da última leitura, e
 * o arquivo sai só com a principal do espelho até a rotina reler o produto.
 */
export function itemDoArquivo(p: ProdutoDoArquivo, caminho: Categoria[], destino: Destino, hoje: string): ItemDoArquivo {
  const d = p.detalhe?.encontrado ? p.detalhe : null;
  const campos: Campo[] = [];
  const por = (nome: string, valor: string | null | undefined) => {
    if (valor !== null && valor !== undefined) campos.push([nome, valor]);
  };

  const fotosDaApi = d && d.imagens.length > 0 && (!p.imagemPrincipal || d.imagens[0] === p.imagemPrincipal) ? d.imagens : null;
  const fotos = fotosDaApi ?? (p.imagemPrincipal ? [p.imagemPrincipal] : []);

  const cheio = p.preco.anterior ?? (p.preco.atual as number);
  const promocao = p.preco.anterior != null ? (p.preco.atual as number) : null;

  const daLoja = descricaoEmTexto(d?.descricaoHtml);
  let descricao = daLoja.replace(/[\s\u00a0]/g, "") ? cortar(daLoja, LIMITE_DA_DESCRICAO).replace(/[ \t\n\r\0\x0b]+$/, "") : "";
  // Descrição vazia deixa o item com erro no Meta. A Tray mandava vazio em três
  // produtos; aqui vale a descrição curta e, sem ela, o nome.
  if (!descricao) descricao = cortar((p.descricaoCurta ?? "").trim() || p.nome.trim(), LIMITE_DA_DESCRICAO);

  por("id", p.trayId);
  por("title", p.nome);
  por("link", linkComParceiro(p.url as string, destino));
  por("price", dinheiro(cheio));
  if (d) por("shipping_weight", `${numeroCurto(d.peso ?? 0)} g`);
  por("description", descricao);
  por("brand", p.marca?.trim() ? p.marca : null);
  por("image_link", fotos[0] ?? null);
  for (const extra of fotos.slice(1, 1 + LIMITE_DE_FOTOS_EXTRAS)) por("additional_image_link", extra);
  por("product_type", caminho.map((c) => c.nome).join(SEPARADOR_DO_TIPO));
  por("availability", "in stock");
  if (promocao != null) {
    por("sale_price", dinheiro(promocao));
    const fim = dataValida(p.promocao.fim);
    // Sem data de fim a promoção vale até sair do arquivo, que é refeito de
    // hora em hora. Sem início, vale desde hoje.
    if (fim) por("sale_price_effective_date", `${dataValida(p.promocao.inicio) ?? hoje}T00:00-03:00/${fim}T23:59-03:00`);
  }
  por("gtin", d?.ean ?? null);
  por("mpn", `${p.trayId}${d?.referencia ?? ""}${d?.modelo ?? ""}`);
  por("condition", "new");
  if (d && [d.comprimento, d.largura, d.altura].some((n) => (n ?? 0) > 0)) {
    por("shipping_size", `${numeroCurto(d.comprimento ?? 0)}x${numeroCurto(d.largura ?? 0)}x${numeroCurto(d.altura ?? 0)} cm`);
  }
  return { id: p.trayId, campos };
}

// ---------------------------------------------------------------------------
// O XML

/** Caracteres que o XML 1.0 não aceita nem escapados. */
const PROIBIDOS_NO_XML = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g;

export function escaparXml(texto: string): string {
  return texto
    .replace(PROIBIDOS_NO_XML, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function xmlDoArquivo(itens: ItemDoArquivo[]): string {
  const partes: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
    "<channel>",
    `<title>${escaparXml(CANAL.titulo)}</title>`,
    `<link>${escaparXml(CANAL.link)}</link>`,
    `<description>${escaparXml(CANAL.descricao)}</description>`,
  ];
  for (const item of itens) {
    partes.push("<item>");
    for (const [nome, valor] of item.campos) partes.push(`<g:${nome}>${escaparXml(valor)}</g:${nome}>`);
    partes.push("</item>");
  }
  partes.push("</channel>", "</rss>", "");
  return partes.join("\n");
}

export type ResultadoDoArquivo = {
  itens: ItemDoArquivo[];
  /** Itens que saíram sem os detalhes da API (uma foto só, descrição curta). */
  semDetalhe: string[];
  fora: { trayId: string; motivo: MotivoDeFora }[];
};

/** Monta a lista de itens a partir dos produtos e da árvore. */
export function montarItens(produtos: ProdutoDoArquivo[], categorias: Categoria[], destino: Destino, hoje: string): ResultadoDoArquivo {
  const mapa = new Map(categorias.map((c) => [c.id, c]));
  const itens: ItemDoArquivo[] = [];
  const semDetalhe: string[] = [];
  const fora: ResultadoDoArquivo["fora"] = [];
  const ordenados = [...produtos].sort((a, b) => Number(a.trayId) - Number(b.trayId));
  for (const p of ordenados) {
    const caminho = caminhoDaCategoria(p.categoriaId, mapa);
    const motivo = motivoDeFora(p, caminho);
    if (motivo) {
      fora.push({ trayId: p.trayId, motivo });
      continue;
    }
    if (!p.detalhe?.encontrado) semDetalhe.push(p.trayId);
    itens.push(itemDoArquivo(p, caminho as Categoria[], destino, hoje));
  }
  return { itens, semDetalhe, fora };
}
