import type { Print } from "../prints.mts";

/** Rola até o elemento e o deixa perto do topo da área de conteúdo. */
const ate = (seletor: string, folga = 90) => async (p: any) => {
  await p.locator(seletor).first().evaluate((el: Element, f: number) => {
    const topo = el.getBoundingClientRect().top + window.scrollY - f;
    window.scrollTo(0, topo);
    document.querySelectorAll("main, [data-painel-rolagem]").forEach((m) => ((m as HTMLElement).scrollTop = Math.max(0, topo)));
  }, folga);
  await p.waitForTimeout(250);
};

const prints: Print[] = [
  { arquivo: "funil-da-kommo-1", demo: "funil-da-kommo", nivel: "gerente", alvos: { alertas: 'section[aria-label="Alertas"]', esperando: 'a:has-text("Esperando vendedor")', semresposta: 'a:has-text("Cliente sem resposta")', filtros: 'form[aria-label="Filtros do funil"]' } },
  { arquivo: "funil-da-kommo-2", demo: "funil-da-kommo", nivel: "gerente", antes: ate('div:has-text("Abertos agora") >> nth=-1', 60), alvos: { cartoes: 'text=Abertos agora', fases: 'section[aria-label="Abertos por fase"]' } },
  { arquivo: "funil-da-kommo-3", demo: "funil-da-kommo", nivel: "gerente", antes: ate('section[aria-label="Motivos de perda"]', 80), alvos: { motivos: 'section[aria-label="Motivos de perda"]', lista: 'section[aria-label="Parados há mais tempo"]', abrir: 'a:has-text("Abrir na Kommo") >> nth=0' } },
];
export default prints;
