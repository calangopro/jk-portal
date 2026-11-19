import { TelaDasFases, type FunisComFases } from "@/app/admin/(painel)/kommo/fases/Tela";
import type { Demo } from "../tipos";

/** Dois funis de exemplo: etapas conferidas, com palpite pelo nome e sem fase. */
const funis: FunisComFases = [
  {
    funil_id: 1, funil: "Funil Exemplo Vendas", principal: true,
    etapas: [
      { etapa_id: 11, etapa: "Etapa Exemplo Entrada", tipo: "entrada", ordem: 1, fase: "entrada", origem: "pessoa", definido_em: "2026-11-10T12:00:00Z", definido_por: "Diretoria Exemplo", abertos: 50 },
      { etapa_id: 12, etapa: "Etapa Exemplo Atendimento", tipo: "aberta", ordem: 2, fase: "em_atendimento", origem: "palpite", definido_em: null, definido_por: null, abertos: 30 },
      { etapa_id: 13, etapa: "Etapa Exemplo Orçamento", tipo: "aberta", ordem: 3, fase: "orcamento", origem: "palpite", definido_em: null, definido_por: null, abertos: 20 },
      { etapa_id: 14, etapa: "Etapa Exemplo Diferente", tipo: "aberta", ordem: 4, fase: null, origem: null, definido_em: null, definido_por: null, abertos: 10 },
      { etapa_id: 142, etapa: "Fechado ganho", tipo: "ganho", ordem: 5, fase: "ganho", origem: "pessoa", definido_em: "2026-11-10T12:00:00Z", definido_por: "Diretoria Exemplo", abertos: 0 },
    ],
  },
  {
    funil_id: 2, funil: "Funil Exemplo Pós-venda", principal: false,
    etapas: [
      { etapa_id: 21, etapa: "Etapa Exemplo Pós-venda", tipo: "entrada", ordem: 1, fase: "pos_venda", origem: "pessoa", definido_em: "2026-11-10T12:00:00Z", definido_por: "Diretoria Exemplo", abertos: 10 },
    ],
  },
];

const demo: Demo = {
  caminho: "/admin/kommo/fases",
  desenho: () => (
    <TelaDasFases
      funis={funis}
      aoSalvar={async () => { "use server"; return { ok: true as const }; }}
      aoConfirmar={async () => { "use server"; return { ok: true as const, confirmadas: 2 }; }}
    />
  ),
};
export default demo;
