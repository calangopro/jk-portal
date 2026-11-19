import type { Print } from "../prints.mts";

const naSemLigacao = async (p: any) => {
  await p.locator("text=Sem ligação (palpite abaixo)").first().evaluate((e: Element) => e.scrollIntoView({ block: "center" }));
  await p.waitForTimeout(200);
};

const prints: Print[] = [
  {
    arquivo: "kommo-1",
    demo: "kommo",
    nivel: "diretoria",
    alvos: {
      resumo: "text=usuários ativos ainda sem ligação, text=usuário ativo ainda sem ligação",
      linha1: "ul > li >> nth=0",
      papel: "select >> nth=0",
      pessoa: "select >> nth=1",
      loja: "select >> nth=2",
      salvar: 'button:has-text("Salvar") >> nth=0',
    },
  },
  {
    arquivo: "kommo-2",
    demo: "kommo",
    nivel: "diretoria",
    antes: naSemLigacao,
    alvos: {
      semLigacao: "text=Sem ligação (palpite abaixo)",
      linhaPalpite: "li:has-text('LOJA EXEMPLO NORTE')",
      papel: "li:has-text('LOJA EXEMPLO NORTE') select >> nth=0",
      loja: "li:has-text('LOJA EXEMPLO NORTE') select >> nth=2",
      salvar: "li:has-text('LOJA EXEMPLO NORTE') button:has-text('Salvar')",
      desativados: "summary",
    },
  },
];
export default prints;
