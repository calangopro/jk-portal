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
  { arquivo: "vendedores-1", demo: "vendedores", nivel: "gerente", alvos: { periodo: 'nav[aria-label="Período"]', cartoes: "text=Quem mais vendeu", aviso: "text=ainda sem vendedor marcado" } },
  { arquivo: "vendedores-2", demo: "vendedores", nivel: "gerente", antes: ate('section[aria-label="Por vendedor"]', 330), alvos: { tabela: 'section[aria-label="Por vendedor"]', primeiro: "tbody tr >> nth=0", deonde: "th:has-text('De onde')" } },
];
export default prints;
