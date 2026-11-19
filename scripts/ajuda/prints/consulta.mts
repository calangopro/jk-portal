import type { Print } from "../prints.mts";

const aba = (nome: RegExp) => async (p: any) => { await p.getByRole("tab", { name: nome }).first().click(); await p.waitForTimeout(300); };

const prints: Print[] = [
  { arquivo: "consulta-1", demo: "consulta", alvos: { abas: "[role=tablist]", busca: "input[type=search]" } },
  { arquivo: "consulta-2", demo: "consulta", antes: async (p: any) => { await p.locator("input[type=search]").fill("ouro"); await p.waitForTimeout(300); await p.getByText("Par de alianças de ouro 18k, 4 mm").first().click(); await p.waitForTimeout(300); } },
  { arquivo: "consulta-3", demo: "consulta", antes: aba(/^Prazo/) },
  { arquivo: "consulta-4", demo: "consulta", antes: aba(/^Lojas/) },
];
export default prints;
