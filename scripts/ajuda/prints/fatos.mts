import type { Print } from "../prints.mts";

/** Rola até o elemento deixando folga para a barra de topo. */
const rolar = (seletor: string, folga = 90) => async (p: any) => {
  await p.locator(seletor).first().evaluate((e: HTMLElement, f: number) => window.scrollBy(0, e.getBoundingClientRect().top - f), folga);
};

const prints: Print[] = [
  {
    arquivo: "fatos-1", demo: "fatos", nivel: "diretoria",
    alvos: { cartoes: "dl", aviso: "p:has-text(\"ainda é citado\")", registrar: "section:has(h2:has-text(\"Registrar fato\"))" },
  },
  {
    arquivo: "fatos-2", demo: "fatos", nivel: "diretoria",
    antes: async (p) => { await rolar("h2:has-text(\"Materiais\")", 90)(p); await p.locator("details summary").first().click(); },
    alvos: { grupo: "h2:has-text(\"Materiais\")", fato: "details", status: "details summary span:nth-of-type(2)", usos: "details summary span:nth-of-type(3)", botaoStatus: "details select >> nth=0", afirmacao: "label:has-text(\"A afirmação\")" },
  },
];
export default prints;
