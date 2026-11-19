import type { Print } from "../prints.mts";

const faixa = (n: number) => `li:has(button[aria-label^="Mover"]) >> nth=${n}`;

const prints: Print[] = [
  { arquivo: "home-1", demo: "home", nivel: "diretoria", alvos: { faixa: faixa(0), titulo: 'label:has-text("Título") >> xpath=..', salvar: 'button:has-text("Salvar a home")', ver: 'a:has-text("Ver a home")', voltar: 'button:has-text("Voltar ao padrão")' } },
  {
    arquivo: "home-2", demo: "home", nivel: "diretoria",
    antes: async (p: any) => { await p.locator('li:has(button[aria-label^="Mover"])').nth(3).evaluate((e: HTMLElement) => { e.scrollIntoView({ block: "start" }); window.scrollBy(0, -175); }); },
    alvos: { cartao: faixa(3), alca: `${faixa(3)} >> button[aria-label^="Mover"]`, olho: `${faixa(3)} >> button[title]` },
  },
];
export default prints;
