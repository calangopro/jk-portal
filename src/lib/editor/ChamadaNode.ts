import { Node, mergeAttributes } from "@tiptap/core";

/**
 * Chamada para ação, no meio ou no fim do texto.
 *
 * O bloco de produto já cobre a saída para a loja, com preço e UTM. O que
 * faltava era a saída que NÃO é produto: provar no dedo numa unidade, falar no
 * WhatsApp, continuar no guia que explica o passo seguinte. Sem um bloco para
 * isso, a única forma era escrever um link solto no parágrafo, que ninguém vê e
 * que ninguém consegue medir.
 *
 * Sai com `data-evento`, então o rastreio de cliques que já escuta a página
 * inteira passa a contar esta saída sem código novo em lugar nenhum.
 *
 * É atômico de propósito: o texto vive nos atributos, não como conteúdo
 * editável, porque um bloco de conversão com formatação livre por dentro vira
 * seis aparências diferentes na mesma página.
 */
export const ChamadaNode = Node.create({
  name: "chamada",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      texto: { default: "" },
      botao: { default: "Ver mais" },
      href: { default: "" },
      /** Qual saída é esta, para o relatório separar loja, unidade e guia. */
      evento: { default: "clique_loja" },
      /** Link para fora abre em outra aba e não passa autoridade sem decisão. */
      externo: { default: false },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-chamada]",
        getAttrs: (el) => {
          const node = el as HTMLElement;
          const a = node.querySelector("a");
          const p = node.querySelector("p");
          const href = a?.getAttribute("href") ?? "";
          return {
            texto: p?.textContent?.trim() ?? "",
            botao: a?.textContent?.trim() ?? "Ver mais",
            href,
            evento: a?.getAttribute("data-evento") ?? "clique_loja",
            externo: /^https?:\/\//i.test(href),
          };
        },
      },
    ];
  },

  addCommands() {
    return {
      inserirChamada:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },

  renderHTML({ HTMLAttributes }) {
    const a = HTMLAttributes as Record<string, string | boolean | null>;
    const texto = String(a.texto ?? "").trim();
    const botao = String(a.botao ?? "").trim() || "Ver mais";
    const href = String(a.href ?? "").trim();
    const evento = String(a.evento ?? "clique_loja");
    const externo = a.externo === true || a.externo === "true";

    const filhos: unknown[] = [];
    if (texto) filhos.push(["p", { class: "chamada-texto" }, texto]);
    filhos.push([
      "a",
      mergeAttributes(
        { class: "chamada-botao", href, "data-evento": evento },
        // Saída para fora: aba nova e `noopener`. `sponsored` fica para o card
        // de produto, que é o link comercial de verdade.
        externo ? { target: "_blank", rel: "noopener" } : {},
      ),
      botao,
    ]);

    return ["div", { "data-chamada": "" }, ...filhos] as unknown as [
      string,
      Record<string, string>,
      ...unknown[],
    ];
  },
});

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    chamada: {
      inserirChamada: (attrs: {
        texto: string;
        botao: string;
        href: string;
        evento?: string;
        externo?: boolean;
      }) => ReturnType;
    };
  }
}
