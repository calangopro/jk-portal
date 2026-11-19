import type { Print } from "../prints.mts";

const prints: Print[] = [
  {
    arquivo: "saude-1",
    demo: "saude",
    nivel: "diretoria",
    alvos: {
      resumo: "[role=status]",
      destinos: "#titulo-destinos",
      integracoes: "text=Abrir Integrações",
      linhaRuim: "li:has-text('Destino Exemplo A')",
      linhaOQueFazer: "text=O que fazer >> nth=0",
    },
  },
  {
    arquivo: "saude-2",
    demo: "saude",
    nivel: "diretoria",
    antes: async (p: any) => {
      await p.locator("#titulo-rotinas").evaluate((e: Element) => e.scrollIntoView({ block: "start" }));
      await p.waitForTimeout(200);
    },
    alvos: { rotinas: "#titulo-rotinas", atencao: "li:has-text('Rotina Exemplo de gasto')", parada: "li:has-text('Rotina Exemplo das redes')", rodape: "p.max-w-3xl.text-\\[0\\.7rem\\]" },
  },
];
export default prints;
