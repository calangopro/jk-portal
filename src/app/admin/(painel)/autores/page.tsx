import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { TelaDosAutores, type Linha } from "./Tela";

export const metadata = { title: "Autores" };

/**
 * Cadastro de quem assina o conteúdo.
 *
 * Existe porque a documentação do Google sobre conteúdo confiável começa
 * perguntando quem escreveu, e espera que a assinatura leve a uma página com
 * informação sobre a pessoa. Enquanto isto era um campo de texto livre no
 * editor, o JSON-LD saía com um Person sem `url`, que não prova nada.
 */
export default async function AutoresPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: autores }, { data: vinculos }] = await Promise.all([
    supabase
      .from("authors")
      .select("id, slug, name, job_title, credentials, bio, email, same_as, is_active")
      .order("name", { ascending: true }),
    supabase.from("contents").select("author_id").not("author_id", "is", null),
  ]);

  const porAutor = new Map<string, number>();
  for (const v of (vinculos ?? []) as { author_id: string }[]) {
    porAutor.set(v.author_id, (porAutor.get(v.author_id) ?? 0) + 1);
  }

  const linhas: Linha[] = (
    (autores ?? []) as unknown as {
      id: string;
      slug: string;
      name: string;
      job_title: string | null;
      credentials: string | null;
      bio: string | null;
      email: string | null;
      same_as: string[] | null;
      is_active: boolean;
    }[]
  ).map((a) => ({
    id: a.id,
    slug: a.slug,
    name: a.name,
    jobTitle: a.job_title,
    credentials: a.credentials,
    bio: a.bio,
    email: a.email,
    sameAs: a.same_as ?? [],
    is_active: a.is_active,
    conteudos: porAutor.get(a.id) ?? 0,
  }));


  return <TelaDosAutores linhas={linhas} />;
}
