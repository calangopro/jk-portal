import { TelaDasAutomacoes, type DadosDasAutomacoes } from "@/app/admin/(painel)/kommo/automacoes/Tela";
import type { Demo } from "../tipos";

const base = { ativa: false, etapas: {}, etapa_id: null, funil_id: null, responsavel_id: null, espera_min: 30, limite_por_hora: 10, ativada_em: null, ativada_por: null, editada_em: null, editada_por: null, problema: null as string | null, feitas_30d: 0, falhas_30d: 0 };

/** As quatro automações de exemplo: uma pronta para ligar, uma ligada, duas por configurar, e um registro com uma recusa. */
const dados: DadosDasAutomacoes = {
  tem_chave: true,
  automacoes: [
    { ...base, id: "recuperacao", funil_id: 1, etapa_id: 11, responsavel_id: 1 },
    { ...base, id: "pos_venda", ativa: true, funil_id: 2, etapas: { pago: 21, enviado: 22, entregue: 22 }, ativada_em: "2026-11-10T12:00:00Z", ativada_por: "Diretoria Exemplo", feitas_30d: 20, falhas_30d: 1 },
    { ...base, id: "sac", problema: "escolha o funil e a etapa." },
    { ...base, id: "tarefas", limite_por_hora: 20 },
  ],
  funis: [
    { id: 1, nome: "Funil Exemplo Vendas", etapas: [{ id: 11, nome: "Etapa Exemplo Entrada", ordem: 1, tipo: "entrada" }, { id: 12, nome: "Etapa Exemplo Atendimento", ordem: 2, tipo: "aberta" }] },
    { id: 2, nome: "Funil Exemplo Pós-venda", etapas: [{ id: 21, nome: "Etapa Exemplo Pago", ordem: 1, tipo: "entrada" }, { id: 22, nome: "Etapa Exemplo Enviado", ordem: 2, tipo: "aberta" }] },
  ],
  usuarios: [{ id: 1, nome: "Vendedor Exemplo" }, { id: 2, nome: "Gerente Exemplo" }],
  escritas: [
    { id: 3, automacao: "pos_venda", acao: "mover_negocio", estado: "ok", referencia: "pedido 1001", rotulo: "Cliente Exemplo Um", negocio_id: null, http: 200, erro: null, criado_em: "2026-11-18T15:00:00Z", feita_por: "Diretoria Exemplo" },
    { id: 2, automacao: "pos_venda", acao: "mover_negocio", estado: "recusada", referencia: "pedido 1003", rotulo: "Cliente Exemplo Dois", negocio_id: null, http: 400, erro: "A Kommo recusou a mudança de etapa.", criado_em: "2026-11-18T14:00:00Z", feita_por: "Diretoria Exemplo" },
    { id: 1, automacao: "pos_venda", acao: "mover_negocio", estado: "ok", referencia: "pedido 1005", rotulo: "Cliente Exemplo Três", negocio_id: null, http: 200, erro: null, criado_em: "2026-11-18T13:00:00Z", feita_por: "Diretoria Exemplo" },
  ],
};

const demo: Demo = {
  caminho: "/admin/kommo/automacoes",
  desenho: () => (
    <TelaDasAutomacoes
      dados={dados}
      aoSalvar={async () => { "use server"; return { ok: true as const }; }}
      aoLigar={async () => { "use server"; return { ok: true as const }; }}
      aoDesligar={async () => { "use server"; return { ok: true as const }; }}
    />
  ),
};
export default demo;
