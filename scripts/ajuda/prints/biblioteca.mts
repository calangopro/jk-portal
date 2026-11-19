import type { Print } from "../prints.mts";

const prints: Print[] = [
  { arquivo: "biblioteca-1", demo: "biblioteca", alvos: { busca: "input[type=search], input >> nth=0", sugerir: 'button:has-text("Sugerir")', primeira: "text=A aliança de prata escurece?" } },
  { arquivo: "biblioteca-2", demo: "biblioteca", antes: async (p: any) => { await p.getByText("A aliança de prata escurece?").first().click(); await p.waitForTimeout(400); } },
  { arquivo: "biblioteca-3", demo: "biblioteca", nivel: "diretoria", antes: async (p: any) => { await p.getByText("Dá para gravar um desenho na aliança?").first().click(); await p.waitForTimeout(400); } },
];
export default prints;
