import type { Print } from "../prints.mts";

/** Rola até o elemento deixando folga para a barra de topo. */
const rolar = (seletor: string, folga = 90) => async (p: any) => {
  await p.locator(seletor).first().evaluate((e: HTMLElement, f: number) => window.scrollBy(0, e.getBoundingClientRect().top - f), folga);
};

const prints: Print[] = [
  {
    arquivo: "metricas-1", demo: "metricas", nivel: "diretoria",
    alvos: { periodos: "nav[aria-label=\"Período\"]", cartoes: "section.mt-8 > div.grid >> nth=0", origens: "div.glass:has(p:has-text(\"De onde vieram\"))", ia: "div.glass:has(p:has-text(\"Vindas de respostas de IA\"))" },
  },
  {
    arquivo: "metricas-2", demo: "metricas", nivel: "diretoria", antes: rolar("h2:has-text(\"Search Console\")", 70),
    alvos: { cabecalho: "h2:has-text(\"Search Console\")", cartoes: "section.mt-8.grid", perto: "div.glass:has(p:has-text(\"Perto da primeira página\"))", ctr: "div.glass:has(p:has-text(\"Aparece, mas não clicam\"))" },
  },
  {
    arquivo: "metricas-3", demo: "metricas", nivel: "diretoria", antes: async (p) => { await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); },
    alvos: { importar: "section.mt-6.grid >> div >> nth=0", automatico: "button:has-text(\"Importar agora\")" },
  },
];
export default prints;
