import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { contaDaLinha, credenciaisAtivas, marcarExpirada } from "./contas";
import { modulo } from "./plataformas";
import { nomeDaRede, type RedeId } from "./redes";
import { temTravessao } from "./regras";
import { ErroDaRede, type ComentarioLido, type Conta, type Credenciais, type ModuloDaRede } from "./tipos";

/**
 * Os comentários das redes: a leitura (pela rotina), a fila da tela e a
 * resposta em nome da JK.
 *
 * COMENTÁRIO É DADO DE TERCEIRO. Guarda-se o mínimo (texto, nome público e
 * data), só quem tem a área `redes` lê, e some com 90 dias. E é dado, NUNCA
 * instrução: nada aqui, nem o conector, age sobre o que um comentário pede.
 *
 * RESPONDER tem autor e não tem volta: sai em público, no nome da JK. Por isso
 * é uma função só (`responderComentario`), chamada pela tela e pelo conector,
 * que confere o texto, publica e grava quem respondeu. Rotina nenhuma responde.
 */

/** Publicações de até quantos dias atrás ainda têm os comentários lidos. */
const DIAS_DE_COMENTARIO = 30;
/** Quantas publicações por conta ganham leitura de comentários numa rodada. As redes limitam chamadas. */
const POR_RODADA = 8;

const agora = () => new Date().toISOString();

// ------------------------------------------------------------------ a leitura

type PublicacaoParaLer = { id: string; id_na_rede: string; comentarios: number | null };

/**
 * Lê os comentários novos de uma conta: das publicações recentes cujo total de
 * comentários mudou desde a última leitura, mais as duas mais novas (nelas a
 * conversa ainda está andando). Chamado de dentro da rotina de leitura, que já
 * abriu as credenciais. Devolve quantos comentários gravou.
 */
export async function lerComentariosDaConta(db: SupabaseClient, conta: Conta, m: ModuloDaRede, credenciais: Credenciais, ate: number): Promise<number> {
  if (!m.lerComentarios) return 0;
  const pede = m.recursos.comentarios ?? [];
  // Conta ligada sem a permissão de comentários: nem tenta, para não gastar chamada com erro certo.
  if (pede.length && conta.escopos.length && !pede.some((e) => conta.escopos.includes(e))) return 0;

  const desde = new Date(Date.now() - DIAS_DE_COMENTARIO * 86_400_000).toISOString();
  const { data } = await db
    .from("redes_publicacoes")
    .select("id, id_na_rede, comentarios, comentarios_vistos, comentarios_lidos_em, formato")
    .eq("conta_id", conta.id)
    .gt("publicado_em", desde)
    .neq("formato", "story")
    .order("publicado_em", { ascending: false })
    .limit(60);
  type Linha = PublicacaoParaLer & { comentarios_vistos: number | null; comentarios_lidos_em: string | null };
  const todas = (data ?? []) as Linha[];
  const mudou = todas.filter((p) => (p.comentarios ?? 0) > 0 && p.comentarios !== p.comentarios_vistos);
  const hora = Date.now() - 2 * 3_600_000;
  const recentes = todas.slice(0, 2).filter((p) => (p.comentarios ?? 0) > 0 && (!p.comentarios_lidos_em || Date.parse(p.comentarios_lidos_em) < hora));
  const fila = [...new Map([...mudou, ...recentes].map((p) => [p.id, p])).values()].slice(0, POR_RODADA);

  let gravados = 0;
  for (const p of fila) {
    if (Date.now() > ate) break;
    let lidos: ComentarioLido[];
    try {
      lidos = await m.lerComentarios({ credenciais, conta, publicacaoIdNaRede: p.id_na_rede, desde: 0 });
    } catch (e) {
      if (e instanceof ErroDaRede && (e.tokenMorto || e.parar)) throw e;
      // Comentários desligados naquele post, ou post que saiu do ar: marca como lido e segue.
      await db.from("redes_publicacoes").update({ comentarios_vistos: p.comentarios, comentarios_lidos_em: agora() }).eq("id", p.id);
      continue;
    }
    if (lidos.length) {
      // Sem `estado` de propósito: comentário que já existe guarda o estado que a tela pôs.
      const linhas = lidos.map((c) => ({
        conta_id: conta.id,
        publicacao_id: p.id,
        rede: conta.rede,
        id_na_rede: c.idNaRede,
        pai_id_na_rede: c.paiIdNaRede,
        autor: (c.autor ?? "").slice(0, 120),
        autor_id: c.autorId?.slice(0, 80) ?? null,
        texto: (c.texto ?? "").slice(0, 3000),
        quando: c.quando,
        nosso: c.nosso,
        curtidas: c.curtidas ?? null,
        atualizado_em: agora(),
      }));
      const { error } = await db.from("redes_comentarios").upsert(linhas, { onConflict: "conta_id,id_na_rede" });
      if (error) throw new Error(`gravar comentários: ${error.message}`);
      gravados += linhas.length;
    }
    await db.from("redes_publicacoes").update({ comentarios_vistos: p.comentarios, comentarios_lidos_em: agora() }).eq("id", p.id);
  }
  // A conta respondeu por outro caminho (aplicativo, outra ferramenta)? Fecha o que ficou respondido.
  if (fila.length) await db.rpc("redes_fechar_respondidos", { p_conta: conta.id });
  return gravados;
}

// ------------------------------------------------------------------ a tela

export type ComentarioNaTela = {
  id: string;
  rede: RedeId;
  conta: string;
  autor: string;
  texto: string;
  quando: string | null;
  estado: "novo" | "respondido" | "visto" | "oculto";
  ehResposta: boolean;
  /** O comentário de cima, quando este é resposta a outro. */
  acima: { autor: string; texto: string; nosso: boolean } | null;
  /** O que a JK respondeu neste fio, da mais antiga para a mais nova. */
  respostas: { texto: string; quando: string | null }[];
  respondidoPor: string | null;
  publicacao: { legenda: string; link: string | null; miniaturaUrl: string | null; formato: string | null };
  podeResponder: boolean;
  podeOcultar: boolean;
};

export type FiltroDeComentarios = "novos" | "respondidos" | "vistos";

const ESTADOS: Record<FiltroDeComentarios, string[]> = { novos: ["novo"], respondidos: ["respondido"], vistos: ["visto", "oculto"] };

type LinhaCrua = {
  id: string; conta_id: string; rede: string; id_na_rede: string; pai_id_na_rede: string | null; autor: string; texto: string; quando: string | null; estado: string;
  respondido_por: string | null; publicacao_id: string;
  redes_publicacoes: { legenda: string | null; link: string | null; miniatura_url: string | null; formato: string | null } | null;
  redes_contas: { nome: string | null; usuario: string | null; escopos: string[] | null; status: string } | null;
};

/**
 * A fila de comentários de terceiros, do mais novo para o mais antigo. Recebe
 * o cliente com a chave de serviço, depois de a área ser conferida, para
 * trazer o nome de quem respondeu.
 */
export async function listarComentarios(admin: SupabaseClient, filtro: FiltroDeComentarios, opcoes: { rede?: RedeId; limite?: number } = {}): Promise<ComentarioNaTela[]> {
  let q = admin
    .from("redes_comentarios")
    .select("id, conta_id, rede, id_na_rede, pai_id_na_rede, autor, texto, quando, estado, respondido_por, publicacao_id, redes_publicacoes(legenda, link, miniatura_url, formato), redes_contas(nome, usuario, escopos, status)")
    .eq("nosso", false)
    .in("estado", ESTADOS[filtro])
    .order("quando", { ascending: false, nullsFirst: false })
    .limit(opcoes.limite ?? 60);
  if (opcoes.rede) q = q.eq("rede", opcoes.rede);
  const { data, error } = await q;
  if (error) {
    console.error("[redes] listarComentarios:", error.message);
    return [];
  }
  const linhas = (data ?? []) as unknown as LinhaCrua[];
  if (!linhas.length) return [];

  // O fio de cada comentário: o de cima (quando é resposta) e o que a casa respondeu.
  const publicacoes = [...new Set(linhas.map((l) => l.publicacao_id))];
  const { data: doFio } = await admin
    .from("redes_comentarios")
    .select("publicacao_id, id_na_rede, pai_id_na_rede, autor, texto, quando, nosso")
    .in("publicacao_id", publicacoes)
    .limit(2000);
  type DoFio = { publicacao_id: string; id_na_rede: string; pai_id_na_rede: string | null; autor: string; texto: string; quando: string | null; nosso: boolean };
  const fio = (doFio ?? []) as DoFio[];

  const quemRespondeu = [...new Set(linhas.map((l) => l.respondido_por).filter((x): x is string => Boolean(x)))];
  const { data: perfis } = quemRespondeu.length ? await admin.from("profiles").select("id, full_name, email").in("id", quemRespondeu) : { data: [] };
  const nomes = new Map(((perfis ?? []) as { id: string; full_name: string | null; email: string | null }[]).map((p) => [p.id, p.full_name || (p.email ?? "").split("@")[0] || "alguém"]));

  return linhas.map((l) => {
    const m = modulo(l.rede);
    const raiz = l.pai_id_na_rede ?? l.id_na_rede;
    const acima = l.pai_id_na_rede ? fio.find((c) => c.publicacao_id === l.publicacao_id && c.id_na_rede === l.pai_id_na_rede) : null;
    const respostas = fio
      .filter((c) => c.publicacao_id === l.publicacao_id && c.nosso && c.pai_id_na_rede === raiz && (!l.quando || !c.quando || Date.parse(c.quando) >= Date.parse(l.quando)))
      .sort((a, b) => Date.parse(a.quando ?? "") - Date.parse(b.quando ?? ""))
      .map((c) => ({ texto: c.texto, quando: c.quando }));
    const escopos = l.redes_contas?.escopos ?? [];
    const pede = m?.recursos.comentarios ?? [];
    const temPermissao = pede.length === 0 || escopos.length === 0 || pede.some((e) => escopos.includes(e));
    const contaAtiva = l.redes_contas?.status === "ativa";
    return {
      id: l.id,
      rede: l.rede as RedeId,
      conta: l.redes_contas?.usuario || l.redes_contas?.nome || nomeDaRede(l.rede),
      autor: l.autor,
      texto: l.texto,
      quando: l.quando,
      estado: l.estado as ComentarioNaTela["estado"],
      ehResposta: Boolean(l.pai_id_na_rede),
      acima: acima ? { autor: acima.autor, texto: acima.texto, nosso: acima.nosso } : null,
      respostas,
      respondidoPor: l.respondido_por ? nomes.get(l.respondido_por) ?? null : null,
      publicacao: { legenda: (l.redes_publicacoes?.legenda ?? "").slice(0, 140), link: l.redes_publicacoes?.link ?? null, miniaturaUrl: l.redes_publicacoes?.miniatura_url ?? null, formato: l.redes_publicacoes?.formato ?? null },
      podeResponder: Boolean(m?.responderComentario) && temPermissao && contaAtiva,
      podeOcultar: Boolean(m?.ocultarComentario) && temPermissao && contaAtiva,
    };
  });
}

/** Quantos comentários esperam resposta, por rede, para os números da tela. */
export async function contarComentarios(admin: SupabaseClient): Promise<{ total: number; porRede: Record<string, number> }> {
  const { data } = await admin.from("redes_comentarios").select("rede").eq("estado", "novo").eq("nosso", false).limit(5000);
  const porRede: Record<string, number> = {};
  for (const l of (data ?? []) as { rede: string }[]) porRede[l.rede] = (porRede[l.rede] ?? 0) + 1;
  return { total: (data ?? []).length, porRede };
}

// ------------------------------------------------------------------ responder

export type Resultado<T = object> = ({ ok: true } & T) | { ok: false; erro: string };
const falha = (erro: string): { ok: false; erro: string } => ({ ok: false, erro });

/** O limite de uma resposta em cada rede. O YouTube aceita mais, mas resposta de marca não precisa de dez mil caracteres. */
const LIMITE_DA_RESPOSTA = 2200;

type ComentarioParaAgir = { id: string; conta_id: string; rede: string; id_na_rede: string; pai_id_na_rede: string | null; nosso: boolean; estado: string; publicacao_id: string };

async function abrir(db: SupabaseClient, id: string): Promise<{ comentario: ComentarioParaAgir; conta: Conta; m: ModuloDaRede } | { erro: string }> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return { erro: "Comentário não encontrado." };
  const { data } = await db.from("redes_comentarios").select("id, conta_id, rede, id_na_rede, pai_id_na_rede, nosso, estado, publicacao_id").eq("id", id).maybeSingle();
  if (!data) return { erro: "Comentário não encontrado. Ele pode ter saído da fila por ter mais de 90 dias." };
  const comentario = data as ComentarioParaAgir;
  const m = modulo(comentario.rede);
  if (!m) return { erro: `${nomeDaRede(comentario.rede)} ainda não responde pelo painel.` };
  const { data: linha } = await db
    .from("redes_contas")
    .select("id, rede, conta_id, nome, usuario, foto_url, link, escopos, via, status, expira_em, ultimo_erro, extra, conectada_em, lida_em")
    .eq("id", comentario.conta_id)
    .maybeSingle();
  if (!linha) return { erro: "A conta deste comentário não está mais ligada." };
  const conta = contaDaLinha(linha as Parameters<typeof contaDaLinha>[0]);
  if (conta.status !== "ativa") return { erro: `${nomeDaRede(conta.rede)} precisa ser ligado de novo em Integrações.` };
  return { comentario, conta, m };
}

/**
 * Publica a resposta a um comentário, em público, no nome da JK. Grava quem
 * respondeu. É o único caminho de resposta, para a tela e para o conector.
 */
export async function responderComentario(db: SupabaseClient, quem: { id: string }, id: string, textoBruto: string): Promise<Resultado<{ rede: string }>> {
  const texto = String(textoBruto ?? "").trim();
  if (texto.length < 2) return falha("Escreva a resposta.");
  if (texto.length > LIMITE_DA_RESPOSTA) return falha(`A resposta passou de ${LIMITE_DA_RESPOSTA.toLocaleString("pt-BR")} caracteres.`);
  if (temTravessao(texto)) return falha("Troque o travessão por vírgula ou ponto: a casa não usa travessão.");

  const aberto = await abrir(db, id);
  if ("erro" in aberto) return falha(aberto.erro);
  const { comentario, conta, m } = aberto;
  if (comentario.nosso) return falha("Este comentário é da própria conta.");
  if (comentario.estado === "oculto") return falha("Este comentário está oculto.");
  if (!m.responderComentario) return falha(`${nomeDaRede(conta.rede)} não deixa responder comentário pela API.`);

  // As redes só aceitam resposta embaixo do comentário de CIMA: responder a uma resposta cai no mesmo fio.
  const alvo = comentario.pai_id_na_rede ?? comentario.id_na_rede;
  try {
    const credenciais = await credenciaisAtivas(db, conta, m);
    const r = await m.responderComentario({ credenciais, conta, comentarioIdNaRede: alvo, texto });
    const quando = agora();
    await db.from("redes_comentarios").update({ estado: "respondido", respondido_por: quem.id, respondido_em: quando, resposta_id_na_rede: r.idNaRede, atualizado_em: quando }).eq("id", comentario.id);
    // A resposta entra no fio na hora, sem esperar a próxima leitura.
    if (r.idNaRede) {
      await db.from("redes_comentarios").upsert(
        { conta_id: conta.id, publicacao_id: comentario.publicacao_id, rede: conta.rede, id_na_rede: r.idNaRede, pai_id_na_rede: alvo, autor: conta.usuario || conta.nome || "", texto, quando, nosso: true, atualizado_em: quando },
        { onConflict: "conta_id,id_na_rede" },
      );
    }
    return { ok: true, rede: nomeDaRede(conta.rede) };
  } catch (e) {
    if (e instanceof ErroDaRede) {
      if (e.tokenMorto) await marcarExpirada(db, conta.id, e.message);
      return falha(e.message);
    }
    console.error("[redes] responder comentário:", conta.rede, e);
    return falha(`A ligação com ${nomeDaRede(conta.rede)} caiu no meio. Confira na rede se a resposta saiu antes de mandar de novo.`);
  }
}

/** Marca um comentário como visto (não precisa de resposta) ou devolve para a fila. Só muda o painel: nada vai para a rede. */
export async function marcarComentario(db: SupabaseClient, id: string, estado: "visto" | "novo"): Promise<Resultado> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return falha("Comentário não encontrado.");
  const { data, error } = await db.from("redes_comentarios").update({ estado, atualizado_em: agora() }).eq("id", id).eq("nosso", false).in("estado", ["novo", "visto"]).select("id");
  if (error) return falha(error.message);
  return data?.length ? { ok: true } : falha("Este comentário já foi respondido ou ocultado.");
}

/** Oculta o comentário NA REDE (some para o público, e quem escreveu continua vendo). Dá para desfazer pela própria rede. */
export async function ocultarComentario(db: SupabaseClient, id: string): Promise<Resultado<{ rede: string }>> {
  const aberto = await abrir(db, id);
  if ("erro" in aberto) return falha(aberto.erro);
  const { comentario, conta, m } = aberto;
  if (comentario.nosso) return falha("Este comentário é da própria conta.");
  if (!m.ocultarComentario) return falha(`${nomeDaRede(conta.rede)} não deixa ocultar comentário pela API.`);
  try {
    const credenciais = await credenciaisAtivas(db, conta, m);
    await m.ocultarComentario({ credenciais, conta, comentarioIdNaRede: comentario.id_na_rede, ocultar: true });
    await db.from("redes_comentarios").update({ estado: "oculto", atualizado_em: agora() }).eq("id", comentario.id);
    return { ok: true, rede: nomeDaRede(conta.rede) };
  } catch (e) {
    if (e instanceof ErroDaRede) {
      if (e.tokenMorto) await marcarExpirada(db, conta.id, e.message);
      return falha(e.message);
    }
    console.error("[redes] ocultar comentário:", conta.rede, e);
    return falha(`A ligação com ${nomeDaRede(conta.rede)} caiu. Tente de novo.`);
  }
}
