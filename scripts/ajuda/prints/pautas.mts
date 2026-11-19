import type { Print } from "../prints.mts";

/** Rola até o elemento deixando folga para a barra de topo. */
const rolar = (seletor: string, folga = 90) => async (p: any) => {
  await p.locator(seletor).first().evaluate((e: HTMLElement, f: number) => window.scrollBy(0, e.getBoundingClientRect().top - f), folga);
};

const prints: Print[] = [
  {
    arquivo: "pautas-1", demo: "pautas", nivel: "diretoria",
    alvos: { cartoes: "dl", oportunidade: "h2:has-text(\"Oportunidades\") ~ div >> li >> nth=0", virar: "button:has-text(\"Virar pauta\")" },
  },
  {
    arquivo: "pautas-2", demo: "pautas", nivel: "diretoria", antes: rolar("h2:has-text(\"Pauta escrita à mão\")", 90),
    alvos: { form: "section:has(h2:has-text(\"Pauta escrita à mão\"))" },
  },
  {
    arquivo: "pautas-3", demo: "pautas", nivel: "diretoria", antes: rolar("h2:has-text(\"Fila (\")", 90),
    alvos: { fila: "h2:has-text(\"Fila (\")", primeira: "li.glass >> nth=0", rascunho: "button:has-text(\"Virar rascunho\") >> nth=0", abrir: "a:has-text(\"Abrir o rascunho\")" },
  },
];
export default prints;
