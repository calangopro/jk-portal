import Link from "next/link";
import { requireStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Painel" };

export default async function AdminDashboard() {
  const profile = await requireStaff();
  const supabase = await createClient();

  const [contents, published, media, products, pendingComments] =
    await Promise.all([
      supabase.from("contents").select("*", { count: "exact", head: true }),
      supabase
        .from("contents")
        .select("*", { count: "exact", head: true })
        .eq("status", "published"),
      supabase.from("media").select("*", { count: "exact", head: true }),
      supabase.from("products").select("*", { count: "exact", head: true }),
      supabase
        .from("comments")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending"),
    ]);

  const cards = [
    { label: "Conteúdos", value: contents.count ?? 0, hint: `${published.count ?? 0} publicados` },
    { label: "Imagens", value: media.count ?? 0, hint: "biblioteca de mídia" },
    { label: "Produtos", value: products.count ?? 0, hint: "sincronizados da Tray" },
    { label: "Comentários", value: pendingComments.count ?? 0, hint: "aguardando moderação" },
  ];

  return (
    <>
      <header>
        <p className="eyebrow">Visão geral</p>
        <h1 className="font-display mt-2 text-4xl text-ink">
          Olá, {(profile.fullName ?? "equipe").split(" ")[0]}
        </h1>
        <p className="mt-3 text-muted">
          Este é o painel editorial da JK Alianças.
        </p>
      </header>

      <section className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="glass rounded-[20px] p-6">
            <p className="eyebrow text-[0.68rem]">{c.label}</p>
            <p className="font-display mt-3 text-4xl text-ink">{c.value}</p>
            <p className="mt-1 text-xs text-muted">{c.hint}</p>
          </div>
        ))}
      </section>

      <section className="glass mt-8 rounded-[20px] p-7">
        <h2 className="font-display text-2xl text-ink">Por onde começar</h2>
        <ul className="mt-4 space-y-2.5 text-sm text-muted">
          <li>
            •{" "}
            <Link href="/admin/conteudos" className="font-medium text-brand-nav hover:underline">
              Escrever um guia
            </Link>{" "}
            do cluster de alianças de namoro, que é a primeira batalha do projeto.
          </li>
          <li>
            •{" "}
            <Link href="/admin/metricas" className="font-medium text-brand-nav hover:underline">
              Ver as métricas
            </Link>{" "}
            para escolher a consulta que está perto da primeira página.
          </li>
          <li>
            •{" "}
            <Link href="/admin/usuarios" className="font-medium text-brand-nav hover:underline">
              Convidar editores
            </Link>{" "}
            e definir os papéis da equipe.
          </li>
        </ul>
      </section>

    </>
  );
}
