import { Node, mergeAttributes } from "@tiptap/core";

/**
 * Trecho com a fonte à vista do leitor.
 *
 * A regra do projeto sempre exigiu fonte para toda afirmação, e a fonte ficava
 * num painel do admin: conferível por quem edita, invisível para quem lê. Isso
 * resolve a auditoria interna e desperdiça o ativo. Dado com origem declarada é
 * exatamente o que a documentação do Google chama de conteúdo confiável, e é o
 * que os sistemas de IA citam com segurança, porque conseguem atribuir.
 *
 * Sai como `<blockquote cite>` com `<footer>`, que é o markup correto para
 * afirmação atribuída, e não como uma caixa decorativa qualquer.
 *
 * O texto é editável: a frase da base de fatos costuma precisar de ajuste para
 * caber no parágrafo. O vínculo com a linha de `sources` fica no atributo, e
 * não no texto, então reescrever não desfaz a atribuição.
 */
export const FonteNode = Node.create({
  name: "fonte",
  group: "block",
  content: "paragraph+",
  defining: true,
  draggable: true,

  addAttributes() {
    return {
      /** Id da linha em `sources`. É o que liga o trecho à evidência. */
      fonteId: { default: null },
      /** Nome curto de quem afirma, ex.: "JK Alianças". */
      origem: { default: "" },
      url: { default: "" },
      conferidoEm: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "blockquote[data-fonte]",
        contentElement: "[data-fonte-corpo]",
        getAttrs: (el) => {
          const node = el as HTMLElement;
          const rodape = node.querySelector("footer");
          const link = rodape?.querySelector("a");
          return {
            fonteId: node.getAttribute("data-fonte-id"),
            origem: node.getAttribute("data-origem") ?? link?.textContent?.trim() ?? "",
            url: link?.getAttribute("href") ?? node.getAttribute("cite") ?? "",
            conferidoEm: node.getAttribute("data-conferido-em") ?? "",
          };
        },
      },
    ];
  },

  addCommands() {
    return {
      inserirFonte:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs,
            content: [{ type: "paragraph" }],
          }),
    };
  },

  renderHTML({ HTMLAttributes }) {
    const a = HTMLAttributes as Record<string, string | null>;
    const origem = (a.origem ?? "").trim();
    const url = (a.url ?? "").trim();
    const conferido = (a.conferidoEm ?? "").trim();

    // Data no formato que o Brasil lê. Chega como AAAA-MM-DD do banco.
    const dataLegivel = /^\d{4}-\d{2}-\d{2}$/.test(conferido)
      ? conferido.split("-").reverse().join("/")
      : conferido;

    const creditoInterno: unknown[] = ["span", { class: "fonte-origem" }, origem || "registro interno"];
    // Link só quando existe endereço. Fonte que é documento interno continua
    // sendo fonte, e um `<a href="">` vazio seria um link quebrado no texto.
    const credito = url
      ? ["a", { href: url, target: "_blank", rel: "noopener nofollow" }, origem || url]
      : creditoInterno;

    const rodape: unknown[] = ["footer", { class: "fonte-rodape" }, "Fonte: ", credito];
    if (dataLegivel) rodape.push(`, conferido em ${dataLegivel}`);

    return [
      "blockquote",
      mergeAttributes(
        { "data-fonte": "" },
        a.fonteId ? { "data-fonte-id": a.fonteId } : {},
        origem ? { "data-origem": origem } : {},
        conferido ? { "data-conferido-em": conferido } : {},
        url ? { cite: url } : {},
      ),
      ["div", { "data-fonte-corpo": "" }, 0],
      rodape,
    ] as unknown as [string, Record<string, string>, ...unknown[]];
  },
});

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fonte: {
      inserirFonte: (attrs: {
        fonteId?: string | null;
        origem?: string;
        url?: string;
        conferidoEm?: string;
      }) => ReturnType;
    };
  }
}
