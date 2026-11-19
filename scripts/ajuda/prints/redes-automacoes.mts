import type { Print } from "../prints.mts";

const nova = async (p: any) => {
  await p.getByRole("button", { name: /Nova regra/ }).click();
  await p.getByLabel("Nome da regra").fill("Preço");
  await p.getByLabel("Palavras que disparam a resposta").fill("preço, valor, quanto custa");
  await p.getByLabel("Resposta, exatamente como vai sair").fill("Oi! Os valores ficam na página de cada produto, no link da bio.");
  await p.waitForTimeout(250);
};
const ligar = async (p: any) => {
  await p.getByRole("button", { name: "Ligar", exact: true }).first().click();
  await p.waitForTimeout(250);
  await p.getByText("A partir de agora").scrollIntoViewIfNeeded();
  await p.evaluate(() => window.scrollBy(0, 260));
  await p.waitForTimeout(250);
};
const fimDoFormulario = async (p: any) => {
  await nova(p);
  await p.getByRole("button", { name: "Criar, desligada" }).scrollIntoViewIfNeeded();
  await p.evaluate(() => window.scrollBy(0, 120));
  await p.waitForTimeout(250);
};

const prints: Print[] = [
  { arquivo: "redes-automacoes-1", demo: "redes-automacoes", nivel: "diretoria", alvos: { aviso: "text=A JK já usa o ManyChat", regra: "li.glass >> nth=0", palavras: "text=Quando comentarem >> nth=0", resposta: "text=A JK responde, em público >> nth=0", botoes: 'button:has-text("Ligar") >> nth=0', estado: "text=Desligada >> nth=0" } },
  { arquivo: "redes-automacoes-2", demo: "redes-automacoes", nivel: "diretoria", antes: nova, alvos: { form: "h2:has-text('Nova regra') >> xpath=..", salvar: 'button:has-text("Criar, desligada")', palavras: "text=Palavras que disparam a resposta", resposta: "text=Resposta, exatamente como vai sair" } },
  { arquivo: "redes-automacoes-3", demo: "redes-automacoes", nivel: "diretoria", antes: ligar, alvos: { confirma: "text=A partir de agora", simligar: 'button:has-text("Sim, ligar a regra")', manychat: "text=Se o ManyChat já responde" } },
  { arquivo: "redes-automacoes-5", demo: "redes-automacoes", nivel: "diretoria", antes: fimDoFormulario, alvos: { onde: "text=Onde vale", espera: "text=Esperar antes de responder", limite: "text=No máximo por hora", criar: 'button:has-text("Criar, desligada")' } },
  { arquivo: "redes-automacoes-4", demo: "redes-automacoes-sem-ligar", nivel: "diretoria", alvos: { aviso: "text=Ligar é de administrador >> nth=0", editar: 'button:has-text("Editar") >> nth=0' } },
];
export default prints;
