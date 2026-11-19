import { TelaDosQrcodes } from "@/app/admin/(painel)/qrcode/Tela";
import { trintaDias, type Resumo } from "@/app/admin/(painel)/qrcode/dados";
import type { Qrcode } from "@/lib/qrcode/tipos";
import type { Demo } from "../tipos";

// Lugares, destinos e leituras inventados, com números redondos.
const base = { whatsapp: "11900000000", mensagem: "Oi! Vi o QR code e quero saber mais.", link: "", arquivado_em: null, criado_em: "2026-10-01T12:00:00Z" } as const;
const ativos: Qrcode[] = [
  { ...base, id: "1", slug: "", nome: "Adesivos do espelho (exemplo)", modo: "whatsapp" },
  { ...base, id: "2", slug: "vitrine-exemplo", nome: "Vitrine da Loja Exemplo", modo: "whatsapp" },
  { ...base, id: "3", slug: "cartao-exemplo", nome: "Cartão de agradecimento", modo: "link", link: "https://exemplo.com.br/oferta" },
];
const resumo = (qrcode: string, total: number, hoje: number, s7: number, s30: number): Resumo => ({ qrcode, total, hoje, ultimos_7: s7, ultimos_30: s30, iphone_30: Math.round(s30 * 0.6), android_30: Math.round(s30 * 0.4), ultima: "2026-11-19T11:00:00Z" });
const resumos = new Map<string, Resumo>([
  ["", resumo("", 500, 5, 30, 100)],
  ["vitrine-exemplo", resumo("vitrine-exemplo", 300, 0, 20, 60)],
  ["cartao-exemplo", resumo("cartao-exemplo", 100, 0, 10, 40)],
]);
const hoje = "2026-11-19";
const dias = trintaDias(hoje);
const noDia = new Map(dias.map((d, i) => [d, (i % 5) * 2 + 2]));

const demo: Demo = {
  caminho: "/admin/qrcode",
  desenho: () => <TelaDosQrcodes ativos={ativos} arquivados={[]} resumos={resumos} dias={dias} noDia={noDia} hoje={hoje} />,
};
export default demo;
