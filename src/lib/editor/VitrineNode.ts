import { Node } from "@tiptap/core";

/**
 * Vitrine de produtos dentro do conteúdo.
 *
 * Substitui o card solto que existia antes. Um card sozinho ocupava a largura
 * inteira da coluna de leitura, com botão dourado do tamanho de um banner, e
 * não havia jeito de mostrar duas alianças lado a lado para comparar, que é
 * justamente o que um guia de compra precisa fazer.
 *
 * Agora o bloco guarda de um a quatro produtos e um formato. O card inteiro é
 * o link, então o botão gigante saiu e sobrou a foto, o nome e o preço.
 *
 * ## Contrato do HTML publicado
 *
 * Preço, preço antigo, selo de desconto e aviso de estoque saem em elementos
 * FOLHA, com `data-*-de="<id do produto>"` e nada dentro além de texto. É esse
 * formato que deixa `comPrecosAtuais()` (src/lib/conteudo/precos.ts) trocar o
 * valor no servidor, na hora de servir a página, sem precisar de um parser de
 * HTML. Se algum destes elementos ganhar filho, a atualização de preço para de
 * funcionar em silêncio.
 */

export type ProdutoDoBloco = {
  id: string | null;
  nome: string;
  url: string;
  imagem: string | null;
  /** Preço em texto, como veio da Tray. Espelho, não fonte de verdade. */
  preco: string | null;
  precoAntigo: string | null;
  disponivel: boolean;
  prazo: string | null;
};

export type FormatoDaVitrine = "vertical" | "quadrado" | "horizontal";

export const FORMATOS: { valor: FormatoDaVitrine; nome: string; ajuda: string }[] = [
  { valor: "vertical", nome: "Vertical", ajuda: "Foto em cima, nome e preço embaixo" },
  { valor: "quadrado", nome: "Quadrado", ajuda: "Compacto, cabe mais produto na linha" },
  { valor: "horizontal", nome: "Horizontal", ajuda: "Foto à esquerda, texto à direita" },
];

/** Teto de quatro: acima disso o card fica menor que a miniatura e ninguém lê. */
export const MAXIMO_DE_PRODUTOS = 4;

export function formatoValido(v: unknown): FormatoDaVitrine {
  return v === "quadrado" || v === "horizontal" ? v : "vertical";
}

export function moeda(valor: string | null): string | null {
  if (!valor) return null;
  const n = Number(valor);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Só existe desconto quando o preço cheio é maior que o promocional. */
export function descontoEmTexto(preco: string | null, antigo: string | null): string | null {
  if (!preco || !antigo) return null;
  const novo = Number(preco);
  const velho = Number(antigo);
  if (!Number.isFinite(novo) || !Number.isFinite(velho)) return null;
  if (velho <= novo || novo <= 0) return null;
  return `${Math.round((1 - novo / velho) * 100)}% OFF`;
}

function lerCartao(el: Element): ProdutoDoBloco {
  return {
    id: el.getAttribute("data-produto-id") || null,
    nome: el.getAttribute("data-nome") ?? "",
    url: el.getAttribute("data-url") ?? "",
    imagem: el.getAttribute("data-imagem") || null,
    preco: el.getAttribute("data-preco") || null,
    precoAntigo: el.getAttribute("data-preco-antigo") || null,
    disponivel: el.getAttribute("data-disponivel") !== "0",
    prazo: el.getAttribute("data-prazo") || null,
  };
}

type Saida = [string, Record<string, string>, ...unknown[]];

/** Elemento folha: só texto dentro, e some da tela quando não tem texto. */
function folha(tag: string, classe: string, marca: string, id: string, texto: string | null): Saida {
  const attrs: Record<string, string> = { class: classe, [marca]: id };
  if (!texto) attrs.hidden = "";
  return [tag, attrs, texto ?? ""];
}

export function cartaoEmHtml(p: ProdutoDoBloco): unknown {
  const id = p.id ?? "";
  const preco = moeda(p.preco);
  const antigo = moeda(p.precoAntigo);
  const desconto = descontoEmTexto(p.preco, p.precoAntigo);
  const aviso = !p.disponivel ? "Sem estoque no momento" : p.prazo || "";

  const midia: unknown[] = ["span", { class: "produto-card__midia" }];
  midia.push(
    p.imagem
      ? ["img", { src: p.imagem, alt: p.nome, loading: "lazy", decoding: "async" }]
      : ["span", { class: "produto-card__semfoto" }, "Sem foto"],
  );
  midia.push(folha("span", "produto-card__selo", "data-selo-de", id, desconto));

  return [
    "a",
    {
      class: "produto-card",
      href: p.url,
      target: "_blank",
      rel: "noopener sponsored",
      "data-produto": "",
      "data-produto-id": id,
      "data-nome": p.nome,
      "data-url": p.url,
      "data-imagem": p.imagem ?? "",
      "data-preco": p.preco ?? "",
      "data-preco-antigo": p.precoAntigo ?? "",
      "data-disponivel": p.disponivel ? "1" : "0",
      "data-prazo": p.prazo ?? "",
      "data-evento": "clique_produto",
      "data-produto-nome": p.nome,
    },
    midia,
    [
      "span",
      { class: "produto-card__corpo" },
      ["span", { class: "produto-card__nome" }, p.nome],
      [
        "span",
        { class: "produto-card__precos" },
        folha("s", "produto-card__antigo", "data-antigo-de", id, antigo),
        folha("strong", "produto-card__preco", "data-preco-de", id, preco),
      ],
      folha("span", "produto-card__aviso", "data-aviso-de", id, aviso),
      ["span", { class: "produto-card__acao" }, "Ver produto"],
    ],
  ];
}

export const VitrineNode = Node.create<{
  /**
   * Chamado quando alguém pede um produto novo de dentro do bloco. Recebe a
   * função que aceita o produto escolhido, porque quem abre a janela de busca é
   * o editor, e quem sabe onde encaixar o resultado é este nó.
   */
  aoPedirProduto?: (aceitar: (p: ProdutoDoBloco) => void) => void;
}>({
  name: "vitrine",
  group: "block",
  atom: true,
  draggable: true,

  addOptions() {
    return { aoPedirProduto: undefined };
  },

  addAttributes() {
    return {
      formato: {
        default: "vertical" as FormatoDaVitrine,
        renderHTML: () => ({}),
      },
      produtos: {
        default: [] as ProdutoDoBloco[],
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-vitrine]",
        priority: 60,
        getAttrs: (el) => ({
          formato: formatoValido((el as HTMLElement).getAttribute("data-formato")),
          produtos: Array.from((el as HTMLElement).querySelectorAll("[data-produto]")).map(lerCartao),
        }),
      },
      {
        // Conteúdo antigo: card solto vira uma vitrine de um produto só. Sem
        // esta regra, todo produto já publicado sumiria ao reabrir o artigo.
        tag: "div[data-produto]",
        priority: 40,
        getAttrs: (el) => ({
          formato: "vertical" as FormatoDaVitrine,
          produtos: [lerCartao(el as HTMLElement)],
        }),
      },
    ];
  },

  renderHTML({ node }) {
    const formato = formatoValido(node.attrs.formato);
    const produtos = (node.attrs.produtos ?? []) as ProdutoDoBloco[];

    return [
      "div",
      {
        class: `vitrine vitrine--${formato}`,
        "data-vitrine": "",
        "data-formato": formato,
        "data-n": String(produtos.length),
      },
      ...produtos.map(cartaoEmHtml),
    ] as unknown as Saida;
  },
});
