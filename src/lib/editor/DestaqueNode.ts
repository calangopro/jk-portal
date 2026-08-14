import { Node, mergeAttributes } from "@tiptap/core";

/**
 * Resumo em destaque, no meio do texto.
 *
 * Existe por dois motivos que apontam para o mesmo lugar. Para quem lê, é a
 * pausa que ancora um artigo longo: a pessoa que rola rápido para em um bloco
 * destacado e volta a ler. Para quem cita, é um trecho que se sustenta sozinho,
 * fora do parágrafo, que é exatamente o formato que a IA extrai.
 *
 * Não é caixa de vidro. A "resposta rápida" do topo já foi caixa e virou linha
 * de apoio editorial por decisão do projeto, então aqui o destaque é uma faixa
 * discreta com filete dourado, no mesmo espírito.
 *
 * O conteúdo é editável direto no bloco (não é atômico), então a pessoa
 * escreve dentro dele como escreveria num parágrafo.
 */
export const DestaqueNode = Node.create({
  name: "destaque",
  group: "block",
  content: "paragraph+",
  defining: true,
  draggable: true,

  addAttributes() {
    return {
      // Rótulo curto acima do texto. Editável pelo comando, não pelo teclado,
      // para não virar mais um lugar onde dá para escrever qualquer coisa.
      rotulo: { default: "Em resumo" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "aside[data-destaque]",
        // O rótulo é irmão do conteúdo. Sem apontar o contentElement, a
        // releitura engoliria o rótulo como se fosse o primeiro parágrafo.
        contentElement: "[data-destaque-corpo]",
        getAttrs: (el) => ({
          rotulo: (el as HTMLElement).getAttribute("data-rotulo") ?? "",
        }),
      },
    ];
  },

  addCommands() {
    return {
      inserirDestaque:
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
    const rotulo = (a.rotulo ?? "").trim();

    const filhos: unknown[] = [];
    if (rotulo) filhos.push(["p", { class: "destaque-rotulo" }, rotulo]);
    filhos.push(["div", { "data-destaque-corpo": "" }, 0]);

    return [
      "aside",
      mergeAttributes({ "data-destaque": "" }, rotulo ? { "data-rotulo": rotulo } : {}),
      ...filhos,
    ] as unknown as [string, Record<string, string>, ...unknown[]];
  },
});

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    destaque: {
      inserirDestaque: (attrs: { rotulo?: string }) => ReturnType;
    };
  }
}
