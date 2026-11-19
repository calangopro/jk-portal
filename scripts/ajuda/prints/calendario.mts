import type { Print } from "../prints.mts";

/** Rola até o elemento deixando folga para a barra de topo. */
const rolar = (seletor: string, folga = 90) => async (p: any) => {
  await p.locator(seletor).first().evaluate((e: HTMLElement, f: number) => window.scrollBy(0, e.getBoundingClientRect().top - f), folga);
};

const prints: Print[] = [
  {
    arquivo: "calendario-1", demo: "calendario", nivel: "diretoria",
    alvos: { aviso: "p:has-text(\"passou da hora marcada\")", nav: "nav[aria-label=\"Navegar entre meses\"]", grade: "div.grid.grid-cols-7", hoje: "div.border-brand.bg-brand\\/5" },
  },
  {
    arquivo: "calendario-2", demo: "calendario", nivel: "diretoria", antes: rolar("h2:has-text(\"Escrito, sem data\")", 90),
    alvos: { legenda: "p:has-text(\"publicado\")", semdata: "div:has(> h2:has-text(\"Escrito, sem data\"))", pautas: "div:has(> h2:has-text(\"Pautas esperando\"))" },
  },
];
export default prints;
