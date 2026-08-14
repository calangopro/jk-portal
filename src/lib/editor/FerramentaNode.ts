import { Node, mergeAttributes } from "@tiptap/core";
import { ehFerramenta } from "@/lib/ferramentas/registro";

/**
 * Ferramenta embutida no meio do artigo.
 *
 * O guia que explica como escolher o tamanho é muito melhor com o conversor
 * ali, na hora da dúvida, do que com um link pedindo para a pessoa sair da
 * página. Sair é onde a leitura morre.
 *
 * O nó guarda só o slug. O componente de verdade é montado pela página, porque
 * o corpo do artigo é HTML servido de uma vez e não pode conter React. É
 * `separarFerramentas` em `src/lib/content/ferramentas-html.ts` que corta o HTML
 * nestes marcadores e encaixa o componente entre os pedaços.
 *
 * Atômico e vazio de propósito: conteúdo dentro dele seria texto que o editor
 * escreve e o leitor nunca vê.
 */
export const FerramentaNode = Node.create({
  name: "ferramenta",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      slug: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-ferramenta]",
        getAttrs: (el) => {
          const slug = (el as HTMLElement).getAttribute("data-ferramenta") ?? "";
          // Ferramenta que saiu do ar não volta como bloco quebrado: o nó é
          // recusado e o div vira conteúdo comum, que a página ignora.
          return ehFerramenta(slug) ? { slug } : false;
        },
      },
    ];
  },

  addCommands() {
    return {
      inserirFerramenta:
        (slug) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { slug } }),
    };
  },

  renderHTML({ HTMLAttributes }) {
    const slug = String((HTMLAttributes as Record<string, string>).slug ?? "");
    return ["div", mergeAttributes({ "data-ferramenta": slug })];
  },
});

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    ferramenta: {
      inserirFerramenta: (slug: string) => ReturnType;
    };
  }
}
