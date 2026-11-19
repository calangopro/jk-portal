import type { Print } from "../prints.mts";

const prints: Print[] = [
  { arquivo: "visao-geral-1", demo: "visao-geral", nivel: "trafego", alvos: { titulo: "h1", salas: "section[aria-label=Setores]", chat: "section[aria-label^='O que espera você no chat']", avisos: "section[aria-label='O que pede atenção']" } },
  { arquivo: "visao-geral-2", demo: "visao-geral", nivel: "diretoria", alvos: { meta: "section[aria-label='Meta do mês']", mudar: "text=Mudar a meta", salas: "section[aria-label=Setores]" } },
  {
    arquivo: "visao-geral-3", demo: "visao-geral", nivel: "diretoria",
    antes: async (p: any) => { await p.locator("section[aria-label='Resultado do mês']").evaluate((e: any) => e.scrollIntoView({ block: "start" })); await p.mouse.wheel(0, -90); await p.waitForTimeout(300); },
    alvos: { resultado: "section[aria-label='Resultado do mês']", numeros: "section[aria-label='Números do período']", problemas: "section[aria-label='Problemas e oportunidades']" },
  },
];
export default prints;
