import type { Print } from "../prints.mts";

/** Rola até o elemento deixando folga para a barra de topo. */
const rolar = (seletor: string, folga = 90) => async (p: any) => {
  await p.locator(seletor).first().evaluate((e: HTMLElement, f: number) => window.scrollBy(0, e.getBoundingClientRect().top - f), folga);
};

const prints: Print[] = [
  {
    arquivo: "conteudos-1", demo: "conteudos", nivel: "diretoria",
    alvos: { novo: "button:has-text(\"Novo conteúdo\")", orfas: "section.glass >> nth=0", tabela: "table", editar: "a:has-text(\"Editar\") >> nth=0", publicar: "button:has-text(\"Publicar\") >> nth=0" },
  },
  {
    arquivo: "conteudos-2", demo: "conteudo-editor", nivel: "diretoria",
    alvos: { barra: "div.sticky", titulo: "section:has-text(\"Título da página\") >> nth=0", resposta: "section:has-text(\"Resposta rápida\") >> nth=0", analise: "text=Análise", resolver: "text=a resolver" },
  },
  {
    arquivo: "conteudos-3", demo: "conteudo-editor", nivel: "diretoria",
    antes: async (p) => { await rolar("text=Use títulos de seção para quebrar o texto", 240)(p); await p.locator(".ProseMirror p").first().click(); await p.waitForTimeout(300); },
    alvos: { conteudo: "div:has(> .ProseMirror)", editor: ".ProseMirror", mais: "button[aria-label*=\"nserir\"]" },
  },
  {
    arquivo: "conteudos-4", demo: "conteudo-editor", nivel: "diretoria", antes: rolar("text=De onde veio cada afirmação factual do texto", 240),
    alvos: { fontes: "div:has(> div:has-text(\"De onde veio cada afirmação\"))", buscar: "text=Buscar na base de fatos", registrar: "button:has-text(\"Registrar fonte\")", agendar: "text=Publicar em outra hora" },
  },
  {
    arquivo: "conteudos-5", demo: "conteudo-editor", nivel: "diretoria", antes: rolar("text=Publicar em outra hora", 240),
    alvos: { agendar: "div:has(> div:has-text(\"Publicar em outra hora\"))", data: "input[type=datetime-local]", botao: "button:has-text(\"Agendar\")", versoes: "text=Ver versões anteriores" },
  },
];
export default prints;
