import type { Print } from "../prints.mts";

const prints: Print[] = [
  { arquivo: "suporte-1", demo: "suporte", alvos: { botao: 'button:has-text("Passar")', casos: "ul >> nth=0" } },
  { arquivo: "suporte-2", demo: "suporte", antes: async (p: any) => { await p.getByRole("button", { name: /Passar/ }).first().click(); await p.waitForTimeout(400); } },
  { arquivo: "suporte-3", demo: "suporte", nivel: "gerente", alvos: { assumir: 'button:has-text("Assumir")', fechar: 'button:has-text("Fechar")' } },
  { arquivo: "suporte-4", demo: "suporte", antes: async (p: any) => { await p.getByText(/Seus casos fechados/).first().click(); await p.waitForTimeout(300); await p.getByText(/Seus casos fechados/).first().evaluate((e: HTMLElement) => e.scrollIntoView({ block: "start" })); await p.evaluate(() => window.scrollBy(0, -80)); }, alvos: { fechados: "text=Seus casos fechados", nota: "text=Combinei de repor" } },
];
export default prints;
