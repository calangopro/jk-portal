import Youtube from "@tiptap/extension-youtube";

/**
 * Vídeo do YouTube com `title` no iframe.
 *
 * A extensão padrão monta o iframe sem título, e um iframe sem título é
 * anunciado pelo leitor de tela apenas como um quadro sem nome. O título também
 * é o texto que explica o vídeo para quem indexa a página.
 *
 * O atributo entra como atributo do nó porque a extensão mescla os atributos do
 * nó por último na tag do iframe, então `title` chega ao HTML final sem
 * precisar reescrever o `renderHTML` inteiro.
 */
export const VideoNode = Youtube.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      title: {
        default: "",
        parseHTML: (el: HTMLElement) =>
          el.querySelector("iframe")?.getAttribute("title") ?? "",
        renderHTML: (attrs: Record<string, unknown>) =>
          attrs.title ? { title: String(attrs.title) } : {},
      },
    };
  },
});
