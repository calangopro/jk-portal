import type { Print } from "../prints.mts";

const rolar = (seletor: string) => async (p: any) => {
  await p.locator(seletor).first().evaluate((e: any) => e.scrollIntoView({ block: "start" }));
  await p.mouse.wheel(0, -90);
  await p.waitForTimeout(300);
};

const prints: Print[] = [
  { arquivo: "anuncios-1", demo: "anuncios", nivel: "diretoria", alvos: { cenario: "div[aria-label='Cenário de preço']", numeros: "section.grid >> nth=0", margem: "text=CPA máximo mantém" } },
  {
    arquivo: "anuncios-2", demo: "anuncios", nivel: "diretoria",
    antes: async (p: any) => { await p.getByRole("radio", { name: "Com desconto de campanha" }).click(); await p.locator("input[aria-label='Desconto sobre o preço cheio']").fill("10"); await p.waitForTimeout(300); },
    alvos: { cenario: "div[aria-label='Cenário de preço']", desconto: "input[aria-label='Desconto sobre o preço cheio']" },
  },
  { arquivo: "anuncios-3", demo: "anuncios", nivel: "diretoria", antes: rolar("div.glass:has-text('Onde vale anunciar')"), alvos: { vale: "div.glass:has-text('Onde vale anunciar') >> nth=0", nao: "div.glass:has-text('Não anuncie neste preço') >> nth=0", busca: "input[placeholder^='Buscar']", ordem: "select[aria-label=Ordem]", csv: "button:has-text('Baixar para o gerenciador')", tabela: "table" } },
];
export default prints;
