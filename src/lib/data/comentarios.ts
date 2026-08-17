import { createReadClient } from "@/lib/supabase/read";

export type Comentario = {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
  /** Resposta oficial da loja, e não comentário de visitante. */
  daEquipe: boolean;
};

export type ComentarioComRespostas = Comentario & {
  respostas: Comentario[];
};

type Linha = {
  id: string;
  author_name: string;
  body: string;
  created_at: string;
  parent_id: string | null;
  is_staff_reply: boolean | null;
};

/**
 * Comentários aprovados de um conteúdo publicado, em fio de conversa.
 *
 * O fio tem UM nível: comentário do visitante e, embaixo dele, a resposta da
 * loja. Responder é da equipe (a policy `comments_admin_reply` na 0036 é quem
 * garante isso, não esta função).
 *
 * Resposta cujo comentário-pai saiu do ar não aparece SOZINHA. Isso acontece
 * quando alguém tira a pergunta do ar depois de respondida: a resposta continua
 * aprovada no banco, e sem esta trava ela subiria para a lista de cima, como um
 * comentário solto respondendo a coisa nenhuma.
 */
export async function comentariosAprovados(
  contentId: string,
): Promise<ComentarioComRespostas[]> {
  const supabase = createReadClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from("comments")
      .select("id, author_name, body, created_at, parent_id, is_staff_reply")
      .eq("content_id", contentId)
      .eq("status", "approved")
      .order("created_at", { ascending: true })
      .limit(200);

    if (error || !data) return [];

    const linhas = data as Linha[];
    const paraComentario = (c: Linha): Comentario => ({
      id: c.id,
      authorName: c.author_name,
      body: c.body,
      createdAt: c.created_at,
      daEquipe: c.is_staff_reply === true,
    });

    const raizes = new Map<string, ComentarioComRespostas>();
    for (const linha of linhas) {
      if (linha.parent_id) continue;
      raizes.set(linha.id, { ...paraComentario(linha), respostas: [] });
    }

    for (const linha of linhas) {
      if (!linha.parent_id) continue;
      raizes.get(linha.parent_id)?.respostas.push(paraComentario(linha));
    }

    return [...raizes.values()];
  } catch {
    return [];
  }
}

/**
 * Quantos comentários a página mostra, resposta da loja incluída.
 *
 * É o número do `commentCount` do Article e o do título da seção, e os dois
 * precisam sair da MESMA conta: com o fio de conversa, `lista.length` passou a
 * contar só as perguntas, e a página diria "2 comentários" com quatro balões
 * na tela.
 */
export function contarComentarios(lista: ComentarioComRespostas[]): number {
  return lista.reduce((total, c) => total + 1 + c.respostas.length, 0);
}
