import type { Print } from "../prints.mts";

const abrirJanela = async (p: any) => {
  await p.getByRole("button", { name: /Sugerir melhoria/ }).first().click();
  await p.waitForTimeout(800);
};
// Um PNG cinza de 1 pixel: a miniatura do print anexado, sem nenhuma tela de verdade.
const CINZA = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mO8d+/efwAIgAN8mC7XIQAAAABJRU5ErkJggg==", "base64");
const escrever = async (p: any) => {
  await abrirJanela(p);
  await p.locator("dialog input[type=file]").setInputFiles({ name: "print.png", mimeType: "image/png", buffer: CINZA });
  await p.waitForTimeout(600);
  await p.locator("dialog textarea").fill("Seria bom poder filtrar os pedidos do site pela cidade do cliente.");
  await p.waitForTimeout(200);
};

const decidir = async (p: any) => {
  await p.locator("select").first().selectOption("planejada");
  await p.locator("textarea").first().fill("Entra na semana que vem.");
  await p.waitForTimeout(200);
};

const prints: Print[] = [
  { arquivo: "sugestoes-1", demo: "sugestoes", nivel: "vendas", alvos: { topo: 'button:has-text("Sugerir melhoria") >> nth=0', botao: 'main button:has-text("Sugerir melhoria")', lista: 'section[aria-label="Sugestões"]', resposta: "text=Resposta de >> nth=0" } },
  { arquivo: "sugestoes-2", demo: "sugestoes", nivel: "vendas", antes: escrever, alvos: { janela: "dialog", texto: "dialog textarea", prints: "text=Prints >> nth=0", enviar: "dialog button:has-text('Enviar sugestão')" } },
  { arquivo: "sugestoes-3", demo: "sugestoes", nivel: "diretoria", antes: decidir, alvos: { abas: 'nav[aria-label="Filtrar por estado"]', levar: "text=Levar para o Roadmap >> nth=0", estado: "select >> nth=0", resposta: "textarea >> nth=0", salvar: "button:has-text('Salvar') >> nth=0" } },
];
export default prints;
