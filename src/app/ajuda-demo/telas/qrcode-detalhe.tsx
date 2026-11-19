import { TelaDoQrcode } from "@/app/admin/(painel)/qrcode/[id]/Tela";
import { trintaDias, type Resumo } from "@/app/admin/(painel)/qrcode/dados";
import { qrEmSvg } from "@/lib/qrcode/arte";
import type { Qrcode } from "@/lib/qrcode/tipos";
import type { Demo } from "../tipos";

const q: Qrcode = { id: "2", slug: "vitrine-exemplo", nome: "Vitrine da Loja Exemplo", modo: "whatsapp", whatsapp: "11900000000", mensagem: "Oi! Vi o QR code da vitrine e quero saber mais.", link: "", arquivado_em: null, criado_em: "2026-10-01T12:00:00Z" };
const resumo: Resumo = { qrcode: q.slug, total: 300, hoje: 0, ultimos_7: 20, ultimos_30: 60, iphone_30: 36, android_30: 24, ultima: "2026-11-19T11:00:00Z" };
const hoje = "2026-11-19";
const dias = trintaDias(hoje);
const noDia = new Map(dias.map((d, i) => [d, (i % 5) * 2 + 2]));

async function Detalhe() {
  // A arte de verdade é uma rota com sessão; aqui entra como imagem embutida.
  const svg = await qrEmSvg("https://exemplo.com.br/qrcode/vitrine-exemplo");
  const arte = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  return <TelaDoQrcode q={q} arte={arte} resumo={resumo} dias={dias} noDia={noDia} hoje={hoje} />;
}

const demo: Demo = { caminho: "/admin/qrcode", desenho: () => <Detalhe /> };
export default demo;
