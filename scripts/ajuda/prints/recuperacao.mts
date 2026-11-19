import type { Print } from "../prints.mts";

const ate = (seletor: string, folga = 90) => async (p: any) => {
  await p.locator(seletor).first().evaluate((el: Element, f: number) => {
    const topo = el.getBoundingClientRect().top + window.scrollY - f;
    window.scrollTo(0, topo);
    document.querySelectorAll("main").forEach((m) => ((m as HTMLElement).scrollTop = Math.max(0, topo)));
  }, folga);
  await p.waitForTimeout(250);
};
const abrirPagou = async (p: any) => {
  await p.locator("#para-chamar").evaluate((el: Element) => el.scrollIntoView());
  await p.locator("summary:has-text('Pagou por fora da loja')").first().click();
  await p.waitForTimeout(250);
};

const prints: Print[] = [
  { arquivo: "recuperacao-1", demo: "recuperacao", nivel: "gerente", alvos: { periodo: 'nav[aria-label="Período"]', cartoes: "text=Para chamar >> nth=0", taxa: "text=voltou" } },
  { arquivo: "recuperacao-2", demo: "recuperacao", nivel: "gerente", antes: ate("#para-chamar", 100), alvos: { caso: "#para-chamar ~ ul > li >> nth=0", contatos: "text=Abrir no WhatsApp >> nth=0", kommo: "text=Procurar na Kommo >> nth=0", ficha: "text=Ficha do cliente >> nth=0" } },
  { arquivo: "recuperacao-3", demo: "recuperacao", nivel: "gerente", antes: abrirPagou, alvos: { botoes: "button:has-text('Estou falando com a pessoa') >> nth=0", pagou: "summary:has-text('Pagou por fora da loja') >> nth=0", tirar: "summary:has-text('Tirar da fila') >> nth=0", form: "input[name=valor] >> nth=0" } },
];
export default prints;
