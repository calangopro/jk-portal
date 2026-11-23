import type { Print } from "../prints.mts";

const rolar = (seletor: string) => async (p: any) => {
  await p.locator(seletor).first().evaluate((e: any) => e.scrollIntoView({ block: "start" }));
  await p.mouse.wheel(0, -90);
  await p.waitForTimeout(300);
};

const prints: Print[] = [
  { arquivo: "margem-1", demo: "margem", nivel: "diretoria", alvos: { numeros: "section.grid >> nth=0", promocao: "section:has-text('Promoção de hoje abaixo da margem mínima') >> nth=1" } },
  { arquivo: "margem-2", demo: "margem", nivel: "diretoria", antes: rolar("text=Parâmetros"), alvos: { parametros: "div.glass:has-text('Quando o ouro ou a prata mudar') >> nth=0", importar: "div.glass:has-text('Importar a planilha do dono') >> nth=0" } },
  { arquivo: "margem-3", demo: "margem", nivel: "diretoria", antes: rolar("text=Ouro por família"), alvos: { tabela: "section:has-text('Ouro por família') >> nth=0", gramas: "input[aria-label='Gramas da F01']", resto: "input[aria-label='Resto da peça da F01']" } },
  { arquivo: "margem-4", demo: "margem", nivel: "diretoria", antes: rolar("text=Taxas do gateway (Appmax)"), alvos: { gateway: "div.glass:has-text('Taxas do gateway (Appmax)') >> nth=0", efetiva: "p:has-text('Taxa efetiva')" } },
];
export default prints;
