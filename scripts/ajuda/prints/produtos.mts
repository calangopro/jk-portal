import type { Print } from "../prints.mts";

/** Espera a gaveta ler o produto na loja (o formulário aparece depois de uns 400 ms). */
const formulario = async (p: any) => {
  await p.getByText("Nome, preço e estoque").waitFor({ timeout: 20000 });
  await p.waitForTimeout(300);
};
const mudarEstoque = async (p: any) => {
  await formulario(p);
  await p.getByText("Estoque", { exact: true }).locator("xpath=following-sibling::input").fill("12");
  await p.getByRole("button", { name: "Conferir mudanças" }).click();
  await p.getByText("Confira antes de gravar na loja").waitFor();
  await p.getByRole("button", { name: "Gravar na loja" }).scrollIntoViewIfNeeded();
  await p.waitForTimeout(300);
};
const mudarPreco = async (p: any) => {
  await formulario(p);
  await p.getByText("Preço promocional", { exact: true }).locator("xpath=following-sibling::input").fill("2700");
  await p.getByText("Promoção de", { exact: true }).scrollIntoViewIfNeeded();
  await p.waitForTimeout(300);
};
const conferirPromocao = async (p: any) => {
  await mudarPreco(p);
  await p.getByRole("button", { name: "Conferir mudanças" }).click();
  await p.getByText("Confira antes de gravar na loja").waitFor();
  await p.getByRole("button", { name: "Gravar na loja" }).scrollIntoViewIfNeeded();
  await p.waitForTimeout(300);
};
const abaCusto = async (p: any) => {
  await p.getByRole("tab", { name: "Custo" }).click();
  await p.waitForTimeout(300);
};

const prints: Print[] = [
  { arquivo: "produtos-1", demo: "produtos", nivel: "gerente", alvos: { modos: 'div[role="tablist"] >> nth=0', busca: 'input[placeholder^="Buscar"]', filtros: 'label:has-text("Só disponíveis")', categoria: 'button[aria-expanded="true"]', linha: "text=Par de alianças de ouro 18k >> nth=0" } },
  { arquivo: "produtos-2", demo: "produtos", nivel: "gerente", consulta: "p=1001", antes: formulario, alvos: { abas: 'div[role="tablist"] >> nth=1', dados: "text=Preço na loja", editar: 'section[aria-label="Editar na loja"]', grupo: "text=Nome, preço e estoque" } },
  { arquivo: "produtos-3", demo: "produtos", nivel: "gerente", consulta: "p=1001", antes: mudarEstoque, alvos: { conferir: 'div[role="group"][aria-label="Conferir antes de gravar"]', gravar: 'button:has-text("Gravar na loja")' } },
  { arquivo: "produtos-4", demo: "produtos", nivel: "diretoria", consulta: "p=1001", antes: mudarPreco, alvos: { preco: "text=Preço >> nth=0", promo: "text=Preço promocional", datas: "text=Promoção de", conferir: 'button:has-text("Conferir mudanças")' } },
  { arquivo: "produtos-5", demo: "produtos", nivel: "diretoria", consulta: "p=1001", antes: abaCusto, alvos: { custo: "text=Custo e margem", abas: 'div[role="tablist"] >> nth=1' } },
  { arquivo: "produtos-7", demo: "produtos", nivel: "diretoria", consulta: "p=1001", antes: conferirPromocao, alvos: { conferir: 'div[role="group"][aria-label="Conferir antes de gravar"]' } },
  { arquivo: "produtos-6", demo: "produtos", nivel: "gerente", consulta: "aba=fotos", alvos: { resumo: "text=resolvidos", filtros: 'div[aria-label="Filtrar por estado da foto"]', modos: 'div[role="tablist"] >> nth=0' } },
];
export default prints;
