import type { Print } from "../prints.mts";

const prints: Print[] = [
  { arquivo: "qrcode-1", demo: "qrcode", nivel: "diretoria", alvos: { novo: 'a:has-text("Novo QR code")', tabela: "table", lugar: "td >> nth=0", leva: "td >> nth=1", leituras: "th:has-text('7 dias')" } },
  { arquivo: "qrcode-2", demo: "qrcode-novo", nivel: "diretoria", antes: async (p: any) => { await p.evaluate(() => window.scrollBy(0, 330)); }, alvos: { nome: "label:has-text('Nome do lugar')", endereco: "label:has-text('Endereço do QR')", modos: "label:has-text('WhatsApp') >> nth=0", numero: "label:has-text('Número do WhatsApp')", mensagem: "label:has-text('Mensagem pronta')", criar: 'button:has-text("Criar QR code")' } },
  { arquivo: "qrcode-3", demo: "qrcode-detalhe", nivel: "diretoria", alvos: { arte: "img[alt^='QR code']", svg: "a:has-text('SVG')", png: "a:has-text('PNG')", form: "form >> nth=0" } },
  {
    arquivo: "qrcode-4", demo: "qrcode-detalhe", nivel: "diretoria",
    antes: async (p: any) => { await p.getByRole("heading", { name: "Leituras", exact: true }).evaluate((e: HTMLElement) => { e.scrollIntoView({ block: "start" }); window.scrollBy(0, -90); }); },
    alvos: { numeros: "dl", grafico: "dl ~ div, figure" },
  },
];
export default prints;
