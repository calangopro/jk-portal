import type { Print } from "../prints.mts";

const ate = (seletor: string, folga = 90) => async (p: any) => {
  await p.locator(seletor).first().evaluate((el: Element, f: number) => {
    const topo = el.getBoundingClientRect().top + window.scrollY - f;
    window.scrollTo(0, topo);
    document.querySelectorAll("main").forEach((m) => ((m as HTMLElement).scrollTop = Math.max(0, topo)));
  }, folga);
  await p.waitForTimeout(250);
};

const prints: Print[] = [
  { arquivo: "pedidos-da-loja-1", demo: "pedidos-da-loja", nivel: "gerente", alvos: { cartoes: 'section[aria-label="Hoje, ontem e o mês"]', hoje: 'text=Hoje, >> nth=0', aviso: "text=Pedidos lidos da Tray" } },
  { arquivo: "pedidos-da-loja-2", demo: "pedidos-da-loja", nivel: "gerente", antes: ate("text=No período"), alvos: { periodo: "text=No período", seletor: 'nav[aria-label="Período"]', cartoes: 'text=Faturamento pago >> nth=0', cancelados: "text=Cancelados >> nth=0" } },
  { arquivo: "pedidos-da-loja-3", demo: "pedidos-da-loja", nivel: "gerente", antes: ate("text=De onde vieram as vendas"), alvos: { origem: "text=De onde vieram as vendas", pagamento: "text=Forma de pagamento >> nth=0" } },
  { arquivo: "pedidos-da-loja-4", demo: "pedidos-da-loja", nivel: "gerente", antes: ate("text=Últimos pedidos do período"), alvos: { pedidos: "text=Últimos pedidos do período", numero: "tbody tr >> nth=-4" } },
];
export default prints;
