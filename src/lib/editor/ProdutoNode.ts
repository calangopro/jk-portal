import { Node, mergeAttributes } from "@tiptap/core";

/**
 * Bloco de produto da loja.
 *
 * Guarda os dados no próprio HTML (data-*), então o conteúdo publicado não
 * depende de consulta extra para renderizar o card. Preço e disponibilidade
 * são espelho do que veio da Tray na hora da inserção, e o botão leva para a
 * loja, que continua sendo quem fecha a venda.
 */

export type ProdutoAttrs = {
  produtoId: string | null;
  nome: string;
  url: string;
  imagem: string | null;
  preco: string | null;
  precoAntigo: string | null;
  disponivel: boolean;
  prazo: string | null;
};

function moeda(valor: string | null): string | null {
  if (!valor) return null;
  const n = Number(valor);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export const ProdutoNode = Node.create({
  name: "produto",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      produtoId: { default: null, parseHTML: (el: HTMLElement) => el.getAttribute("data-produto-id") },
      nome: { default: "", parseHTML: (el: HTMLElement) => el.getAttribute("data-nome") ?? "" },
      url: { default: "", parseHTML: (el: HTMLElement) => el.getAttribute("data-url") ?? "" },
      imagem: { default: null, parseHTML: (el: HTMLElement) => el.getAttribute("data-imagem") },
      preco: { default: null, parseHTML: (el: HTMLElement) => el.getAttribute("data-preco") },
      precoAntigo: { default: null, parseHTML: (el: HTMLElement) => el.getAttribute("data-preco-antigo") },
      disponivel: {
        default: true,
        parseHTML: (el: HTMLElement) => el.getAttribute("data-disponivel") !== "0",
      },
      prazo: { default: null, parseHTML: (el: HTMLElement) => el.getAttribute("data-prazo") },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-produto]" }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const a = node.attrs as ProdutoAttrs;
    const preco = moeda(a.preco);
    const antigo = moeda(a.precoAntigo);

    // Desconto só aparece quando existe preço cheio maior que o promocional.
    let desconto: string | null = null;
    if (a.preco && a.precoAntigo) {
      const novo = Number(a.preco);
      const velho = Number(a.precoAntigo);
      if (velho > novo && novo > 0) {
        desconto = `${Math.round((1 - novo / velho) * 100)}% OFF`;
      }
    }

    const midia: unknown[] = ["div", { class: "produto-card__midia" }];
    if (a.imagem) midia.push(["img", { src: a.imagem, alt: a.nome, loading: "lazy" }]);
    else midia.push(["span", { class: "produto-card__semfoto" }, "Sem foto"]);
    if (desconto) midia.push(["span", { class: "produto-card__selo" }, desconto]);

    const corpo: unknown[] = ["div", { class: "produto-card__corpo" }];
    corpo.push(["p", { class: "produto-card__nome" }, a.nome]);

    if (preco) {
      const precos: unknown[] = ["p", { class: "produto-card__precos" }];
      if (antigo && desconto) precos.push(["s", { class: "produto-card__antigo" }, antigo]);
      precos.push(["strong", { class: "produto-card__preco" }, preco]);
      corpo.push(precos);
    }

    if (!a.disponivel) {
      corpo.push(["p", { class: "produto-card__aviso" }, "Sem estoque no momento"]);
    } else if (a.prazo) {
      corpo.push(["p", { class: "produto-card__prazo" }, a.prazo]);
    }

    // Botão no padrão da loja: sacola + "Comprar", em pílula dourada.
    corpo.push([
      "a",
      {
        class: "produto-card__botao",
        href: a.url,
        target: "_blank",
        rel: "noopener sponsored",
        "data-evento": "clique_produto",
        "data-produto-nome": a.nome,
      },
      [
        "svg",
        {
          class: "produto-card__sacola",
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": "2",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
          "aria-hidden": "true",
        },
        ["circle", { cx: "8", cy: "21", r: "1" }],
        ["circle", { cx: "19", cy: "21", r: "1" }],
        ["path", { d: "M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" }],
      ],
      ["span", {}, "Comprar"],
    ]);

    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        class: "produto-card",
        "data-produto": "",
        "data-produto-id": a.produtoId ?? "",
        "data-nome": a.nome,
        "data-url": a.url,
        "data-imagem": a.imagem ?? "",
        "data-preco": a.preco ?? "",
        "data-preco-antigo": a.precoAntigo ?? "",
        "data-disponivel": a.disponivel ? "1" : "0",
        "data-prazo": a.prazo ?? "",
      }),
      midia,
      corpo,
    ];
  },
});
