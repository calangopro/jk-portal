import type { Print } from "../prints.mts";

const nolugar = async (p: any) => {
  await p.locator("section[aria-labelledby=vendas-do-mes]").scrollIntoViewIfNeeded();
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
};

const prints: Print[] = [
  {
    arquivo: "registrar-venda-1", demo: "registrar-venda",
    alvos: { cartoes: "div.grid.gap-5", valor: 'label:has-text("Valor recebido")', pagou: 'label:has-text("Como pagou")', cliente: 'label:has-text("Nome do cliente")', zap: 'label:has-text("WhatsApp do cliente")', oque: 'label:has-text("O que vendeu")', veio: 'label:has-text("Por onde veio")', dia: 'label:has-text("Dia da venda")' },
  },
  {
    arquivo: "registrar-venda-2", demo: "registrar-venda", antes: nolugar,
    alvos: { fabrica: 'label:has-text("Mandar para a fábrica")', registrar: 'button:has-text("Registrar venda")', lista: "section[aria-labelledby=vendas-do-mes]", estorno: "text=Venda lançada errada" },
  },
  { arquivo: "registrar-venda-3", demo: "registrar-venda", nivel: "gerente", antes: async (p) => { await p.locator('label:has-text("Quem vendeu")').evaluate((e: HTMLElement) => e.scrollIntoView({ block: "center" })); }, alvos: { vendedor: 'label:has-text("Quem vendeu")', nova: "section[aria-labelledby=nova-venda]" } },
];
export default prints;
