import type { Print } from "../prints.mts";

const semKommo = (p: any) => p.addStyleTag({ content: "section[aria-label='Conversas do WhatsApp']{display:none}" });
const rolar = (seletor: string) => async (p: any) => {
  await semKommo(p);
  await p.locator(seletor).first().evaluate((e: any) => e.scrollIntoView({ block: "start" }));
  await p.mouse.wheel(0, -90);
  await p.waitForTimeout(300);
};

const prints: Print[] = [
  { arquivo: "trafego-origem-1", demo: "trafego-origem", nivel: "trafego", alvos: { periodo: "nav[aria-label=Período]", cartoes: "div.grid >> nth=0", exato: "text=Ligados ao anúncio exato", bio: "section[aria-label='Link da bio']" } },
  { arquivo: "trafego-origem-2", demo: "trafego-origem", nivel: "trafego", antes: rolar("button:has-text('Por anúncio')"), alvos: { abas: "button:has-text('Por anúncio')", lista: "ul >> nth=0" } },
  {
    arquivo: "trafego-origem-3", demo: "trafego-origem", nivel: "trafego",
    antes: async (p: any) => { await p.waitForTimeout(1000); await p.getByRole("button", { name: "Pedido a pedido" }).click(); await p.waitForTimeout(300); await rolar("button:has-text('Por anúncio')")(p); },
    alvos: { pedido: "button:has-text('11001') >> nth=0", abas: "button:has-text('Pedido a pedido')" },
  },
];
export default prints;
