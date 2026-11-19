import type { Print } from "../prints.mts";

const prints: Print[] = [
  { arquivo: "grupo-1", demo: "grupo", nivel: "diretoria", alvos: { destino: 'label:has-text("Link do grupo")', visual: 'label:has-text("Visual da página")', links: "section:has-text('Links para divulgar')" } },
  {
    arquivo: "grupo-2", demo: "grupo", nivel: "diretoria",
    antes: async (p: any) => { await p.getByRole("heading", { name: "Últimos 30 dias" }).evaluate((e: HTMLElement) => { e.scrollIntoView({ block: "start" }); window.scrollBy(0, -90); }); },
    alvos: { numeros: "dl", filtros: 'nav[aria-label="Filtrar contatos"]', csv: 'a:has-text("Baixar planilha")', tabela: "table", envios: "td >> nth=4" },
  },
];
export default prints;
