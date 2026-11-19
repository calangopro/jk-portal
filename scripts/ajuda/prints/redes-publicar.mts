import type { Print } from "../prints.mts";

const tirarDaFila = async (p: any) => {
  await p.getByRole("button", { name: /Tirar da fila/ }).first().click();
  await p.waitForTimeout(250);
};
const ondeEQuando = async (p: any) => {
  await p.getByRole("checkbox").first().check();
  await p.getByRole("checkbox").nth(1).check();
  await p.getByRole("radio", { name: "Agendar" }).click();
  await p.evaluate(() => document.getElementById("t-onde")?.scrollIntoView({ block: "start" }));
  await p.evaluate(() => window.scrollBy(0, -90));
  await p.waitForTimeout(300);
};
const texto = async (p: any) => {
  await p.evaluate(() => document.getElementById("t-texto")?.scrollIntoView({ block: "start" }));
  await p.evaluate(() => window.scrollBy(0, -90));
  await p.waitForTimeout(300);
};

const prints: Print[] = [
  { arquivo: "redes-publicar-1", demo: "redes-publicar", nivel: "diretoria", alvos: { abas: 'nav[aria-label="Situação dos posts"]', novo: 'a:has-text("Novo post")', cartao: "article >> nth=0", estados: "article >> nth=0 >> ul" } },
  { arquivo: "redes-publicar-2", demo: "redes-publicar", nivel: "diretoria", antes: tirarDaFila, alvos: { confirma: "text=O post sai da fila" } },
  { arquivo: "redes-publicar-3", demo: "redes-publicar-novo", nivel: "diretoria", alvos: { formato: "#t-formato", midia: "#t-midia", texto: "#t-texto", previa: 'aside[aria-label="Prévia"]' } },
  { arquivo: "redes-publicar-4", demo: "redes-publicar-novo", nivel: "diretoria", antes: ondeEQuando, alvos: { onde: "#t-onde", quando: "#t-quando", botoes: 'button:has-text("Salvar rascunho")' } },
];
export default prints;
