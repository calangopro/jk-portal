import type { Print } from "../prints.mts";

const prints: Print[] = [
  { arquivo: "oportunidades-1", demo: "oportunidades", alvos: { cartoes: "div.grid >> nth=0", lista: "text=Cliente Exemplo Um" } },
  { arquivo: "oportunidades-2", demo: "oportunidades", antes: async (p: any) => { await p.getByText("Cliente Exemplo Dois").first().evaluate((e: HTMLElement) => e.scrollIntoView({ block: "center" })); }, alvos: { dois: "text=Cliente Exemplo Dois", whats: "text=WhatsApp >> nth=0", falei: "text=Já falei >> nth=0", naovale: "text=Não vale >> nth=0" } },
];
export default prints;
