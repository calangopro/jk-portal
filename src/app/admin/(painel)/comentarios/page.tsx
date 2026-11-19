import { requireArea } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ehAdmin } from "@/lib/auth/acessos";
import { TelaDosComentarios, type Linha, type Resposta } from "./Tela";

export const metadata = { title: "Comentários" };

export default async function ComentariosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const perfil = await requireArea("conteudo");
  const filtro = (await searchParams).status ?? "pending";
  const supabase = await createClient();

  // Só comentário de primeiro nível na lista. Resposta da loja é aprovada no
  // ato, então sem este filtro ela apareceria como um cartão solto na aba
  // "Publicados", desligada da pergunta que ela responde.
  let consulta = supabase
    .from("comments")
    .select("id, author_name, author_email, body, status, created_at, ip, contents(title, slug)")
    .is("parent_id", null)
    .order("created_at", { ascending: false })
    .limit(200);

  if (filtro !== "todos") consulta = consulta.eq("status", filtro);

  const { data } = await consulta;
  const itens = (data ?? []) as unknown as Linha[];

  // As respostas dos comentários desta tela, numa consulta só.
  const { data: dadosRespostas } = itens.length
    ? await supabase
        .from("comments")
        .select("id, body, created_at, parent_id, profiles:author_profile_id(full_name)")
        .in("parent_id", itens.map((c) => c.id))
        .order("created_at", { ascending: true })
    : { data: [] };

  const respostasPor = new Map<string, Resposta[]>();
  for (const r of (dadosRespostas ?? []) as unknown as Resposta[]) {
    respostasPor.set(r.parent_id, [...(respostasPor.get(r.parent_id) ?? []), r]);
  }

  const { count: pendentes } = await supabase
    .from("comments").select("*", { count: "exact", head: true }).eq("status", "pending");

  return <TelaDosComentarios itens={itens} respostasPor={respostasPor} pendentes={pendentes} filtro={filtro} souAdmin={ehAdmin(perfil.role)} />;
}
