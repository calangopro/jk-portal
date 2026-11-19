import type { Print } from "../prints.mts";

const abrirResposta = async (p: any) => {
  await p.getByRole("button", { name: "Responder" }).first().click();
  await p.getByLabel("Resposta, em nome da JK").fill("Oi! Entregamos em todo o Brasil. Qualquer dúvida, é só chamar.");
  await p.getByRole("button", { name: "Responder" }).first().click();
  await p.waitForTimeout(250);
};

const prints: Print[] = [
  { arquivo: "redes-comentarios-1", demo: "redes-comentarios", nivel: "diretoria", alvos: { abas: 'nav[aria-label="Situação dos comentários"]', redes: 'nav[aria-label="Rede"]', modo: 'nav[aria-label="Como mostrar"]', primeiro: "li.glass >> nth=0", post: "li.glass >> nth=0 >> text=Ver o post" } },
  { arquivo: "redes-comentarios-2", demo: "redes-comentarios", nivel: "diretoria", antes: abrirResposta, alvos: { caixa: "text=Resposta, em nome da JK", aviso: "text=A resposta sai agora", botoes: 'button:has-text("Sim, publicar a resposta")' } },
];
export default prints;
