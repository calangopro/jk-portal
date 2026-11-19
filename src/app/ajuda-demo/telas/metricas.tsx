import { TelaDasMetricas, type LinhaDeBusca } from "@/app/admin/(painel)/metricas/Tela";
import { PainelDeVisitas } from "@/app/admin/(painel)/metricas/Visitas";
import type { VisitasDoSite } from "@/lib/ga4/visitas";
import type { Demo } from "../tipos";

const visitas: VisitasDoSite = {
  dias: 28,
  totais: { pessoas: 12000, visualizacoes: 30000, sessoes: 15000, tempoMedio: 95, paraLoja: 1500, contato: 300 },
  anterior: { pessoas: 10000, visualizacoes: 26000 },
  paginas: [
    { caminho: "/guias/post-de-exemplo-um", titulo: "Post de exemplo um", pessoas: 3000, visualizacoes: 4000, tempoMedio: 120, paraLoja: 400, contato: 60 },
    { caminho: "/guias/post-de-exemplo-dois", titulo: "Post de exemplo dois", pessoas: 2000, visualizacoes: 2500, tempoMedio: 90, paraLoja: 200, contato: 30 },
    { caminho: "/guias/post-de-exemplo-tres", titulo: "Post de exemplo três", pessoas: 1000, visualizacoes: 1200, tempoMedio: 70, paraLoja: 0, contato: 0 },
  ],
  origens: [
    { origem: "busca", sessoes: 9000 },
    { origem: "direto", sessoes: 3000 },
    { origem: "redes", sessoes: 1500 },
  ],
  ias: [{ nome: "ChatGPT", sessoes: 120 }, { nome: "Perplexity", sessoes: 40 }],
  lidoEm: "2026-11-19T12:00:00Z",
} as VisitasDoSite;

const linha = (nome: string, impressions: number, clicks: number, position: number): LinhaDeBusca => ({
  nome, impressions, clicks, position, ctr: impressions ? (clicks / impressions) * 100 : 0,
});

const demo: Demo = {
  caminho: "/admin/metricas",
  desenho: () => (
    <TelaDasMetricas
      visitas={<PainelDeVisitas dados={visitas} />}
      periodo={{ inicio: "2026-10-20", fim: "2026-11-17" }}
      temDados
      impressoes={120000}
      cliques={3600}
      ctr={3}
      posicaoMedia={14.2}
      pertoDaPrimeira={[linha("consulta de exemplo um", 8000, 120, 9.4), linha("consulta de exemplo dois", 5000, 60, 12.1), linha("consulta de exemplo três", 2500, 30, 15.3)]}
      ctrBaixo={[linha("consulta de exemplo quatro", 20000, 40, 6.2), linha("consulta de exemplo cinco", 9000, 30, 8)]}
      paginas={[linha("/guias/post-de-exemplo-um", 30000, 900, 6), linha("/guias/post-de-exemplo-dois", 15000, 500, 8)]}
      automatico={{ email: null, problema: null, ultima: null }}
      publicados={24}
      total={31}
    />
  ),
};
export default demo;
