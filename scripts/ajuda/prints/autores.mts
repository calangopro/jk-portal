import type { Print } from "../prints.mts";

/** Rola até o elemento deixando folga para a barra de topo. */
const rolar = (seletor: string, folga = 90) => async (p: any) => {
  await p.locator(seletor).first().evaluate((e: HTMLElement, f: number) => window.scrollBy(0, e.getBoundingClientRect().top - f), folga);
};

const prints: Print[] = [
  {
    arquivo: "autores-1", demo: "autores", nivel: "diretoria",
    alvos: { aviso: "p:has-text(\"sem credencial preenchida\")", cadastrar: "section:has(h2:has-text(\"Cadastrar pessoa\"))", lista: "section:has(h2:has-text(\"Cadastradas\"))" },
  },
  {
    arquivo: "autores-2", demo: "autores", nivel: "diretoria",
    antes: async (p) => { await p.locator("details summary").first().click(); await rolar("details", 100)(p); },
    alvos: { aberto: "details", pagina: "a:has-text(\"Ver a página no site\")", ativo: "details button" },
  },
  {
    arquivo: "autores-3", demo: "autores", nivel: "diretoria",
    antes: async (p) => { await p.locator("details summary").first().click(); await p.evaluate(() => window.scrollTo(0, 99999)); await p.locator("details").first().evaluate((e: HTMLElement) => window.scrollBy(0, e.getBoundingClientRect().bottom - 640)); },
    alvos: { salvar: "button:has-text(\"Salvar alterações\")", pagina: "a:has-text(\"Ver a página no site\")", ativo: "details >> button >> nth=1" },
  },
];
export default prints;
