import type { Print } from "../prints.mts";

/** Rola até o elemento deixando folga para a barra de topo. */
const rolar = (seletor: string, folga = 90) => async (p: any) => {
  await p.locator(seletor).first().evaluate((e: HTMLElement, f: number) => window.scrollBy(0, e.getBoundingClientRect().top - f), folga);
};

const prints: Print[] = [
  {
    arquivo: "comentarios-1", demo: "comentarios", nivel: "conteudo",
    alvos: { aprovarTodos: "button:has-text(\"Aprovar os\")", abas: "nav.mt-7", primeiro: "ul > li >> nth=0", acoes: "ul > li >> nth=0 >> div.mt-4" },
  },
  {
    arquivo: "comentarios-2", demo: "comentarios", nivel: "diretoria",
    antes: async (p) => { await p.locator("button:has-text(\"Responder\")").first().click(); await p.waitForTimeout(300); },
    alvos: { primeiro: "ul > li >> nth=0", caixa: "form:has(textarea)", acoes: "ul > li >> nth=0 >> div.flex.flex-wrap.gap-2" },
  },
];
export default prints;
