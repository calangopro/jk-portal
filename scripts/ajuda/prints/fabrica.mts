import type { Print } from "../prints.mts";

const rolar = async (p: any) => {
  await p.evaluate(() => (document.querySelector("main") ?? window).scrollTo?.(0, 420));
  await p.evaluate(() => window.scrollTo(0, 420));
  await p.waitForTimeout(200);
};
const varios = async (p: any) => {
  await p.getByRole("button", { name: /Marcar vários/ }).click();
  await p.getByRole("checkbox").first().click();
  await p.getByRole("checkbox").nth(1).click();
  await p.waitForTimeout(200);
};

const prints: Print[] = [
  { arquivo: "fabrica-1", demo: "fabrica", nivel: "gerente", alvos: { etapas: 'nav[aria-label="Etapas"]', busca: 'input[placeholder^="Buscar"]', filtros: 'div[aria-label="Filtrar a lista"]', varios: 'button:has-text("Marcar vários")' } },
  { arquivo: "fabrica-2", demo: "fabrica", nivel: "gerente", antes: rolar, alvos: { botoes: 'button:has-text("Mudar etapa") >> nth=0', texto: "text=Gravação >> nth=0" } },
  { arquivo: "fabrica-3", demo: "fabrica", nivel: "gerente", antes: varios, alvos: { barra: "text=escolhidos" } },
];
export default prints;
