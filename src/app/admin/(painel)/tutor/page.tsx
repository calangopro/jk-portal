import { ehAdmin } from "@/lib/auth/acessos";
import { requireArea } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { perguntar } from "./actions";
import { TelaDoTutor, type PerguntaSemResposta } from "./Tela";

export const metadata = { title: "Tutor" };

// A pergunta ao tutor são até duas chamadas ao modelo de linguagem, perto de 20 segundos com print. O padrão de
// 10 segundos da Vercel cortaria a resposta no meio. A ação de servidor herda o teto da página de onde é chamada.
export const maxDuration = 60;

/**
 * O tutor do vendedor: a pessoa cola o print da conversa ou escreve a dúvida,
 * e ele responde só com o que está na Biblioteca JK e no catálogo.
 *
 * Abre para toda pessoa ativa (área `time`). Administrador, dono e GM veem
 * também o que o time perguntou e a biblioteca não tinha: é a lista do que
 * falta escrever. O desenho mora em `Tela.tsx`.
 */
export default async function TutorPage() {
  const perfil = await requireArea("time");
  let semResposta: PerguntaSemResposta[] = [];
  if (ehAdmin(perfil.role)) {
    const db = await createClient();
    const desde = new Date(Date.now() - 14 * 86_400_000).toISOString();
    const { data } = await db.from("tutor_perguntas").select("id, pergunta, criado_em").eq("respondeu", false).gte("criado_em", desde).order("criado_em", { ascending: false }).limit(40);
    semResposta = (data ?? []).map((l) => ({ id: Number(l.id), pergunta: String(l.pergunta), em: String(l.criado_em) }));
  }
  return <TelaDoTutor perguntar={perguntar} semResposta={ehAdmin(perfil.role) ? semResposta : null} />;
}
