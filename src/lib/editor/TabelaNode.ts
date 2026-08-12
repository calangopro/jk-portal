import { mergeAttributes } from "@tiptap/core";
import { Table, TableHeader } from "@tiptap/extension-table";

/**
 * Tabela com `<caption>`.
 *
 * A tabela é o formato que a IA extrai melhor, e é por isso que o REGRAS.md
 * pede tabela sempre que houver comparação. Só que uma tabela sem legenda não
 * diz o que está comparando: quem usa leitor de tela ouve uma grade de números
 * sem contexto, e um modelo que extrai a tabela fora da página perde o assunto.
 *
 * A legenda fica num atributo do nó e é lida de volta do próprio `<caption>`,
 * então o conteúdo continua sendo HTML comum, sem `data-` inventado.
 */
export const TabelaNode = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      legenda: {
        default: "",
        parseHTML: (el: HTMLElement) =>
          el.querySelector("caption")?.textContent?.trim() ?? "",
        // Não vira atributo da <table>: o texto sai como elemento <caption>.
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [
      // Ignora o <caption> na leitura do CONTEÚDO. O schema de tabela do TipTap
      // só aceita linhas, então sem esta regra o parser tirava a legenda de
      // dentro da tabela e a transformava num parágrafo solto acima dela. O
      // texto continua sendo lido, mas pelo atributo `legenda` logo abaixo.
      { tag: "caption", ignore: true },
      { tag: "table" },
    ];
  },

  renderHTML({
    node,
    HTMLAttributes,
  }: {
    node: { attrs: Record<string, unknown> };
    HTMLAttributes: Record<string, unknown>;
  }) {
    const legenda = String(node.attrs.legenda ?? "").trim();
    const atributos = mergeAttributes(
      this.options.HTMLAttributes,
      HTMLAttributes,
    );

    return legenda
      ? ["table", atributos, ["caption", {}, legenda], ["tbody", 0]]
      : ["table", atributos, ["tbody", 0]];
  },
});

/**
 * Célula de cabeçalho com `scope="col"`.
 *
 * Sem `scope`, o leitor de tela não sabe se aquele `<th>` manda na coluna ou na
 * linha, e lê a tabela inteira sem associar valor a cabeçalho.
 */
export const CabecalhoDeTabela = TableHeader.extend({
  parseHTML() {
    return [
      // Ignora o <caption> na leitura do CONTEÚDO. O schema de tabela do TipTap
      // só aceita linhas, então sem esta regra o parser tirava a legenda de
      // dentro da tabela e a transformava num parágrafo solto acima dela. O
      // texto continua sendo lido, mas pelo atributo `legenda` logo abaixo.
      { tag: "caption", ignore: true },
      { tag: "table" },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "th",
      mergeAttributes({ scope: "col" }, this.options.HTMLAttributes, HTMLAttributes),
      0,
    ];
  },
});
