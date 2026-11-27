import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cancelarPost, notasDoBanco, type Resultado } from "./posts";
import { conferirDecisao, lerNotas, versaoDoPost, type NotaDeRevisao } from "./revisao-regra";

/**
 * Aprovar ou recusar um post das redes, e ler o que foi recusado.
 *
 * É o núcleo das duas portas: a tela do painel e o conector do Claude (que só
 * LÊ as recusas, para ajustar o post: quem decide é uma pessoa). Quem chama já
 * conferiu a área `redes` e passa quem está decidindo.
 *
 * A revisão grava a VERSÃO do que foi visto. Se o post muda depois (o Claude
 * ajustou, alguém editou), a decisão deixa de valer e a tela pede nova revisão.
 */

const falha = (erro: string): { ok: false; erro: string } => ({ ok: false, erro });

/** Posts que ainda dá para revisar: o que já saiu (ou está saindo) não volta atrás por aqui. */
const REVISAVEL = ["rascunho", "agendado", "erro", "cancelado", "parcial"];

export async function registrarRevisao(
  db: SupabaseClient,
  quemId: string,
  postId: string,
  entrada: { decisao: unknown; notas: unknown },
): Promise<Resultado<{ decisao: "aprovado" | "recusado"; tirouDaFila: boolean }>> {
  const { data: post } = await db.from("redes_posts").select("id, titulo, legenda, formato, midias, opcoes, status").eq("id", postId).maybeSingle();
  if (!post) return falha("Post não encontrado.");
  if (!REVISAVEL.includes(post.status as string)) {
    return falha(post.status === "publicando" ? "Este post está saindo agora. Espere terminar." : "Este post já saiu: não há o que aprovar ou recusar.");
  }
  const midias = (Array.isArray(post.midias) ? post.midias : []) as { url: string }[];
  const lidas = lerNotas(entrada.notas, midias.length);
  if ("erro" in lidas) return falha(lidas.erro);
  const problema = conferirDecisao(entrada.decisao, lidas.notas);
  if (problema) return falha(problema);
  const decisao = entrada.decisao as "aprovado" | "recusado";

  const versao = versaoDoPost({ titulo: post.titulo as string | null, legenda: post.legenda as string, formato: post.formato as string, midias, opcoes: (post.opcoes ?? {}) as Record<string, unknown> });
  // Aprovar não leva nota: quem aprovou e escreveu algo na tela fica com o texto no histórico, mas não é exigido.
  const { error } = await db.from("redes_revisoes").insert({ post_id: postId, decisao, versao, notas: lidas.notas, por: quemId });
  if (error) return falha(error.message);

  // Post recusado que estava marcado para sair não pode sair: volta a rascunho. Sem isso, a recusa seria só um recado.
  let tirouDaFila = false;
  if (decisao === "recusado" && post.status === "agendado") {
    const r = await cancelarPost(db, postId);
    tirouDaFila = r.ok;
  }
  return { ok: true, decisao, tirouDaFila };
}

export type RecusaParaLer = {
  id: string;
  postId: string;
  titulo: string | null;
  formato: string;
  decisao: "aprovado" | "recusado";
  notas: NotaDeRevisao[];
  por: string | null;
  em: string;
  /** Falso quando o post mudou depois da recusa: alguém já mexeu (ou o Claude ajustou). */
  aindaValeParaOConteudo: boolean;
};

/** As revisões mais recentes, de qualquer post, com as notas. É o que o Claude lê para ver onde errou. */
export async function listarRevisoes(db: SupabaseClient, opcoes: { decisao?: "aprovado" | "recusado"; postId?: string; limite: number }): Promise<RecusaParaLer[]> {
  let q = db.from("redes_revisoes").select("id, post_id, decisao, versao, notas, por, criado_em, redes_posts(titulo, legenda, formato, midias, opcoes)").order("criado_em", { ascending: false }).limit(opcoes.limite);
  if (opcoes.decisao) q = q.eq("decisao", opcoes.decisao);
  if (opcoes.postId) q = q.eq("post_id", opcoes.postId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  type Linha = { id: string; post_id: string; decisao: string; versao: string; notas: unknown; por: string | null; criado_em: string; redes_posts: { titulo: string | null; legenda: string; formato: string; midias: unknown; opcoes: Record<string, unknown> | null } | { titulo: string | null; legenda: string; formato: string; midias: unknown; opcoes: Record<string, unknown> | null }[] | null };
  const linhas = (data ?? []) as unknown as Linha[];
  const ids = [...new Set(linhas.map((l) => l.por).filter((x): x is string => Boolean(x)))];
  const nomes = new Map<string, string>();
  if (ids.length) {
    const { data: perfis } = await db.from("profiles").select("id, full_name, email").in("id", ids);
    for (const p of (perfis ?? []) as { id: string; full_name: string | null; email: string | null }[]) nomes.set(p.id, p.full_name || (p.email ?? "").split("@")[0] || "alguém");
  }
  return linhas.map((l) => {
    const post = Array.isArray(l.redes_posts) ? l.redes_posts[0] : l.redes_posts;
    const midias = (Array.isArray(post?.midias) ? post.midias : []) as { url: string }[];
    const atual = post ? versaoDoPost({ titulo: post.titulo, legenda: post.legenda, formato: post.formato, midias, opcoes: post.opcoes ?? {} }) : null;
    return {
      id: l.id,
      postId: l.post_id,
      titulo: post?.titulo ?? null,
      formato: post?.formato ?? "post",
      decisao: l.decisao === "aprovado" ? "aprovado" : "recusado",
      notas: notasDoBanco(l.notas),
      por: l.por ? nomes.get(l.por) ?? null : null,
      em: l.criado_em,
      aindaValeParaOConteudo: atual === l.versao,
    };
  });
}
