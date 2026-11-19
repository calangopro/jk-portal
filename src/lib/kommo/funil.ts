/**
 * O funil único da Kommo (cartão 46, fase 2 do plano da Kommo).
 *
 * São 25 funis na Kommo, cada um com as próprias etapas e os próprios nomes
 * ("Entrada", "Aguardando vendedor", "Em negociação", "Orçamento enviado"...).
 * Para comparar loja com loja, cada etapa é ligada a uma FASE PADRÃO, e o
 * painel soma pela fase. A ligação mora no banco (`kommo_etapa_fase`, 0162) e
 * a diretoria corrige em `/admin/kommo/fases`.
 *
 * Este arquivo é puro, para o teste rodar sem banco: o palpite inicial pelo
 * nome da etapa, os prazos dos alertas (que são PREMISSA) e os sinais da Visão
 * geral. Etapa cujo nome não bate com nada fica SEM FASE: o palpite não chuta.
 */
import type { Sinal } from "../painel/sinais.ts";

export const FASES = [
  "entrada",
  "esperando_vendedor",
  "em_atendimento",
  "orcamento",
  "esperando_pagamento",
  "ganho",
  "perdido",
  "pos_venda",
] as const;
export type Fase = (typeof FASES)[number];

export const NOME_DA_FASE: Record<Fase, string> = {
  entrada: "Entrada",
  esperando_vendedor: "Esperando vendedor",
  em_atendimento: "Em atendimento",
  orcamento: "Orçamento",
  esperando_pagamento: "Esperando pagamento",
  ganho: "Ganho",
  perdido: "Perdido",
  pos_venda: "Pós-venda",
};

/** O que cada fase quer dizer, para a tela de ligar etapa a fase. */
export const EXPLICACAO_DA_FASE: Record<Fase, string> = {
  entrada: "Chegou na Kommo e ainda não foi triado.",
  esperando_vendedor: "Triado, esperando alguém da loja assumir.",
  em_atendimento: "Alguém da loja está conversando com o cliente.",
  orcamento: "Orçamento enviado ou em negociação.",
  esperando_pagamento: "O cliente decidiu e falta pagar.",
  ganho: "Venda fechada.",
  perdido: "Venda perdida.",
  pos_venda: "Depois da venda: entrega, NPS, manutenção, SAC. Não conta na conversão.",
};

/** As fases abertas, na ordem do caminho do cliente. Ganho, perdido e pós-venda ficam fora do "aberto". */
export const FASES_ABERTAS: Fase[] = ["entrada", "esperando_vendedor", "em_atendimento", "orcamento", "esperando_pagamento"];

export function ehFase(v: unknown): v is Fase {
  return typeof v === "string" && (FASES as readonly string[]).includes(v);
}

const ETAPA_GANHO = 142;
const ETAPA_PERDIDO = 143;

const semAcento = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Funil que é todo pós-venda pelo nome: PDV, PÓS VENDAS e SAC (não é venda nova). */
export function funilDePosVenda(nomeDoFunil: string): boolean {
  const n = semAcento(nomeDoFunil);
  return /\b(pdv|pos vendas?|sac)\b/.test(n);
}

/**
 * Regras do palpite pelo nome da etapa, da mais específica para a mais larga.
 * A primeira que casa vence. Os nomes são os que a conta tinha em 18/11/2026.
 */
const REGRAS: { fase: Fase; padrao: RegExp }[] = [
  { fase: "esperando_pagamento", padrao: /\b(aguardando|esperando) pagamento\b|\babandono de carrinho\b|\bcarrinho\b/ },
  { fase: "esperando_vendedor", padrao: /\b(aguardando|esperando) (vendedor|atendimento|atendente)\b|^entrada$|^novos?$|^novo lead$/ },
  { fase: "orcamento", padrao: /\borcamento\b|\bnegociacao\b|\bproposta\b|\bfollow ?up\b/ },
  { fase: "em_atendimento", padrao: /\bem atendimento\b|\batendimento\b|\bqualificacao\b/ },
  {
    fase: "pos_venda",
    padrao: /\bpedido (aprovado|enviado|entregue)\b|\bpos ?venda\b|\blancamento\b|\bboas vindas\b|\bnps\b|\bcashback\b|\bmanutencao\b|\bpolimento\b|\baniversario\b|\bupgrade\b/,
  },
];

export type EtapaParaPalpite = { funil_id: number; funil: string; etapa_id: number; etapa: string; tipo: "entrada" | "aberta" | "ganho" | "perdido" };

/**
 * O palpite da fase de UMA etapa, pelo nome dela e do funil. Devolve `null`
 * quando não reconhece: etapa nova com nome novo fica sem fase até alguém ligar.
 */
export function palpiteDaFase(e: EtapaParaPalpite): Fase | null {
  const posVenda = funilDePosVenda(e.funil);
  if (e.etapa_id === ETAPA_GANHO || e.tipo === "ganho") return posVenda ? "pos_venda" : "ganho";
  if (e.etapa_id === ETAPA_PERDIDO || e.tipo === "perdido") return posVenda ? "pos_venda" : "perdido";
  if (e.tipo === "entrada") return "entrada";
  if (posVenda) return "pos_venda";
  const n = semAcento(e.etapa);
  for (const r of REGRAS) if (r.padrao.test(n)) return r.fase;
  return null;
}

/** As linhas que a leitura grava como palpite: só as etapas que o palpite reconhece. */
export function palpitesDasFases(etapas: EtapaParaPalpite[]): { funil_id: number; etapa_id: number; fase: Fase; origem: "palpite" }[] {
  const saida: { funil_id: number; etapa_id: number; fase: Fase; origem: "palpite" }[] = [];
  for (const e of etapas) {
    const fase = palpiteDaFase(e);
    if (fase) saida.push({ funil_id: e.funil_id, etapa_id: e.etapa_id, fase, origem: "palpite" });
  }
  return saida;
}

// ---------------------------------------------------------------------------
// Alertas
// ---------------------------------------------------------------------------

/**
 * Os prazos dos alertas, em minutos. São PREMISSA, os mesmos do pedido de
 * resposta do chat do time (`LIMITES_DO_PEDIDO`): 30 minutos é atenção e 2
 * horas é ruim, de relógio corrido. Trocar quando a JK disser o combinado.
 */
export const PRAZOS_DA_KOMMO = { atencao: 30, ruim: 120 } as const;

export type AlertasDaKommo = {
  /** Negócios abertos em fase "esperando vendedor" há mais que cada prazo. */
  esperando: { atencao: number; ruim: number; total: number; mais_antigo_min: number | null; valor: number };
  /** Negócios abertos com mensagem do cliente sem resposta da loja há mais que cada prazo. */
  sem_resposta: { atencao: number; ruim: number; total: number; mais_antigo_min: number | null; valor: number };
  /** Quando o espelho foi lido pela última vez; `null` se nunca. */
  lido_em: string | null;
  /** Etapas com negócio aberto e sem fase ligada. */
  etapas_sem_fase: number;
};

/** "2 horas", "45 minutos", "3 dias": o tempo de espera por extenso. */
export function tempoPorExtenso(min: number): string {
  if (min < 60) return `${Math.max(1, Math.round(min))} ${Math.round(min) === 1 ? "minuto" : "minutos"}`;
  const h = min / 60;
  if (h < 48) return `${Math.round(h)} ${Math.round(h) === 1 ? "hora" : "horas"}`;
  const d = Math.round(h / 24);
  return `${d} ${d === 1 ? "dia" : "dias"}`;
}

/** Tom de uma espera em minutos, pela premissa. */
export function tomDaEsperaNaKommo(min: number | null): "neutro" | "atencao" | "ruim" {
  if (min === null) return "neutro";
  if (min >= PRAZOS_DA_KOMMO.ruim) return "ruim";
  if (min >= PRAZOS_DA_KOMMO.atencao) return "atencao";
  return "neutro";
}

const premissa = `O prazo é premissa do painel (${PRAZOS_DA_KOMMO.atencao} minutos é atenção, ${PRAZOS_DA_KOMMO.ruim / 60} horas é atraso), até a JK dizer o combinado.`;

/**
 * Os sinais da Kommo para a Visão geral. Só entra o que passou do prazo, cada
 * sinal com o número que o disparou e o link para o funil. Espelho que nunca
 * foi lido não gera sinal: zero de um espelho vazio não é "tudo em dia".
 */
export function sinaisDaKommo(a: AlertasDaKommo | null): Sinal[] {
  if (!a || !a.lido_em) return [];
  const sinais: Sinal[] = [];
  const casos = [
    {
      chave: "kommo-esperando-vendedor",
      x: a.esperando,
      um: "negócio esperando vendedor",
      varios: "negócios esperando vendedor",
      texto: "Estão na fase de esperar alguém da loja assumir na Kommo.",
      link: { href: "/admin/funil?alerta=esperando", rotulo: "Ver no funil" },
    },
    {
      chave: "kommo-sem-resposta",
      x: a.sem_resposta,
      um: "conversa com o cliente sem resposta",
      varios: "conversas com o cliente sem resposta",
      texto: "O cliente mandou a última mensagem e ninguém da loja respondeu na Kommo.",
      link: { href: "/admin/funil?alerta=sem_resposta", rotulo: "Ver no funil" },
    },
  ];
  for (const c of casos) {
    const n = c.x.atencao;
    if (n <= 0) continue;
    const ruins = c.x.ruim;
    const grave = ruins > 0;
    const mais = c.x.mais_antigo_min !== null ? ` O mais antigo espera há ${tempoPorExtenso(c.x.mais_antigo_min)}.` : "";
    sinais.push({
      chave: c.chave,
      gravidade: grave ? "problema" : "atencao",
      // Sem resposta pesa como dinheiro em jogo; sem valor, cada negócio conta como um real para ordenar.
      peso: Math.max(c.x.valor, n),
      titulo: `${n} ${n === 1 ? c.um : c.varios} há mais de ${tempoPorExtenso(PRAZOS_DA_KOMMO.atencao)}${grave ? `, ${ruins} há mais de ${tempoPorExtenso(PRAZOS_DA_KOMMO.ruim)}` : ""}`,
      texto: `${c.texto}${mais} ${premissa}`,
      link: c.link,
    });
  }
  if (a.etapas_sem_fase > 0) {
    sinais.push({
      chave: "kommo-etapas-sem-fase",
      gravidade: "atencao",
      peso: 0,
      titulo: `${a.etapas_sem_fase} ${a.etapas_sem_fase === 1 ? "etapa da Kommo com negócio aberto está" : "etapas da Kommo com negócio aberto estão"} sem fase`,
      texto: "Os negócios dessas etapas ficam fora das fases do funil único até alguém ligar a etapa a uma fase.",
      link: { href: "/admin/kommo/fases", rotulo: "Ligar as etapas" },
    });
  }
  return sinais;
}

// ---------------------------------------------------------------------------
// Funil único
// ---------------------------------------------------------------------------

/** Conversão: ganho sobre fechados (ganho mais perdido) no período. `null` sem fechados. */
export function conversao(ganhos: number, perdidos: number): number | null {
  const fechados = ganhos + perdidos;
  return fechados > 0 ? ganhos / fechados : null;
}

