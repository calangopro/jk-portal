"use server";

import { requireArea } from "@/lib/auth/session";
import { lerProdutosDaConsulta, lerRegrasDeEntrega } from "@/lib/consulta/dados";
import { createClient } from "@/lib/supabase/server";
import { respostasParaOTutor } from "@/lib/time/dados";
import { perguntarAoTutor, type ResultadoDoTutor } from "@/lib/tutor/perguntar";
import { TETO_DA_IMAGEM, TETO_POR_DIA } from "@/lib/tutor/regras";
import { hojeEmSaoPaulo } from "@/lib/vendas/periodo";

export type EstadoDoTutor = { ok: true; resposta: ResultadoDoTutor } | { ok: false; erro: string };

/**
 * Faz uma pergunta ao tutor: texto, print, ou os dois.
 *
 * A imagem chega como endereço de dados, já reduzida pelo navegador, vai para
 * o modelo de linguagem e não é guardada. O que fica registrado é a dúvida em
 * uma frase, se o tutor respondeu e em quais respostas da biblioteca se apoiou.
 */
export async function perguntar(duvida: string, imagem: string | null): Promise<EstadoDoTutor> {
  const perfil = await requireArea("time");
  const texto = String(duvida ?? "").trim();
  const print = typeof imagem === "string" && imagem ? imagem : null;
  if (!texto && !print) return { ok: false, erro: "Escreva a dúvida ou cole o print da conversa." };
  if (print && (!/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(print) || print.length > TETO_DA_IMAGEM)) {
    return { ok: false, erro: "Não deu para usar essa imagem. Tente um print menor, em JPG ou PNG." };
  }

  const db = await createClient();
  const hoje = hojeEmSaoPaulo();
  // O teto do dia, contado pelo relógio de São Paulo.
  const { count } = await db.from("tutor_perguntas").select("id", { count: "exact", head: true }).eq("quem", perfil.id).gte("criado_em", `${hoje}T00:00:00-03:00`);
  if ((count ?? 0) >= TETO_POR_DIA) return { ok: false, erro: `Você já fez ${TETO_POR_DIA} perguntas hoje, que é o teto do dia. Para o que falta, abra um chamado.` };

  let resposta: ResultadoDoTutor;
  try {
    resposta = await perguntarAoTutor(
      { duvida: texto, imagem: print },
      { respostas: (t) => respostasParaOTutor(db, t, 6), catalogo: () => lerProdutosDaConsulta(db, hoje), entrega: { hoje, regras: await lerRegrasDeEntrega() } },
    );
  } catch (e) {
    console.error("[tutor] perguntar:", e);
    return { ok: false, erro: "O tutor não respondeu agora. Tente de novo em alguns segundos, ou abra um chamado." };
  }

  const { error } = await db.from("tutor_perguntas").insert({
    quem: perfil.id,
    pergunta: resposta.pergunta.slice(0, 600) || "Print sem texto",
    com_imagem: Boolean(print),
    respondeu: resposta.respondeu,
    usou: resposta.fontes.map((f) => f.id),
  });
  if (error) console.error("[tutor] registrar:", error.message);

  return { ok: true, resposta };
}
