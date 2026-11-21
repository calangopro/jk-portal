import { TelaDasAutomacoes, type DadosDasAutomacoes } from "@/app/admin/(painel)/kommo/automacoes/Tela";
import type { ConfigDoBalcao } from "@/app/admin/(painel)/kommo/automacoes/BalcaoNaKommo";
import type { Demo } from "../tipos";

/** O cartão do balcão da loja nas automações da Kommo (cartão 72): uma loja ligada, as outras com a sugestão pelo nome. */
const dados: DadosDasAutomacoes = {
  tem_chave: true,
  automacoes: [],
  funis: [
    { id: 1, nome: "GRANJA VIANNA | PDV", etapas: [{ id: 11, nome: "Incoming leads", ordem: 0, tipo: "entrada" }, { id: 12, nome: "Lançamento", ordem: 1, tipo: "aberta" }] },
    { id: 2, nome: "GRANJA VIANNA | WHATS", etapas: [{ id: 21, nome: "Entrada", ordem: 1, tipo: "aberta" }] },
    { id: 3, nome: "RAPOSO | PDV", etapas: [{ id: 31, nome: "Lançamento", ordem: 1, tipo: "aberta" }] },
    { id: 4, nome: "RAPOSO | WHATS", etapas: [{ id: 41, nome: "Entrada", ordem: 1, tipo: "aberta" }] },
  ],
  usuarios: [{ id: 1, nome: "Conta da empresa Exemplo" }, { id: 2, nome: "Vendedor Exemplo" }],
  escritas: [],
};

const balcao: ConfigDoBalcao = {
  lojas: [{ loja: "JK Granja", loja_kommo: "Granja Vianna", tag: null, funil_pedido: 1, etapa_pedido: 12, funil_lead: 2, etapa_lead: 21, responsavel_id: 1, completa_pedido: true, completa_lead: true, editado_em: "2026-11-20T12:00:00Z" }],
  automacoes: [
    { id: "balcao_pedido", ativa: true, ativada_em: "2026-11-20T12:00:00Z", ativada_por: "Diretoria Exemplo", problema: null, feitas_30d: 4, falhas_30d: 0, limite_por_hora: 30 },
    { id: "balcao_lead", ativa: false, ativada_em: null, ativada_por: null, problema: null, feitas_30d: 0, falhas_30d: 0, limite_por_hora: 30 },
  ],
  pedidos_30d: 4,
  leads_30d: 2,
};

const nada = async () => {
  "use server";
  return { ok: true };
};

const demo: Demo = {
  caminho: "/admin/kommo/automacoes",
  desenho: () => (
    <TelaDasAutomacoes
      dados={dados}
      aoSalvar={nada}
      aoLigar={nada}
      aoDesligar={nada}
      balcao={{ config: balcao, lojas: ["JK Granja", "JK Raposo"], opcoesDeLoja: ["Granja Vianna", "Raposo"], aoSalvar: nada }}
    />
  ),
};
export default demo;
