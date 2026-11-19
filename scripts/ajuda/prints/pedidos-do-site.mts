import type { Print } from "../prints.mts";

const escolher = async (p: any) => {
  await p.getByRole("button", { name: /Marcar vários/ }).click();
  await p.getByRole("checkbox", { name: /11001/ }).click();
  await p.getByRole("checkbox", { name: /11003/ }).click();
  await p.waitForTimeout(200);
};

const prints: Print[] = [
  { arquivo: "pedidos-do-site-1", demo: "pedidos-do-site", alvos: { busca: "input[type=search], input[type=text]", filtros: "text=Sem vendedor", cartao1: "ul > li >> nth=0", fui: 'button:has-text("Fui eu que vendi") >> nth=0', hist: 'button:has-text("Histórico") >> nth=0', varios: 'button:has-text("Marcar vários")' } },
  { arquivo: "pedidos-do-site-2", demo: "pedidos-do-site", antes: escolher, alvos: { barra: "text=pedidos escolhidos" } },
  { arquivo: "pedidos-do-site-3", demo: "pedidos-do-site", nivel: "gerente", antes: escolher, alvos: { barra: "text=pedidos escolhidos", escolha: "select" } },
];
export default prints;
