import type { Print } from "../prints.mts";

const rolar = (seletor: string) => async (p: any) => {
  await p.locator(seletor).first().evaluate((e: any) => e.scrollIntoView({ block: "start" }));
  await p.mouse.wheel(0, -90);
  await p.waitForTimeout(300);
};

const prints: Print[] = [
  { arquivo: "trafego-1", demo: "trafego", nivel: "trafego", alvos: { periodo: "nav[aria-label=Período]", campanhas: "a:has-text('Ver campanhas, conjuntos e anúncios')", cartoes: "div.grid >> nth=0", minimo: "text=Volta por R$ 1, no mínimo", maximo: "text=Volta por R$ 1, no máximo" } },
  { arquivo: "trafego-2", demo: "trafego", nivel: "trafego", antes: rolar("section[aria-label='Por plataforma']"), alvos: { plataforma: "section[aria-label='Por plataforma']", dia: "section[aria-label='Por dia']" } },
  { arquivo: "trafego-3", demo: "trafego", nivel: "trafego", antes: rolar("section[aria-label='Leitura automática']"), alvos: { leitura: "section[aria-label='Leitura automática']", lancar: "section[aria-label='Lançar gasto']", valor: "#gasto-valor", botao: "section[aria-label='Lançar gasto'] button" } },
];
export default prints;
