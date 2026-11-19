import type { Print } from "../prints.mts";

const rolar = (secao: string, ajuste = -90) => async (p: any) => {
  await p.locator(`section[aria-label='${secao}']`).evaluate((e: any) => e.scrollIntoView({ block: "start" }));
  await p.mouse.wheel(0, ajuste);
  await p.waitForTimeout(300);
};

const prints: Print[] = [
  { arquivo: "gargalos-1", demo: "gargalos", nivel: "diretoria", alvos: { periodo: "text=De 21", mapa: "section[aria-label='Mapa de gargalos']", primeiro: "section[aria-label='Mapa de gargalos'] li >> nth=0", link: "section[aria-label='Mapa de gargalos'] li a >> nth=0" } },
  { arquivo: "gargalos-2", demo: "gargalos", nivel: "diretoria", antes: rolar("Funil de ponta a ponta"), alvos: { funil: "section[aria-label='Funil de ponta a ponta']", pagamento: "section[aria-label='Pagamento']" } },
  { arquivo: "gargalos-3", demo: "gargalos", nivel: "diretoria", antes: rolar("A plataforma contra a loja"), alvos: { plataforma: "section[aria-label='A plataforma contra a loja']", margem: "section[aria-label='A conta da margem']", vencedores: "section[aria-label='Anúncios vencedores e péssimos']" } },
];
export default prints;
