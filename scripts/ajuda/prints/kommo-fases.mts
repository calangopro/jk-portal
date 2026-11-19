import type { Print } from "../prints.mts";

const prints: Print[] = [
  {
    arquivo: "kommo-fases-1",
    demo: "kommo-fases",
    nivel: "diretoria",
    alvos: {
      resumo: "text=etapas com fase por palpite",
      confirmar: 'button:has-text("Confirmar todos os palpites")',
      oQueE: "summary",
    },
  },
  {
    arquivo: "kommo-fases-2",
    demo: "kommo-fases",
    nivel: "diretoria",
    antes: async (p: any) => {
      await p.locator("summary").click();
      await p.waitForTimeout(200);
    },
    alvos: { explicacao: "details dl", funil: "h2 >> nth=0" },
  },
];
export default prints;
