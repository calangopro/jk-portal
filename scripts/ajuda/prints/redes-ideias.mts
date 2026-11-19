import type { Print } from "../prints.mts";

const fontes = async (p: any) => {
  await p.evaluate(() => document.getElementById("t-fontes")?.scrollIntoView({ block: "start" }));
  await p.waitForTimeout(300);
};
const prints: Print[] = [
  { arquivo: "redes-ideias-1", demo: "redes-ideias", nivel: "diretoria", alvos: { form: "form", colunas: "#col-ideia", producao: "#col-produzindo", agendadas: "#col-agendada", cartao: "li#i1" } },
  { arquivo: "redes-ideias-2", demo: "redes-ideias", nivel: "diretoria", antes: fontes, alvos: { fontes: "#t-fontes", cartoes: "#t-fontes ~ div" } },
];
export default prints;
