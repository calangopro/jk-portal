import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { lerChaves } from "@/lib/leads/chaves";
import { lerLojasFisicas, lerOportunidades } from "@/lib/clientes/dados";
import { hojeEmSaoPaulo } from "@/lib/vendas/periodo";
import { clienteDaKommo, type PedirKommo } from "./cliente";
import { escreverNaKommo, type ResultadoDaEscrita } from "./escrever";
import {
  POR_RODADA,
  TAREFA_ATE_DIAS,
  decidirPosVenda,
  decidirRecuperacao,
  decidirSac,
  decidirTarefa,
  ehAutomacao,
  telefoneDoPainel,
  type Acao,
  type CandidatoDePosVenda,
  type CandidatoDeRecuperacao,
  type CandidatoDeSac,
  type Configuracao,
  type IdDaAutomacao,
  type Marco,
  type NegocioDoEspelho,
} from "./automacoes-regra";

/**
 * O passo "o painel avisa a Kommo" (cartão 49, 0173): roda depois da leitura
 * do espelho, na rotina de dez em dez minutos. Junta os eventos das automações
 * LIGADAS (`kommo_avisos_candidatos`), decide pela conta pura
 * (`automacoes-regra.ts`) e manda cada escrita pelo caminho único
 * (`escrever.ts`).
 *
 * Rodar duas vezes não escreve duas vezes: a chave única de `kommo_escritas`
 * é a trava, e o que já tem escrita nem chega a ser tentado
 * (`kommo_escritas_feitas`). Não lança: erro aqui não derruba a leitura.
 *
 * `pedir` existe para o teste passar um cliente de mentira; sem ele, a rodada
 * usa a chave da Kommo.
 */

export type ResultadoDosAvisos = { ligadas: number; feitas: number; desistiu: number; falhas: number; detalhe: string };

type ConfigCrua = {
  id: string;
  funil_id: number | null;
  etapa_id: number | null;
  etapas: Partial<Record<Marco, number | null>> | null;
  responsavel_id: number | null;
  espera_min: number;
  limite_por_hora: number;
};

type Candidatos = {
  automacoes?: ConfigCrua[];
  etapas?: { funil_id: number; id: number; ordem: number }[];
  recuperacao?: CandidatoDeRecuperacao[];
  pos_venda?: CandidatoDePosVenda[];
  sac?: CandidatoDeSac[];
};

const num = (v: unknown): number | null => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));

function lerConfig(c: ConfigCrua): Configuracao | null {
  if (!ehAutomacao(c.id)) return null;
  const etapas: Configuracao["etapas"] = {};
  for (const m of ["pago", "enviado", "entregue"] as Marco[]) {
    const v = num(c.etapas?.[m]);
    if (v !== null) etapas[m] = v;
  }
  return {
    id: c.id,
    funilId: num(c.funil_id),
    etapaId: num(c.etapa_id),
    etapas,
    responsavelId: num(c.responsavel_id),
    esperaMin: Number(c.espera_min ?? 0),
    limitePorHora: Number(c.limite_por_hora ?? 10),
  };
}

function lerNegocioDoEspelho(n: unknown): NegocioDoEspelho | null {
  const x = n as Partial<Record<keyof NegocioDoEspelho, unknown>> | null;
  if (!x || num(x.id) === null || num(x.funil_id) === null || num(x.etapa_id) === null) return null;
  return { id: Number(x.id), funil_id: Number(x.funil_id), etapa_id: Number(x.etapa_id), responsavel_id: num(x.responsavel_id), ordem: num(x.ordem) };
}

export async function rodarAvisosDaKommo(db: SupabaseClient, opcoes: { pedir?: PedirKommo; prazoMs?: number } = {}): Promise<ResultadoDosAvisos> {
  const prazo = Date.now() + (opcoes.prazoMs ?? 12_000);
  const vazio = { ligadas: 0, feitas: 0, desistiu: 0, falhas: 0 };

  const { data, error } = await db.rpc("kommo_avisos_candidatos");
  if (error) {
    console.error("[kommo/avisos] candidatos:", error.message);
    return { ...vazio, falhas: 1, detalhe: `candidatos: ${error.message}` };
  }
  const cru = (data ?? {}) as Candidatos;
  const configs = new Map<IdDaAutomacao, Configuracao>();
  for (const c of cru.automacoes ?? []) {
    const lida = lerConfig(c);
    if (lida) configs.set(lida.id, lida);
  }
  if (configs.size === 0) return { ...vazio, detalhe: "nenhuma automação ligada" };

  let pedir = opcoes.pedir;
  if (!pedir) {
    const chave = (await lerChaves(db)).kommo;
    if (!chave) return { ...vazio, ligadas: configs.size, detalhe: "sem chave da Kommo" };
    pedir = clienteDaKommo(chave);
  }

  // A ordem de cada etapa, por funil (para o pós-venda andar só para a frente).
  const ordemPorFunil = new Map<number, Record<number, number>>();
  for (const e of cru.etapas ?? []) {
    const m = ordemPorFunil.get(Number(e.funil_id)) ?? {};
    m[Number(e.id)] = Number(e.ordem);
    ordemPorFunil.set(Number(e.funil_id), m);
  }

  const acoes: Acao[] = [];
  const rec = configs.get("recuperacao");
  if (rec) for (const c of cru.recuperacao ?? []) {
    const a = decidirRecuperacao({ ...c, valor: num(c.valor), pedido: Number(c.pedido), tentativas: Number(c.tentativas ?? 1) }, rec);
    if (a) acoes.push(a);
  }
  const pos = configs.get("pos_venda");
  if (pos && pos.funilId !== null) {
    const ordem = ordemPorFunil.get(pos.funilId) ?? {};
    for (const p of cru.pos_venda ?? []) {
      const a = decidirPosVenda({ ...p, pedido: Number(p.pedido), negocio: lerNegocioDoEspelho(p.negocio) }, pos, ordem);
      if (a) acoes.push(a);
    }
  }
  const sac = configs.get("sac");
  if (sac) for (const c of cru.sac ?? []) {
    const a = decidirSac({ ...c, caso: Number(c.caso), pedido: num(c.pedido), no_sac: lerNegocioDoEspelho(c.no_sac) }, sac);
    if (a) acoes.push(a);
  }
  const tarefas = configs.get("tarefas");
  if (tarefas) {
    try {
      acoes.push(...(await acoesDasTarefas(db, tarefas)));
    } catch (e) {
      console.error("[kommo/avisos] tarefas:", e);
    }
  }
  if (!acoes.length) return { ...vazio, ligadas: configs.size, detalhe: `${configs.size} ${configs.size === 1 ? "ligada" : "ligadas"}, nada novo` };

  // O que já tem escrita nem chega a ser tentado (a reserva também recusaria, mas custaria uma ida ao banco por evento).
  const { data: feitas } = await db.rpc("kommo_escritas_feitas", { p_chaves: acoes.map((a) => a.chave) });
  const jaFeitas = new Set((feitas ?? []) as string[]);
  const novas = acoes.filter((a, i) => !jaFeitas.has(a.chave) && acoes.findIndex((b) => b.chave === a.chave) === i);

  const porAutomacao: Record<string, number> = {};
  const contagem = { ...vazio, ligadas: configs.size };
  const paradas = new Set<string>();
  for (const a of novas) {
    if (Date.now() > prazo) break;
    if (paradas.has(a.automacao) || (porAutomacao[a.automacao] ?? 0) >= POR_RODADA) continue;
    porAutomacao[a.automacao] = (porAutomacao[a.automacao] ?? 0) + 1;
    let r: ResultadoDaEscrita;
    try {
      r = await escreverNaKommo(db, pedir, a);
    } catch (e) {
      console.error("[kommo/avisos] escrever", a.chave, e);
      contagem.falhas++;
      continue;
    }
    if (r.estado === "pulada") {
      // Desligada, sem autor ou no teto: o resto desta automação também não passa nesta rodada.
      if (r.motivo !== "ja") paradas.add(a.automacao);
      porAutomacao[a.automacao]--;
      continue;
    }
    if (r.estado === "ok") contagem.feitas++;
    else if (r.estado === "desistiu") contagem.desistiu++;
    else contagem.falhas++;
  }
  const partes = [
    contagem.feitas ? `${contagem.feitas} ${contagem.feitas === 1 ? "escrita" : "escritas"}` : null,
    contagem.desistiu ? `${contagem.desistiu} sem escrever (a Kommo mudou)` : null,
    contagem.falhas ? `${contagem.falhas} com erro` : null,
  ].filter(Boolean);
  return { ...contagem, detalhe: `${configs.size} ${configs.size === 1 ? "ligada" : "ligadas"}${partes.length ? `: ${partes.join(", ")}` : ", nada novo"}` };
}

async function acoesDasTarefas(db: SupabaseClient, cfg: Configuracao): Promise<Acao[]> {
  const hoje = hojeEmSaoPaulo();
  const dados = await lerOportunidades(db, hoje, TAREFA_ATE_DIAS, await lerLojasFisicas(), "kommo_avisos_base_de_oportunidades");
  if (!dados?.lista.length) return [];
  const telefones = [...new Set(dados.lista.map((o) => telefoneDoPainel(o.telefone)).filter((t): t is string => Boolean(t)))];
  if (!telefones.length) return [];
  const { data, error } = await db.rpc("kommo_avisos_negocios_por_telefone", { p_telefones: telefones, p_funil: cfg.funilId });
  if (error) {
    console.error("[kommo/avisos] negócios por telefone:", error.message);
    return [];
  }
  const porTelefone = (data ?? {}) as Record<string, unknown>;
  const acoes: Acao[] = [];
  for (const o of dados.lista) {
    const t = telefoneDoPainel(o.telefone);
    if (!t) continue;
    const a = decidirTarefa(o, lerNegocioDoEspelho(porTelefone[t]), cfg, hoje);
    if (a) acoes.push(a);
  }
  return acoes;
}
