import { TelaDoFunil, type Filtros, type FunilUnico } from "@/app/admin/(painel)/funil/Tela";
import type { AlertasDaKommo } from "@/lib/kommo/funil";
import type { Demo } from "../tipos";

const agora = Date.parse("2026-11-19T15:00:00Z");
const h = (horas: number) => new Date(agora - horas * 3_600_000).toISOString();

const dados: FunilUnico = {
  lido_em: h(0.1),
  dias: 30,
  fases: [
    { fase: "entrada", abertos: 40, valor: 0, parado_dias: 1.5, parados_7d: 4, sem_resposta: 6 },
    { fase: "esperando_vendedor", abertos: 12, valor: 18000, parado_dias: 0.5, parados_7d: 0, sem_resposta: 3 },
    { fase: "em_atendimento", abertos: 30, valor: 45000, parado_dias: 3, parados_7d: 5, sem_resposta: 8 },
    { fase: "orcamento", abertos: 20, valor: 36000, parado_dias: 4, parados_7d: 6, sem_resposta: 2 },
    { fase: "esperando_pagamento", abertos: 8, valor: 15000, parado_dias: 2, parados_7d: 1, sem_resposta: 0 },
  ],
  etapas: [
    { funil_id: 1, funil: "Funil Exemplo", etapa_id: 11, etapa: "Etapa Exemplo A", fase: "em_atendimento", origem_fase: "pessoa", abertos: 18, valor: 27000, parado_dias: 3 },
    { funil_id: 1, funil: "Funil Exemplo", etapa_id: 12, etapa: "Etapa Exemplo B", fase: "em_atendimento", origem_fase: "pessoa", abertos: 12, valor: 18000, parado_dias: 2 },
  ],
  periodo: { ganhos: 30, perdidos: 90, valor_ganho: 60000, valor_perdido: 120000, criados: 300 },
  primeira_resposta: { com_resposta: 250, sem_resposta: 20, mediana_min: 12 },
  motivos: [
    { motivo: "Motivo exemplo A", perdidos: 40, valor: 0 },
    { motivo: "Motivo exemplo B", perdidos: 30, valor: 30000 },
    { motivo: "Motivo exemplo C", perdidos: 20, valor: 0 },
  ],
  lista: [
    { id: 1001, nome: "Negócio Exemplo Um", valor: 3000, funil: "Funil Exemplo", etapa: "Etapa Exemplo A", fase: "em_atendimento", responsavel: "Vendedor Exemplo", pessoa: "Vendedor Exemplo", loja: "Loja Exemplo", origem: "Instagram", etapa_desde: h(200), ultima_msg_cliente_em: h(26), ultima_msg_loja_em: h(30), sem_resposta: true, link: "#" },
    { id: 1002, nome: "Negócio Exemplo Dois", valor: 1200, funil: "Funil Exemplo", etapa: "Etapa Exemplo B", fase: "orcamento", responsavel: "Vendedora Exemplo", pessoa: "Vendedora Exemplo", loja: "Loja Exemplo", origem: "Google", etapa_desde: h(120), ultima_msg_cliente_em: null, ultima_msg_loja_em: h(100), sem_resposta: false, link: "#" },
    { id: 1003, nome: "Negócio Exemplo Três", valor: 2000, funil: "Funil Exemplo", etapa: "Etapa Exemplo A", fase: "esperando_vendedor", responsavel: null, pessoa: null, loja: null, origem: "Site", etapa_desde: h(5), ultima_msg_cliente_em: null, ultima_msg_loja_em: null, sem_resposta: false, link: "#" },
  ],
  opcoes: {
    lojas: [{ id: "l1", nome: "Loja Exemplo" }],
    pessoas: [{ id: "p1", nome: "Vendedor Exemplo" }, { id: "p2", nome: "Vendedora Exemplo" }],
    funis: [{ id: 1, nome: "Funil Exemplo" }],
    origens: ["Instagram", "Google", "Site"],
  },
  sem_mapa: 0,
};

const alertas: AlertasDaKommo = {
  esperando: { atencao: 5, ruim: 2, total: 12, mais_antigo_min: 360, valor: 9000 },
  sem_resposta: { atencao: 9, ruim: 3, total: 19, mais_antigo_min: 1600, valor: 15000 },
  lido_em: h(0.1),
  etapas_sem_fase: 0,
};

const filtros: Filtros = { dias: 30, loja: "", pessoa: "", funil: "", origem: "", alerta: "" };

const demo: Demo = {
  caminho: "/admin/funil",
  desenho: () => (
    <div data-painel-largo>
      <TelaDoFunil dados={dados} alertas={alertas} filtros={filtros} agora={agora} diretoria />
    </div>
  ),
};
export default demo;
