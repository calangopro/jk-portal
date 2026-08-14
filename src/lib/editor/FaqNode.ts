import { Node } from "@tiptap/core";

/**
 * Bloco de perguntas frequentes dentro do corpo do texto.
 *
 * Antes da existência deste bloco a FAQ só podia ser preenchida num formulário
 * separado, no fim da tela, e sempre ia parar depois de todo o conteúdo. Só que
 * a pergunta nasce no meio do assunto: quem acabou de ler sobre largura tem
 * dúvida de largura ali, não seis seções adiante. Empurrar tudo para o rodapé
 * custa leitura e custa citação, porque a resposta fica longe do contexto.
 *
 * A estrutura de propósito NÃO inventa nós novos: dentro da seção valem H3 e
 * parágrafo, que é o que a pessoa já sabe usar. Cada H3 é uma pergunta, e o que
 * vem abaixo dele até o próximo H3 é a resposta. `faqsDoHtml` em
 * `src/lib/content/faq-html.ts` lê exatamente isso para alimentar o `FAQPage`.
 *
 * O rich result de FAQ acabou no Google em 07/05/2026. O markup continua saindo
 * porque Bing e os sistemas de IA seguem lendo, e porque a FAQ vale por leitor
 * antes de valer por busca.
 */
export const FaqNode = Node.create({
  name: "faq",
  group: "block",
  content: "(heading | paragraph | bulletList | orderedList)+",
  defining: true,
  draggable: true,

  parseHTML() {
    return [{ tag: "section[data-faq]" }];
  },

  addCommands() {
    return {
      inserirFaq:
        (perguntas) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            content: perguntas.flatMap((p) => [
              { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: p.pergunta }] },
              { type: "paragraph", content: [{ type: "text", text: p.resposta }] },
            ]),
          }),
    };
  },

  renderHTML() {
    return ["section", { "data-faq": "" }, 0];
  },
});

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    faq: {
      inserirFaq: (perguntas: { pergunta: string; resposta: string }[]) => ReturnType;
    };
  }
}
