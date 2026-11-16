import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { conferirRegra, deveResponder, lerPalavras, type DadosDaRegra } from "./automacoes-regra";
import { nomeDaRede, type RedeId } from "./redes";
import { ErroDaRede, type Conta, type Credenciais, type ModuloDaRede } from "./tipos";

/**
 * As automações das redes: resposta pronta a comentário, por palavra.
 *
 * É a única parte do painel que fala com cliente SEM uma pessoa mandar na
 * hora. Por isso as travas são mais de uma, e ficam todas aqui e no banco
 * (0086):
 *
 *   - toda regra nasce desligada; ligar é de administrador, dono e GM, com o
 *     texto exato na frente, e fica gravado quem ligou;
 *   - editar uma regra ligada DESLIGA: o que foi aprovado era o texto anterior;
 *   - só responde comentário escrito depois de a regra ser ligada, de primeiro
 *     nível, ainda sem resposta da conta, e só depois da espera;
 *   - um comentário recebe no máximo uma resposta automática (a chave única de
 *     `redes_automacoes_envios` decide, mesmo com duas rodadas ao mesmo tempo);
 *   - resposta que falhou NÃO é tentada de novo: sem saber se saiu, repetir
 *     arriscaria duas respostas iguais embaixo do mesmo comentário;
 *   - teto por hora e por rodada.
 *
 * Mandar direct para quem comentou não existe aqui: pede a análise do
 * aplicativo pela Meta.
 */

/** Quantas respostas automáticas uma conta dá numa rodada da leitura, somando as regras. */
const POR_RODADA = 5;

const agora = () => new Date().toISOString();

export type Resultado<T = object> = ({ ok: true } & T) | { ok: false; erro: string };
const falha = (erro: string): { ok: false; erro: string } => ({ ok: false, erro });

// ------------------------------------------------------------------ a tela

export type AutomacaoNaTela = {
  id: string;
  nome: string;
  contaId: string;
  rede: RedeId;
  conta: string;
  publicacaoId: string | null;
  /** A legenda do post, quando a regra vale para um só. */
  publicacao: string | null;
  palavras: string[];
  resposta: string;
  esperaMin: number;
  limitePorHora: number;
  ativa: boolean;
  ativadaEm: string | null;
  ativadaPor: string | null;
  criadaPor: string | null;
  /** Respostas dadas nos últimos 30 dias, e quantas falharam. */
  respondidas: number;
  falhas: number;
  /** A conta consegue responder comentário (ligada e com a permissão). */
  contaPronta: boolean;
};

type LinhaDaRegra = {
  id: string; nome: string; conta_id: string; publicacao_id: string | null; palavras: string[]; resposta: string; espera_min: number; limite_por_hora: number;
  ativa: boolean; ativada_em: string | null; ativada_por: string | null; criada_por: string | null;
  redes_contas: { rede: string; nome: string | null; usuario: string | null; status: string } | null;
  redes_publicacoes: { legenda: string | null } | null;
};

const SELECAO = "id, nome, conta_id, publicacao_id, palavras, resposta, espera_min, limite_por_hora, ativa, ativada_em, ativada_por, criada_por, redes_contas(rede, nome, usuario, status), redes_publicacoes(legenda)";

/** As regras, das ligadas para as desligadas. Recebe a chave de serviço, depois de a área ser conferida, para trazer o nome de quem ligou. */
export async function listarAutomacoes(admin: SupabaseClient): Promise<AutomacaoNaTela[]> {
  const { data, error } = await admin.from("redes_automacoes").select(SELECAO).order("ativa", { ascending: false }).order("criada_em", { ascending: false }).limit(100);
  if (error) {
    console.error("[redes] listarAutomacoes:", error.message);
    return [];
  }
  const linhas = (data ?? []) as unknown as LinhaDaRegra[];
  if (!linhas.length) return [];

  const desde = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data: envios } = await admin.from("redes_automacoes_envios").select("automacao_id, estado").gt("criado_em", desde).limit(5000);
  const conta = (id: string, estado: string) => ((envios ?? []) as { automacao_id: string; estado: string }[]).filter((e) => e.automacao_id === id && e.estado === estado).length;

  const pessoas = [...new Set(linhas.flatMap((l) => [l.ativada_por, l.criada_por]).filter((x): x is string => Boolean(x)))];
  const { data: perfis } = pessoas.length ? await admin.from("profiles").select("id, full_name, email").in("id", pessoas) : { data: [] };
  const nomes = new Map(((perfis ?? []) as { id: string; full_name: string | null; email: string | null }[]).map((p) => [p.id, p.full_name || (p.email ?? "").split("@")[0] || "alguém"]));

  return linhas.map((l) => ({
    id: l.id,
    nome: l.nome,
    contaId: l.conta_id,
    rede: (l.redes_contas?.rede ?? "instagram") as RedeId,
    conta: l.redes_contas?.usuario || l.redes_contas?.nome || nomeDaRede(l.redes_contas?.rede),
    publicacaoId: l.publicacao_id,
    publicacao: l.publicacao_id ? (l.redes_publicacoes?.legenda ?? "").slice(0, 120) || "Publicação sem legenda" : null,
    palavras: l.palavras ?? [],
    resposta: l.resposta,
    esperaMin: l.espera_min,
    limitePorHora: l.limite_por_hora,
    ativa: l.ativa,
    ativadaEm: l.ativada_em,
    ativadaPor: l.ativada_por ? nomes.get(l.ativada_por) ?? null : null,
    criadaPor: l.criada_por ? nomes.get(l.criada_por) ?? null : null,
    respondidas: conta(l.id, "respondido"),
    falhas: conta(l.id, "falhou"),
    contaPronta: l.redes_contas?.status === "ativa",
  }));
}

// ------------------------------------------------------------------ escrever

export type EntradaDaRegra = { nome: string; contaId: string; publicacaoId?: string | null; palavras: string | string[]; resposta: string; esperaMin?: number; limitePorHora?: number };

function lerEntrada(e: EntradaDaRegra): { dados: DadosDaRegra; contaId: string; publicacaoId: string | null } | { erro: string } {
  const dados: DadosDaRegra = {
    nome: String(e.nome ?? "").trim(),
    palavras: lerPalavras(e.palavras ?? []),
    resposta: String(e.resposta ?? "").replace(/\r\n/g, "\n").trim(),
    esperaMin: Math.round(Number(e.esperaMin ?? 30)),
    limitePorHora: Math.round(Number(e.limitePorHora ?? 20)),
  };
  const problema = conferirRegra(dados);
  if (problema) return { erro: problema };
  if (!/^[0-9a-f-]{36}$/.test(String(e.contaId ?? ""))) return { erro: "Escolha a conta." };
  const publicacaoId = e.publicacaoId && /^[0-9a-f-]{36}$/.test(e.publicacaoId) ? e.publicacaoId : null;
  return { dados, contaId: e.contaId, publicacaoId };
}

/** A conta existe, e a publicação escolhida é dela. */
async function conferirAlvo(db: SupabaseClient, contaId: string, publicacaoId: string | null): Promise<string | null> {
  const { data: conta } = await db.from("redes_contas").select("id, status").eq("id", contaId).maybeSingle();
  if (!conta || conta.status === "desligada") return "Conta que não está mais ligada.";
  if (publicacaoId) {
    const { data: pub } = await db.from("redes_publicacoes").select("conta_id").eq("id", publicacaoId).maybeSingle();
    if (!pub || pub.conta_id !== contaId) return "A publicação escolhida não é desta conta.";
  }
  return null;
}

/** Cria uma regra. Nasce DESLIGADA, sempre. */
export async function criarAutomacao(db: SupabaseClient, quem: { id: string }, entrada: EntradaDaRegra): Promise<Resultado<{ id: string }>> {
  const lida = lerEntrada(entrada);
  if ("erro" in lida) return falha(lida.erro);
  const problema = await conferirAlvo(db, lida.contaId, lida.publicacaoId);
  if (problema) return falha(problema);
  const { data, error } = await db
    .from("redes_automacoes")
    .insert({ nome: lida.dados.nome, conta_id: lida.contaId, publicacao_id: lida.publicacaoId, palavras: lida.dados.palavras, resposta: lida.dados.resposta, espera_min: lida.dados.esperaMin, limite_por_hora: lida.dados.limitePorHora, ativa: false, criada_por: quem.id })
    .select("id")
    .single();
  if (error || !data) return falha(error?.message ?? "A regra não foi gravada.");
  return { ok: true, id: data.id as string };
}

/** Salva as mudanças de uma regra. Se ela estava ligada, DESLIGA: quem ligou aprovou o texto anterior. */
export async function editarAutomacao(db: SupabaseClient, id: string, entrada: EntradaDaRegra): Promise<Resultado<{ desligou: boolean }>> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return falha("Regra não encontrada.");
  const lida = lerEntrada(entrada);
  if ("erro" in lida) return falha(lida.erro);
  const { data: atual } = await db.from("redes_automacoes").select("ativa").eq("id", id).maybeSingle();
  if (!atual) return falha("Regra não encontrada.");
  const problema = await conferirAlvo(db, lida.contaId, lida.publicacaoId);
  if (problema) return falha(problema);
  const { error } = await db
    .from("redes_automacoes")
    .update({ nome: lida.dados.nome, conta_id: lida.contaId, publicacao_id: lida.publicacaoId, palavras: lida.dados.palavras, resposta: lida.dados.resposta, espera_min: lida.dados.esperaMin, limite_por_hora: lida.dados.limitePorHora, ativa: false, ativada_por: null, ativada_em: null, atualizado_em: agora() })
    .eq("id", id);
  if (error) return falha(error.message);
  return { ok: true, desligou: Boolean(atual.ativa) };
}

/**
 * LIGA uma regra. Só administrador, dono ou GM: quem chama passa `admin`, que
 * vem do perfil da sessão, e esta função recusa sem ele. A partir de agora a
 * regra responde comentário NOVO; os que já existiam ficam como estão.
 */
export async function ligarAutomacao(db: SupabaseClient, quem: { id: string; admin: boolean }, id: string): Promise<Resultado> {
  if (!quem.admin) return falha("Ligar uma automação é de administrador, dono ou GM.");
  if (!/^[0-9a-f-]{36}$/.test(id)) return falha("Regra não encontrada.");
  const { data: regra } = await db.from("redes_automacoes").select("id, conta_id, redes_contas(status)").eq("id", id).maybeSingle();
  if (!regra) return falha("Regra não encontrada.");
  const status = (regra as unknown as { redes_contas: { status: string } | null }).redes_contas?.status;
  if (status !== "ativa") return falha("A conta desta regra precisa ser ligada de novo antes.");
  const quando = agora();
  const { error } = await db.from("redes_automacoes").update({ ativa: true, ativada_por: quem.id, ativada_em: quando, atualizado_em: quando }).eq("id", id);
  return error ? falha(error.message) : { ok: true };
}

/** Desliga. Qualquer pessoa com a área pode: parar uma automação nunca deve esperar por alguém. */
export async function desligarAutomacao(db: SupabaseClient, id: string): Promise<Resultado> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return falha("Regra não encontrada.");
  const { error } = await db.from("redes_automacoes").update({ ativa: false, atualizado_em: agora() }).eq("id", id);
  return error ? falha(error.message) : { ok: true };
}

/** Apaga uma regra desligada. O registro das respostas que ela deu vai junto. */
export async function apagarAutomacao(db: SupabaseClient, id: string): Promise<Resultado> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return falha("Regra não encontrada.");
  const { data, error } = await db.from("redes_automacoes").delete().eq("id", id).eq("ativa", false).select("id");
  if (error) return falha(error.message);
  return data?.length ? { ok: true } : falha("Desligue a regra antes de apagar.");
}

// ------------------------------------------------------------------ o motor

type RegraAtiva = { id: string; publicacao_id: string | null; palavras: string[]; resposta: string; espera_min: number; limite_por_hora: number; ativada_em: string };
type Candidato = { id: string; publicacao_id: string; id_na_rede: string; pai_id_na_rede: string | null; texto: string; quando: string | null; nosso: boolean; estado: string };

/**
 * Roda as regras ligadas de UMA conta sobre os comentários que acabaram de ser
 * lidos. Chamado pela leitura dos comentários, depois de fechar o que a conta
 * já respondeu por outro caminho. Devolve quantas respostas saíram.
 */
export async function rodarAutomacoes(db: SupabaseClient, conta: Conta, m: ModuloDaRede, credenciais: Credenciais, ate: number): Promise<number> {
  if (!m.responderComentario) return 0;
  const { data: regrasCruas } = await db.from("redes_automacoes").select("id, publicacao_id, palavras, resposta, espera_min, limite_por_hora, ativada_em").eq("conta_id", conta.id).eq("ativa", true).not("ativada_em", "is", null);
  const regras = (regrasCruas ?? []) as RegraAtiva[];
  if (!regras.length) return 0;

  const maisAntiga = regras.reduce((min, r) => (r.ativada_em < min ? r.ativada_em : min), regras[0].ativada_em);
  const { data: comentarios } = await db
    .from("redes_comentarios")
    .select("id, publicacao_id, id_na_rede, pai_id_na_rede, texto, quando, nosso, estado")
    .eq("conta_id", conta.id)
    .eq("estado", "novo")
    .eq("nosso", false)
    .is("pai_id_na_rede", null)
    .gte("quando", maisAntiga)
    .order("quando", { ascending: true })
    .limit(200);
  const candidatos = (comentarios ?? []) as Candidato[];
  if (!candidatos.length) return 0;

  const umaHora = new Date(Date.now() - 3_600_000).toISOString();
  let respondidas = 0;
  for (const regra of regras) {
    const { count: naHora } = await db.from("redes_automacoes_envios").select("comentario_id", { count: "exact", head: true }).eq("automacao_id", regra.id).gt("criado_em", umaHora);
    let cabem = regra.limite_por_hora - (naHora ?? 0);

    for (const c of candidatos) {
      if (cabem <= 0 || respondidas >= POR_RODADA || Date.now() > ate) break;
      if (regra.publicacao_id && c.publicacao_id !== regra.publicacao_id) continue;
      if (!deveResponder({ texto: c.texto, quando: c.quando, nosso: c.nosso, ehResposta: Boolean(c.pai_id_na_rede), estado: c.estado }, { palavras: regra.palavras, ativadaEm: regra.ativada_em, esperaMin: regra.espera_min }, Date.now())) continue;

      // Reserva o comentário: a chave única barra a segunda regra e a segunda rodada.
      const reserva = await db.from("redes_automacoes_envios").insert({ comentario_id: c.id, automacao_id: regra.id, estado: "enviando" });
      if (reserva.error) continue;

      // A conta respondeu neste fio desde a leitura? Então a vez já foi de outra ferramenta ou de uma pessoa.
      const { count: jaTem } = await db.from("redes_comentarios").select("id", { count: "exact", head: true }).eq("publicacao_id", c.publicacao_id).eq("pai_id_na_rede", c.id_na_rede).eq("nosso", true);
      if ((jaTem ?? 0) > 0) {
        await db.from("redes_automacoes_envios").delete().eq("comentario_id", c.id);
        await db.from("redes_comentarios").update({ estado: "respondido", atualizado_em: agora() }).eq("id", c.id);
        c.estado = "respondido";
        continue;
      }

      try {
        const r = await m.responderComentario({ credenciais, conta, comentarioIdNaRede: c.id_na_rede, texto: regra.resposta });
        const quando = agora();
        await db.from("redes_automacoes_envios").update({ estado: "respondido" }).eq("comentario_id", c.id);
        await db.from("redes_comentarios").update({ estado: "respondido", respondido_em: quando, resposta_id_na_rede: r.idNaRede, atualizado_em: quando }).eq("id", c.id);
        if (r.idNaRede) {
          await db.from("redes_comentarios").upsert(
            { conta_id: conta.id, publicacao_id: c.publicacao_id, rede: conta.rede, id_na_rede: r.idNaRede, pai_id_na_rede: c.id_na_rede, autor: conta.usuario || conta.nome || "", texto: regra.resposta, quando, nosso: true, atualizado_em: quando },
            { onConflict: "conta_id,id_na_rede" },
          );
        }
        c.estado = "respondido";
        respondidas++;
        cabem--;
      } catch (e) {
        // A reserva FICA, marcada como falha: este comentário não ganha segunda tentativa automática.
        const motivo = e instanceof Error ? e.message : "erro";
        await db.from("redes_automacoes_envios").update({ estado: "falhou", erro: motivo.slice(0, 300) }).eq("comentario_id", c.id);
        // Token morto ou limite de uso valem para a conta inteira: param a rodada.
        if (e instanceof ErroDaRede && (e.tokenMorto || e.parar)) throw e;
      }
    }
  }
  return respondidas;
}
