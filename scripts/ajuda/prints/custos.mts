import type { Print } from "../prints.mts";

const prints: Print[] = [
  { arquivo: "custos-1", demo: "custos", nivel: "diretoria", alvos: { cartoes: "div.grid >> nth=0", nota: "text=Ainda falta nesta conta", anuncio: "text=Anúncio no mês" } },
  {
    arquivo: "custos-2", demo: "custos", nivel: "diretoria",
    antes: async (p: any) => { await p.locator("summary:has-text('Adicionar um custo')").click(); await p.waitForTimeout(300); },
    alvos: { adicionar: "summary:has-text('Adicionar um custo')", formulario: "details:has(summary:has-text('Adicionar um custo'))" },
  },
  {
    arquivo: "custos-3", demo: "custos", nivel: "diretoria",
    antes: async (p: any) => { await p.locator("#todo-mes").evaluate((e: any) => e.scrollIntoView({ block: "start" })); await p.mouse.wheel(0, -90); await p.waitForTimeout(300); },
    alvos: { grupo: "#todo-mes ~ div >> nth=0", anexar: "text=Anexar >> nth=0", alterar: "summary:has-text('Alterar') >> nth=0", desativar: "button:has-text('Desativar') >> nth=0" },
  },
];
export default prints;
