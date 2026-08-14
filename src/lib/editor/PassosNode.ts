import { OrderedList } from "@tiptap/extension-list/ordered-list";

/**
 * Lista numerada que é um passo a passo de verdade.
 *
 * A diferença para a lista comum não é visual, é semântica: `data-passos`
 * marca a sequência como um procedimento, e é isso que deixa a página emitir
 * `HowTo` no JSON-LD sem ninguém precisar redigitar os passos num campo à
 * parte. O medidor de aliança já prova que funciona, só que lá os passos estão
 * escritos à mão no código da página.
 *
 * O rich result de HowTo acabou no Google em 2023, e o markup continua valendo
 * porque Bing e os sistemas de IA seguem lendo. Custo zero, leitura melhor.
 *
 * Estende o nó de lista ordenada em vez de criar um nó novo, então tudo que já
 * funciona (Enter cria item, Tab aninha, conteúdo antigo continua abrindo)
 * segue funcionando sem nenhum código extra.
 */
export const ListaDePassos = OrderedList.extend({
  name: "orderedList",

  addAttributes() {
    return {
      ...this.parent?.(),
      passos: {
        default: false,
        parseHTML: (el: HTMLElement) => el.hasAttribute("data-passos"),
        renderHTML: (attrs: Record<string, unknown>) =>
          attrs.passos ? { "data-passos": "" } : {},
      },
    };
  },
});
