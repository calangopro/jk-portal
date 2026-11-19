import type { Print } from "../prints.mts";

const rolar = (nome: string, topo = 90) => async (p: any) => {
  await p.getByRole("heading", { name: new RegExp(nome) }).first().evaluate((e: HTMLElement, t: number) => { e.scrollIntoView({ block: "start" }); window.scrollBy(0, -t); }, topo);
};

const prints: Print[] = [
  { arquivo: "redirects-1", demo: "redirects", nivel: "diretoria", antes: rolar("Endereços quebrados"), alvos: { fila: "section >> nth=0", palpite: "text=Palpite de destino", criar: 'button:has-text("Criar o desvio")', tirar: 'button:has-text("Tirar da fila")' } },
  { arquivo: "redirects-2", demo: "redirects", nivel: "diretoria", antes: rolar("Criar redirect"), alvos: { form: "section:has(h2:has-text('Criar redirect'))" } },
  { arquivo: "redirects-3", demo: "redirects", nivel: "diretoria", antes: async (p: any) => { await p.locator("details summary").first().click(); await p.waitForTimeout(300); await rolar("Desvios cadastrados")(p); }, alvos: { lista: "details >> nth=0", editar: "details >> nth=0 >> form >> nth=0", remover: 'button:has-text("Remover este desvio")', status: "details >> nth=0 >> summary span >> nth=3" } },
];
export default prints;
