import type { Print } from "../prints.mts";

const para = (titulo: string) => async (p: any) => {
  await p.locator(`h2:has-text("${titulo}")`).evaluate((e: Element) => e.scrollIntoView({ block: "start" }));
  await p.waitForTimeout(200);
};

const prints: Print[] = [
  {
    arquivo: "conector-1",
    demo: "conector",
    nivel: "diretoria",
    alvos: {
      noClaude: "h2:has-text('No Claude (site e app)')",
      passos: "ol",
      endereco: "code >> nth=0",
      terminal: "h2:has-text('No Claude Code')",
    },
  },
  {
    arquivo: "conector-2",
    demo: "conector",
    nivel: "diretoria",
    antes: para("Acessos ligados"),
    alvos: {
      acessos: "h2:has-text('Acessos ligados')",
      tabela: "table >> nth=0",
      pode: "td:has-text('Só ler')",
      desligar: "button:has-text('Desligar') >> nth=0",
    },
  },
  {
    arquivo: "conector-3",
    demo: "conector",
    nivel: "diretoria",
    antes: para("O que o Claude fez"),
    alvos: {
      registro: "h2:has-text('O que o Claude fez')",
      tabela: "table >> nth=1",
      erro: "text=O texto tem travessão.",
    },
  },
];
export default prints;
