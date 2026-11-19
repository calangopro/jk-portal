import type { Print } from "../prints.mts";

const rolarAteAdicionar = async (p: any) => {
  await p.getByText("Adicionar produtos").scrollIntoViewIfNeeded();
  await p.evaluate(() => window.scrollBy(0, 200));
  await p.waitForTimeout(200);
};

const prints: Print[] = [
  { arquivo: "campanhas-1", demo: "campanhas", nivel: "gerente", alvos: { nova: 'form:has(input[name="nome"])', lista: "ul >> nth=-1", alerta: "text=abaixo da margem" } },
  { arquivo: "campanhas-2", demo: "campanhas-editor", nivel: "gerente", alvos: { numeros: "section.grid", ferramentas: 'label:has-text("Desconto para todos")', tabela: "table", mandar: 'button:has-text("Mandar para aprovação")', situacao: "text=Monte os preços" } },
  { arquivo: "campanhas-3", demo: "campanhas-editor", nivel: "gerente", antes: rolarAteAdicionar, alvos: { adicionar: "text=Adicionar produtos", busca: 'input[placeholder^="Buscar por nome"]' } },
  { arquivo: "campanhas-4", demo: "campanhas-aprovar", nivel: "diretoria", alvos: { aviso: "text=abaixo da margem mínima", nota: "textarea", aprovar: 'button:has-text("Aprovar")', devolver: 'button:has-text("Devolver para ajuste")', tabela: "table" } },
];
export default prints;
