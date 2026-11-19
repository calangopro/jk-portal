import type { Print } from "../prints.mts";

const prints: Print[] = [
  {
    arquivo: "kommo-automacoes-1",
    demo: "kommo-automacoes",
    nivel: "diretoria",
    alvos: {
      resumo: "text=1 de 4 ligada",
      cartaoRecuperacao: "li:has(h2:has-text('Recuperação de pedido'))",
      quando: "dt:has-text('Quando') >> nth=0",
      efeito: "dt:has-text('O que faz na Kommo') >> nth=0",
      selo: "text=Ligada >> nth=0",
    },
  },
  {
    arquivo: "kommo-automacoes-2",
    demo: "kommo-automacoes",
    nivel: "diretoria",
    antes: async (p: any) => {
      await p.getByLabel(/Conferi na Kommo/).first().check();
      await p.locator("#recuperacao-funil").evaluate((e: Element) => e.scrollIntoView({ block: "start" }));
      await p.evaluate(() => window.scrollBy(0, 0));
      await p.waitForTimeout(250);
    },
    alvos: {
      funil: "#recuperacao-funil",
      etapa: "#recuperacao-etapa",
      espera: "#recuperacao-espera",
      limite: "#recuperacao-limite",
      salvar: "li:has(h2:has-text('Recuperação de pedido')) button:has-text('Salvar')",
      aviso: "li:has(h2:has-text('Recuperação de pedido')) p:has-text('Antes de ligar')",
      confere: "li:has(h2:has-text('Recuperação de pedido')) label:has-text('Conferi na Kommo')",
      ligar: "li:has(h2:has-text('Recuperação de pedido')) button:has-text('Ligar')",
    },
  },
  {
    arquivo: "kommo-automacoes-3",
    demo: "kommo-automacoes",
    nivel: "diretoria",
    antes: async (p: any) => {
      await p.locator("#registro").evaluate((e: Element) => e.scrollIntoView({ block: "start" }));
      await p.waitForTimeout(250);
    },
    alvos: { registro: "#registro", filtro: "button:has-text('Recusas e erros')", lista: "ul.divide-y", recusa: "li:has-text('Recusado pela Kommo')" },
  },
];
export default prints;
