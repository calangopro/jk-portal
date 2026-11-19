import type { Print } from "../prints.mts";

const prints: Print[] = [
  { arquivo: "vendas-da-kommo-1", demo: "vendas-da-kommo", alvos: { resumo: "text=Pedidos do site marcados", fila: "text=Fila de conferência" } },
  { arquivo: "vendas-da-kommo-2", demo: "vendas-da-kommo", antes: async (p: any) => { await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); } },
  { arquivo: "vendas-da-kommo-3", demo: "vendas-da-kommo", nivel: "gerente", antes: async (p: any) => { await p.getByText("Fila de conferência").first().evaluate((e: HTMLElement) => e.scrollIntoView({ block: "start" })); }, alvos: { fila: "text=Fila de conferência", botoes: "button:has-text('Marcar o pedido')" } },
];
export default prints;
