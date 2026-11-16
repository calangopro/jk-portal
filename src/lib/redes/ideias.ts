import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { lerBio } from "@/lib/bio/ler";
import { diaEmSaoPaulo } from "./calendario";
import { lerConteudos } from "./conteudos-dados";
import type { Conteudo } from "./conteudos";
import { proximasDatas, type DataQueVem } from "./datas";
import { ehRede, type Formato, type RedeId } from "./redes";
import { temTravessao } from "./regras";

/**
 * O banco de ideias do Social Media (0089). Tela e conector chamam este
 * núcleo; a escrita é só da chave de serviço, e quem chama já conferiu a área
 * `redes`.
 *
 * Os estados "agendada" e "publicada" não se escolhem: vêm do post ligado à
 * ideia, por gatilho no banco. A pessoa só move entre "ideia" e "produzindo",
 * ou descarta.
 */

export type EstadoDaIdeia = "ideia" | "produzindo" | "agendada" | "publicada" | "descartada";
export type OrigemDaIdeia = "manual" | "em_alta" | "comentario" | "data" | "conector";

export type IdeiaNaTela = {
  id: string;
  titulo: string;
  notas: string;
  formato: Formato | null;
  redes: RedeId[];
  quando: string | null;
  estado: EstadoDaIdeia;
  origem: OrigemDaIdeia;
  publicacaoId: string | null;
  postId: string | null;
  criadaPor: string | null;
  criadaEm: string;
};

export type DadosDaIdeia = { titulo: string; notas?: string | null; formato?: string | null; redes?: string[]; quando?: string | null; origem?: OrigemDaIdeia; publicacaoId?: string | null };

export type Resultado<T = object> = ({ ok: true } & T) | { ok: false; erro: string };
const falha = (erro: string): { ok: false; erro: string } => ({ ok: false, erro });

const FORMATOS: Formato[] = ["post", "carrossel", "video_curto", "story", "video", "texto"];
const ORIGENS: OrigemDaIdeia[] = ["manual", "em_alta", "comentario", "data", "conector"];

type Linha = {
  id: string; titulo: string; notas: string | null; formato: string | null; redes: string[] | null; quando: string | null; estado: string; origem: string;
  publicacao_id: string | null; post_id: string | null; criada_por: string | null; criada_em: string;
};

function naTela(l: Linha, nomes: Map<string, string>): IdeiaNaTela {
  return {
    id: l.id,
    titulo: l.titulo,
    notas: l.notas ?? "",
    formato: FORMATOS.includes(l.formato as Formato) ? (l.formato as Formato) : null,
    redes: (l.redes ?? []).filter(ehRede) as RedeId[],
    quando: l.quando,
    estado: l.estado as EstadoDaIdeia,
    origem: l.origem as OrigemDaIdeia,
    publicacaoId: l.publicacao_id,
    postId: l.post_id,
    criadaPor: l.criada_por ? nomes.get(l.criada_por) ?? null : null,
    criadaEm: l.criada_em,
  };
}

/** Confere e limpa o que veio da tela ou do conector. */
function conferir(d: DadosDaIdeia): Resultado<{ linha: Record<string, unknown> }> {
  const titulo = String(d.titulo ?? "").replace(/\s+/g, " ").trim();
  if (titulo.length < 2) return falha("Escreva a ideia em pelo menos duas letras.");
  if (titulo.length > 160) return falha("O título da ideia passa de 160 caracteres. O resto vai nas notas.");
  const notas = String(d.notas ?? "").replace(/\r\n/g, "\n").trim();
  if (notas.length > 4000) return falha("As notas passam de 4.000 caracteres.");
  if (temTravessao(titulo) || temTravessao(notas)) return falha("Troque o travessão por vírgula ou ponto: a casa não usa travessão.");
  const formato = d.formato ? String(d.formato) : null;
  if (formato && !FORMATOS.includes(formato as Formato)) return falha("Formato desconhecido.");
  const quando = d.quando ? String(d.quando) : null;
  if (quando && !/^\d{4}-\d{2}-\d{2}$/.test(quando)) return falha("Data inválida. Use AAAA-MM-DD.");
  const redes = [...new Set((d.redes ?? []).map(String).filter(ehRede))];
  const origem = d.origem && ORIGENS.includes(d.origem) ? d.origem : "manual";
  const publicacao = d.publicacaoId && /^[0-9a-f-]{36}$/.test(d.publicacaoId) ? d.publicacaoId : null;
  return { ok: true, linha: { titulo, notas: notas || null, formato, quando, redes, origem, publicacao_id: publicacao } };
}

async function nomesDe(db: SupabaseClient, ids: (string | null)[]): Promise<Map<string, string>> {
  const unicos = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  if (!unicos.length) return new Map();
  const { data } = await db.from("profiles").select("id, full_name, email").in("id", unicos);
  return new Map(((data ?? []) as { id: string; full_name: string | null; email: string | null }[]).map((p) => [p.id, p.full_name || (p.email ?? "").split("@")[0] || "alguém"]));
}

/** As ideias vivas, mais as publicadas dos últimos 30 dias. Descartada não volta. */
export async function listarIdeias(db: SupabaseClient): Promise<IdeiaNaTela[]> {
  const desde = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data, error } = await db
    .from("redes_ideias")
    .select("id, titulo, notas, formato, redes, quando, estado, origem, publicacao_id, post_id, criada_por, criada_em")
    .or(`estado.in.(ideia,produzindo,agendada),and(estado.eq.publicada,atualizado_em.gte.${desde})`)
    .order("quando", { ascending: true, nullsFirst: false })
    .order("criada_em", { ascending: false })
    .limit(300);
  if (error) {
    console.error("[redes] ideias:", error.message);
    return [];
  }
  const linhas = (data ?? []) as Linha[];
  const nomes = await nomesDe(db, linhas.map((l) => l.criada_por));
  return linhas.map((l) => naTela(l, nomes));
}

export async function lerIdeia(db: SupabaseClient, id: string): Promise<IdeiaNaTela | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const { data } = await db.from("redes_ideias").select("id, titulo, notas, formato, redes, quando, estado, origem, publicacao_id, post_id, criada_por, criada_em").eq("id", id).maybeSingle();
  return data ? naTela(data as Linha, new Map()) : null;
}

export async function criarIdeia(db: SupabaseClient, quem: { id: string }, dados: DadosDaIdeia): Promise<Resultado<{ id: string }>> {
  const c = conferir(dados);
  if (!c.ok) return c;
  const { data, error } = await db.from("redes_ideias").insert({ ...c.linha, criada_por: quem.id }).select("id").single();
  if (error || !data) return falha(error?.message ?? "A ideia não foi gravada.");
  return { ok: true, id: data.id as string };
}

export async function editarIdeia(db: SupabaseClient, id: string, dados: DadosDaIdeia): Promise<Resultado> {
  const c = conferir(dados);
  if (!c.ok) return c;
  const { origem: _o, publicacao_id: _p, ...resto } = c.linha;
  const { error } = await db.from("redes_ideias").update({ ...resto, atualizado_em: new Date().toISOString() }).eq("id", id);
  return error ? falha(error.message) : { ok: true };
}

/** Move entre "ideia" e "produzindo", ou descarta. Agendada e publicada vêm do post. */
export async function mudarEstadoDaIdeia(db: SupabaseClient, id: string, estado: "ideia" | "produzindo" | "descartada"): Promise<Resultado> {
  const { error } = await db.from("redes_ideias").update({ estado, atualizado_em: new Date().toISOString() }).eq("id", id);
  return error ? falha(error.message) : { ok: true };
}

/** O rascunho que nasceu da ideia fica ligado a ela; daí em diante o estado segue o do post. */
export async function ligarIdeiaAoPost(db: SupabaseClient, id: string, postId: string): Promise<Resultado> {
  if (!/^[0-9a-f-]{36}$/.test(id) || !/^[0-9a-f-]{36}$/.test(postId)) return falha("Ideia ou post desconhecido.");
  const { data: post } = await db.from("redes_posts").select("status").eq("id", postId).maybeSingle();
  if (!post) return falha("Post não encontrado.");
  const estado = post.status === "agendado" || post.status === "publicando" ? "agendada" : post.status === "publicado" || post.status === "parcial" ? "publicada" : "produzindo";
  const { error } = await db.from("redes_ideias").update({ post_id: postId, estado, atualizado_em: new Date().toISOString() }).eq("id", id).neq("estado", "descartada");
  return error ? falha(error.message) : { ok: true };
}

// ------------------------------------------------------------------ de onde tirar ideia

export type PerguntaDosComentarios = { id: string; texto: string; rede: RedeId; publicacaoId: string; quando: string | null };
export type FontesDeIdeia = { emAlta: Conteudo[]; perguntas: PerguntaDosComentarios[]; datas: DataQueVem[] };

/**
 * O que pode virar ideia: o que rendeu acima do normal nos últimos 30 dias
 * (e ainda não virou ideia), as perguntas que apareceram nos comentários e as
 * datas dos próximos 60 dias. Comentário vem SEM o nome de quem escreveu.
 */
export async function fontesDeIdeia(db: SupabaseClient, agora = Date.now()): Promise<FontesDeIdeia> {
  const desde = new Date(agora - 30 * 86_400_000).toISOString();
  const [conteudos, usadas, comentarios, bio] = await Promise.all([
    lerConteudos(db, 30),
    db.from("redes_ideias").select("publicacao_id").not("publicacao_id", "is", null).limit(500),
    db.from("redes_comentarios").select("id, texto, rede, publicacao_id, quando").eq("nosso", false).gte("quando", desde).ilike("texto", "%?%").order("quando", { ascending: false }).limit(80),
    lerBio().catch(() => null),
  ]);
  const jaViraram = new Set(((usadas.data ?? []) as { publicacao_id: string }[]).map((l) => l.publicacao_id));
  const emAlta = (conteudos?.conteudos ?? []).filter((c) => c.acima && c.grupo !== "story" && !jaViraram.has(c.id)).sort((a, b) => (b.fator ?? 0) - (a.fator ?? 0)).slice(0, 6);

  // Pergunta de verdade: com ponto de interrogação, nem curta demais nem um texto inteiro. Repetida conta uma vez.
  const vistas = new Set<string>();
  const perguntas: PerguntaDosComentarios[] = [];
  for (const c of (comentarios.data ?? []) as { id: string; texto: string; rede: string; publicacao_id: string; quando: string | null }[]) {
    const texto = c.texto.replace(/\s+/g, " ").trim();
    const chave = texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, "");
    if (texto.length < 12 || texto.length > 220 || !ehRede(c.rede) || vistas.has(chave)) continue;
    vistas.add(chave);
    perguntas.push({ id: c.id, texto, rede: c.rede, publicacaoId: c.publicacao_id, quando: c.quando });
    if (perguntas.length >= 8) break;
  }

  const campanhas = (bio?.campanhas ?? []).map((c) => ({ nome: c.nome, inicio: c.inicio, fim: c.fim, ativa: c.ativa }));
  return { emAlta, perguntas, datas: proximasDatas(diaEmSaoPaulo(agora), 60, campanhas) };
}
