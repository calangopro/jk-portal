import type { Print } from "../prints.mts";

/** Rola até o elemento deixando folga para a barra de topo. */
const rolar = (seletor: string, folga = 90) => async (p: any) => {
  await p.locator(seletor).first().evaluate((e: HTMLElement, f: number) => window.scrollBy(0, e.getBoundingClientRect().top - f), folga);
};

const prints: Print[] = [
  {
    arquivo: "midia-1", demo: "midia", nivel: "diretoria",
    alvos: { envio: "button:has-text(\"Escolher imagens\")", aviso: "p:has-text(\"sem texto alternativo\")", semAlt: "span:has-text(\"Falta o alt\")" },
  },
  {
    arquivo: "midia-2", demo: "midia", nivel: "diretoria", antes: rolar("label:has-text(\"Texto alternativo\")", 330),
    alvos: { alt: "label:has-text(\"Texto alternativo\")", cartao: "form >> nth=0", copiar: "button:has-text(\"Copiar\")" },
  },
];
export default prints;
