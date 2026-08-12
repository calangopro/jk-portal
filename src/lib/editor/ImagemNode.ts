import Image from "@tiptap/extension-image";

/**
 * Imagem com largura e altura no HTML.
 *
 * A extensão padrão do TipTap grava só `src` e `alt`. Sem `width` e `height`,
 * o navegador não sabe quanto espaço reservar e a página pula quando a imagem
 * carrega, o que é penalizado como salto de layout (CLS).
 *
 * As dimensões já são lidas no envio e guardadas na tabela `media`. Aqui elas
 * passam a ir também para a tag, que é onde fazem efeito.
 */
export const ImagemNode = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("width"),
        renderHTML: (attrs: Record<string, unknown>) =>
          attrs.width ? { width: String(attrs.width) } : {},
      },
      height: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("height"),
        renderHTML: (attrs: Record<string, unknown>) =>
          attrs.height ? { height: String(attrs.height) } : {},
      },
    };
  },
});
