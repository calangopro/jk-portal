import type { Print } from "../prints.mts";

const prints: Print[] = [
  { arquivo: "aparencia-1", demo: "aparencia", nivel: "diretoria", alvos: { cores: "section >> nth=0", legibilidade: "section:has(h2:has-text('Legibilidade'))", amostra: "text=Como vai ficar >> xpath=..", salvar: 'button:has-text("Salvar aparência")', padrao: 'button:has-text("Voltar ao padrão da marca")' } },
  {
    arquivo: "aparencia-2", demo: "aparencia", nivel: "diretoria",
    antes: async (p: any) => { await p.getByRole("heading", { name: "Cantos" }).evaluate((e: HTMLElement) => { e.scrollIntoView({ block: "start" }); window.scrollBy(0, -90); }); },
    alvos: { cantos: "section:has(h2:has-text('Cantos'))", salvar: 'button:has-text("Salvar aparência")' },
  },
];
export default prints;
