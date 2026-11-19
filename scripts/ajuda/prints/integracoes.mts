import type { Print } from "../prints.mts";

const prints: Print[] = [
  {
    arquivo: "integracoes-1",
    demo: "integracoes",
    nivel: "diretoria",
    alvos: {
      cartaoDesligado: "form:has-text('Gerenciador de tags') >> nth=0",
      status: "text=Desconectado",
      campo: 'input[name="container_id"]',
      conectar: 'button:has-text("Conectar")',
      cartaoLigado: "form:has-text('Busca do Google') >> nth=0",
      statusLigado: "text=Conectado",
      desconectar: 'button:has-text("Desconectar")',
    },
  },
  {
    arquivo: "integracoes-2",
    demo: "integracoes",
    nivel: "diretoria",
    antes: async (p: any) => {
      await p.locator("h2:has-text('Para onde vão os contatos')").evaluate((e: Element) => e.scrollIntoView({ block: "start" }));
      await p.waitForTimeout(200);
    },
    alvos: {
      secao: "h2:has-text('Para onde vão os contatos')",
      semChave: "text=Sem chave",
      campoChave: 'input[name="valor"] >> nth=0',
      salvar: 'button:has-text("Salvar") >> nth=2',
      ligado: "span:has-text('Ligado')",
      campoLigado: 'input[name="valor"] >> nth=1',
      remover: 'button:has-text("Remover chave")',
      enviar: 'button:has-text("Enviar os 5 guardados")',
    },
  },
];
export default prints;
