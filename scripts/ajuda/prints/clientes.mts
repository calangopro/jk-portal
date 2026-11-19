import type { Print } from "../prints.mts";

const rolar = (texto: string) => async (p: any) => {
  await p.getByText(texto).first().evaluate((e: HTMLElement) => e.scrollIntoView({ block: "start" }));
  await p.evaluate(() => window.scrollBy(0, -90));
};

const prints: Print[] = [
  { arquivo: "clientes-1", demo: "clientes", alvos: { busca: "main input >> nth=0", recentes: "text=Compraram por último", meus: "text=Clientes com você" } },
  { arquivo: "clientes-ficha-1", demo: "cliente-ficha", alvos: { cabecalho: "h1", whats: "text=Abrir no WhatsApp", suporte: "text=Passar para o suporte", kommo: "#na-kommo" } },
  { arquivo: "clientes-ficha-2", demo: "cliente-ficha", antes: rolar("Na Kommo"), alvos: { sabemos: "text=O que sabemos", fase: "text=Noivado >> nth=0" } },
  { arquivo: "clientes-ficha-3", demo: "cliente-ficha", antes: rolar("Linha do tempo"), alvos: { titulo: "#linha-do-tempo", venda: "text=Venda por fora da loja" } },
];
export default prints;
