"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { ehAutomacao } from "@/lib/kommo/automacoes-regra";
import { createClient } from "@/lib/supabase/server";

export type ResultadoDaAutomacao = { ok: boolean; erro?: string; aviso?: string };

const ERROS: Record<string, string> = {
  sem_acesso: "Só administrador, dono ou GM mexe nas automações da Kommo.",
  nao_encontrada: "Automação não encontrada.",
  sem_chave: "A chave da Kommo ainda não está colada em Integrações. Sem ela, nada liga.",
  dados: "Os dados chegaram incompletos. Recarregue a página.",
  espera: "A espera vai de 0 a 1.440 minutos.",
  limite: "O teto vai de 1 a 60 escritas por hora.",
  funil: "Escolha um funil que exista na Kommo.",
  etapa: "Escolha a etapa onde o negócio nasce (aberta, não de ganho nem de perda).",
  etapas: "Escolha uma etapa aberta do funil para pelo menos um marco.",
  ordem: "As etapas precisam seguir a ordem do funil: pago, depois enviado, depois entregue.",
  responsavel: "Esse usuário não está ativo na Kommo.",
  lojas: "Ligue pelo menos uma loja com funil, etapa e responsável antes de ligar.",
};

/** As duas do balcão da loja (0201) entram pelas mesmas portas de ligar e desligar. */
const ehDoBalcao = (id: string) => id === "balcao_pedido" || id === "balcao_lead";
const valida = (id: string) => ehAutomacao(id) || ehDoBalcao(id);

const erro = (codigo: string | undefined, padrao: string) => ERROS[codigo ?? ""] ?? padrao;

function depois() {
  revalidatePath("/admin/kommo/automacoes");
}

/** Salva a configuração. Se a automação estava ligada, o banco DESLIGA: o que foi aprovado era a anterior. */
export async function salvarAutomacao(id: string, config: Record<string, unknown>): Promise<ResultadoDaAutomacao> {
  await requireAdmin();
  if (!ehAutomacao(id)) return { ok: false, erro: ERROS.nao_encontrada };
  const { data, error } = await (await createClient()).rpc("kommo_automacao_salvar", { p_id: id, p_config: config });
  if (error) return { ok: false, erro: error.message };
  const r = data as { ok?: boolean; erro?: string; desligou?: boolean; problema?: string | null } | null;
  if (!r?.ok) return { ok: false, erro: erro(r?.erro, "Não deu para salvar.") };
  depois();
  const avisos = [r.desligou ? "Salvo, e a automação foi desligada: confira e ligue de novo." : "Salvo.", r.problema ? `Para ligar ainda falta: ${erro(r.problema, "conferir a configuração")}` : null];
  return { ok: true, aviso: avisos.filter(Boolean).join(" ") };
}

/** Liga. A pessoa logada vira a autora de cada escrita desta automação. */
export async function ligarAutomacao(id: string, conferiu: boolean): Promise<ResultadoDaAutomacao> {
  await requireAdmin();
  if (!valida(id)) return { ok: false, erro: ERROS.nao_encontrada };
  if (!conferiu) return { ok: false, erro: "Marque que conferiu o Salesbot das etapas escolhidas antes de ligar." };
  const { data, error } = await (await createClient()).rpc("kommo_automacao_ligar", { p_id: id });
  if (error) return { ok: false, erro: error.message };
  const r = data as { ok?: boolean; erro?: string } | null;
  if (!r?.ok) return { ok: false, erro: erro(r?.erro, "Não deu para ligar.") };
  depois();
  return { ok: true, aviso: "Ligada. Vale a partir de agora: o que aconteceu antes não vai para a Kommo." };
}

export async function desligarAutomacao(id: string): Promise<ResultadoDaAutomacao> {
  await requireAdmin();
  if (!valida(id)) return { ok: false, erro: ERROS.nao_encontrada };
  const { data, error } = await (await createClient()).rpc("kommo_automacao_desligar", { p_id: id });
  if (error) return { ok: false, erro: error.message };
  const r = data as { ok?: boolean; erro?: string } | null;
  if (!r?.ok) return { ok: false, erro: erro(r?.erro, "Não deu para desligar.") };
  depois();
  return { ok: true, aviso: "Desligada." };
}

/** A ligação de UMA loja do balcão com a Kommo (0201). Mudar desliga as duas automações do balcão. */
export async function salvarLigacaoDoBalcao(loja: string, ligacao: Record<string, unknown>): Promise<ResultadoDaAutomacao> {
  await requireAdmin();
  const limpo = Object.fromEntries(Object.entries(ligacao ?? {}).map(([k, v]) => [k, typeof v === "string" ? v.trim().slice(0, 60) : null]));
  const { data, error } = await (await createClient()).rpc("balcao_kommo_salvar", { p_loja: String(loja ?? "").slice(0, 60), p: limpo });
  if (error) return { ok: false, erro: error.message };
  const r = data as { ok?: boolean; erro?: string; desligou?: boolean } | null;
  if (!r?.ok) return { ok: false, erro: erro(r?.erro, "Não deu para salvar.") };
  depois();
  return { ok: true, aviso: r.desligou ? "Salvo, e as automações do balcão foram desligadas: confira e ligue de novo." : "Salvo." };
}
