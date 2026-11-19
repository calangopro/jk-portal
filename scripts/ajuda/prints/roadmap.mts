import type { Print } from "../prints.mts";

const prints: Print[] = [
  {
    arquivo: "roadmap-1",
    demo: "roadmap",
    nivel: "diretoria",
    alvos: {
      novo: 'button:has-text("Novo cartão")',
      emTrabalho: "section[aria-label='Em trabalho agora']",
      aviso: "[role=status]",
      filtros: "section[aria-label='Filtros']",
    },
  },
  {
    arquivo: "roadmap-2",
    demo: "roadmap",
    nivel: "diretoria",
    antes: async (p: any) => {
      await p.locator("#coluna-fazendo").evaluate((e: Element) => e.scrollIntoView({ block: "start" }));
      await p.waitForTimeout(200);
    },
    alvos: {
      colunas: "div.xl\\:grid-cols-5",
      fazendo: "#coluna-fazendo",
      cartao1: "li:has-text('ajustar a tela de pedidos') button",
      cruza: "text=Cruza com",
      revisao: "#coluna-em_revisao",
    },
  },
  {
    arquivo: "roadmap-3",
    demo: "roadmap",
    nivel: "diretoria",
    antes: async (p: any) => {
      await p.locator("li:has-text('ajustar a tela de pedidos') button").first().click();
      await p.waitForTimeout(800);
    },
    alvos: { gaveta: "dialog, [role=dialog]", titulo: "text=Cartão 1" },
  },
];
export default prints;
