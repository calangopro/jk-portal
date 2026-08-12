import { Node, mergeAttributes } from "@tiptap/core";

/**
 * Imagem com legenda e crédito, em `<figure>` de verdade.
 *
 * Existe porque `media.caption` e `media.credit` eram coletados na biblioteca
 * de mídia, exigidos no formulário, e depois descartados: o nó de imagem
 * renderizava um `<img>` solto e nada mais lia esses campos. A documentação de
 * imagens do Google trata legenda e texto ao redor como sinal de contexto, e é
 * o que explica a foto para quem lê.
 *
 * Convive com `ImagemNode`. Imagem sem legenda continua sendo um `<img>` simples,
 * e todo o conteúdo antigo continua sendo lido do jeito que foi salvo.
 */
export const FiguraNode = Node.create({
  name: "figura",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: "" },
      width: { default: null },
      height: { default: null },
      legenda: { default: "" },
      credito: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        // `data-figura` marca o que este nó gerou. Sem a marca, qualquer
        // <figure> vindo de fora seria capturado e perderia o conteúdo.
        tag: "figure[data-figura]",
        getAttrs: (el) => {
          const node = el as HTMLElement;
          const img = node.querySelector("img");
          const cap = node.querySelector("figcaption");
          return {
            src: img?.getAttribute("src") ?? null,
            alt: img?.getAttribute("alt") ?? "",
            width: img?.getAttribute("width") ?? null,
            height: img?.getAttribute("height") ?? null,
            legenda: cap?.getAttribute("data-legenda") ?? "",
            credito: cap?.getAttribute("data-credito") ?? "",
          };
        },
      },
    ];
  },

  addCommands() {
    return {
      inserirFigura:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },

  renderHTML({ HTMLAttributes }) {
    const a = HTMLAttributes as Record<string, string | null>;
    const legenda = (a.legenda ?? "").trim();
    const credito = (a.credito ?? "").trim();

    const img = [
      "img",
      mergeAttributes(
        { loading: "lazy", decoding: "async" },
        { src: a.src, alt: a.alt ?? "" },
        a.width ? { width: String(a.width) } : {},
        a.height ? { height: String(a.height) } : {},
      ),
    ];

    // Legenda e crédito ficam no mesmo <figcaption>, separados visualmente,
    // e guardados também em data-* para o nó voltar inteiro na releitura.
    const filhos: unknown[] = [img];
    if (legenda || credito) {
      const texto = [legenda, credito && `Foto: ${credito}`]
        .filter(Boolean)
        .join(" ");
      filhos.push([
        "figcaption",
        { "data-legenda": legenda, "data-credito": credito },
        texto,
      ]);
    }

    return ["figure", { "data-figura": "" }, ...filhos] as unknown as [
      string,
      Record<string, string>,
      ...unknown[],
    ];
  },
});

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    figura: {
      inserirFigura: (attrs: {
        src: string;
        alt: string;
        width?: number | null;
        height?: number | null;
        legenda?: string | null;
        credito?: string | null;
      }) => ReturnType;
    };
  }
}
