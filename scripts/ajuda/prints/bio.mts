import type { Print } from "../prints.mts";

const prints: Print[] = [
  { arquivo: "bio-1", demo: "bio", nivel: "diretoria", alvos: { publicar: 'button:has-text("Publicar")', abas: "[role=tablist]", normal: "#aba-normal", campanha: "[role=tab] >> nth=1", novaCampanha: 'button:has-text("Nova campanha")', cartao: "[role=tabpanel] li >> nth=0", previa: "text=Normal: no ar agora >> xpath=.." } },
  {
    arquivo: "bio-2", demo: "bio", nivel: "diretoria",
    antes: async (p: any) => { await p.locator("[role=tab]").nth(1).click(); await p.waitForTimeout(400); await p.locator("[role=tablist]").evaluate((e: HTMLElement) => { e.scrollIntoView({ block: "start" }); window.scrollBy(0, -90); }); },
    alvos: { abas: "[role=tablist]", config: "section:has(h2:has-text('Campanha Oferta Exemplo')), div:has(> h2:has-text('Campanha Oferta Exemplo'))", ligada: "text=Campanha ligada" },
  },
  {
    arquivo: "bio-3", demo: "bio", nivel: "diretoria",
    antes: async (p: any) => { await p.getByText("Adicionar nesta aba:").evaluate((e: HTMLElement) => { e.scrollIntoView({ block: "center" }); }); },
    alvos: { adicionar: "text=Adicionar nesta aba: >> xpath=..", cartoes: "[role=tabpanel] li >> nth=0", alca: "[role=tabpanel] li >> nth=0 >> button >> nth=0" },
  },
];
export default prints;
