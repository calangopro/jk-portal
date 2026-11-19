import type { Print } from "../prints.mts";

const rolar = (seletor: string) => async (p: any) => {
  await p.evaluate(() => document.querySelectorAll("p").forEach((e) => { if (e.textContent?.includes("colunas do WhatsApp")) (e as HTMLElement).style.display = "none"; }));
  await p.locator(seletor).first().evaluate((e: any) => e.scrollIntoView({ block: "start" }));
  await p.mouse.wheel(0, -90);
  await p.waitForTimeout(300);
};

const prints: Print[] = [
  { arquivo: "trafego-campanhas-1", demo: "trafego-campanhas", nivel: "trafego", alvos: { plataforma: "nav[aria-label=Plataforma]", periodo: "nav[aria-label=Período]", resumo: "section[aria-label='Resumo do período']" } },
  { arquivo: "trafego-campanhas-2", demo: "trafego-campanhas", nivel: "trafego", antes: rolar("section[aria-label='Vencedores: tem espaço para crescer']"), alvos: { vencedores: "section[aria-label='Vencedores: tem espaço para crescer']", rever: "section[aria-label='Para rever ou pausar']" } },
  {
    arquivo: "trafego-campanhas-3", demo: "trafego-campanhas", nivel: "trafego",
    antes: async (p: any) => { await p.getByRole("button", { name: /Campanha Exemplo Vendas/ }).first().click().catch(() => {}); await p.waitForTimeout(300); await rolar("table")(p); },
    alvos: { tabela: "table" },
  },
];
export default prints;
