import Link from "next/link";
import { Check, X, Ban, Trash2, MessageCircle, CornerDownRight } from "lucide-react";
import { requireStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { moderar, apagarComentario, aprovarTodos, apagarResposta } from "./actions";
import { CaixaDeResposta } from "./CaixaDeResposta";

export const metadata = { title: "Comentários" };

type Linha = {
  id: string;
  author_name: string;
  author_email: string | null;
  body: string;
  status: "pending" | "approved" | "spam" | "rejected";
  created_at: string;
  ip: string | null;
  contents: { title: string; slug: string } | null;
};

/** Resposta da loja pendurada num comentário. */
type Resposta = {
  id: string;
  body: string;
  created_at: string;
  parent_id: string;
  profiles: { full_name: string | null } | null;
};

const ROTULO: Record<Linha["status"], string> = {
  pending: "Aguardando",
  approved: "Publicado",
  spam: "Spam",
  rejected: "Recusado",
};

const COR: Record<Linha["status"], string> = {
  pending: "bg-[#c9a227]/15 text-[#8a6d1f]",
  approved: "bg-brand/15 text-brand-strong",
  spam: "bg-wine/10 text-wine",
  rejected: "bg-ink/10 text-muted",
};

function quando(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default async function ComentariosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const perfil = await requireStaff();
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

  const abas = [
    { chave: "pending", nome: "Aguardando" },
    { chave: "approved", nome: "Publicados" },
    { chave: "spam", nome: "Spam" },
    { chave: "rejected", nome: "Recusados" },
    { chave: "todos", nome: "Todos" },
  ];

  const botao =
    "flex items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1.5 text-xs font-semibold text-ink transition-colors";

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Comunidade</p>
          <h1 className="font-display mt-2 text-4xl text-ink">Comentários</h1>
          <p className="mt-3 max-w-2xl text-muted">
            Comentário real deixa a página viva e traz dúvida de cliente que vira
            pauta. Nada aparece no site antes de passar por aqui.
          </p>
        </div>
        {(pendentes ?? 0) > 1 ? (
          <form action={aprovarTodos}>
            <button
              type="submit"
              className="rounded-full border border-brand/40 px-5 py-2.5 text-xs font-semibold text-brand-nav hover:bg-brand/10"
            >
              Aprovar os {pendentes} pendentes
            </button>
          </form>
        ) : null}
      </header>

      <nav className="mt-7 flex flex-wrap gap-2">
        {abas.map((a) => (
          <Link
            key={a.chave}
            href={`/admin/comentarios?status=${a.chave}`}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
              filtro === a.chave
                ? "bg-ink text-white"
                : "border border-ink/15 text-ink hover:border-brand/50 hover:text-brand-nav"
            }`}
          >
            {a.nome}
            {a.chave === "pending" && (pendentes ?? 0) > 0 ? ` (${pendentes})` : ""}
          </Link>
        ))}
      </nav>

      {itens.length === 0 ? (
        <div className="glass mt-6 rounded-[20px] px-6 py-16 text-center">
          <MessageCircle className="mx-auto text-brand-nav" size={24} />
          <p className="font-display mt-3 text-2xl text-ink">Nada por aqui</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            {filtro === "pending"
              ? "Nenhum comentário esperando revisão."
              : "Nenhum comentário nesta situação."}
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-4">
          {itens.map((c) => (
            <li key={c.id} className="glass rounded-[18px] p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">
                    {c.author_name}
                    {c.author_email ? (
                      <span className="ml-2 text-xs font-normal text-muted">{c.author_email}</span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {quando(c.created_at)}
                    {c.contents ? (
                      <>
                        {" · em "}
                        <Link href={`/${c.contents.slug}`} target="_blank" className="text-brand-nav hover:underline">
                          {c.contents.title}
                        </Link>
                      </>
                    ) : null}
                    {c.ip ? ` · ${c.ip}` : ""}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${COR[c.status]}`}>
                  {ROTULO[c.status]}
                </span>
              </div>

              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{c.body}</p>

              {(respostasPor.get(c.id) ?? []).map((r) => (
                <div key={r.id} className="mt-4 border-l-2 border-brand/40 pl-4">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-brand-strong">
                    <CornerDownRight size={12} aria-hidden />
                    Resposta publicada
                    <span className="font-normal text-muted">
                      {quando(r.created_at)}
                      {/* Na tela pública quem assina é a marca. Aqui aparece a
                          pessoa: resposta publicada em nome da loja precisa ter
                          dono dentro de casa. */}
                      {r.profiles?.full_name ? ` · por ${r.profiles.full_name}` : ""}
                    </span>
                  </p>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                    {r.body}
                  </p>
                  {perfil.role === "admin" ? (
                    <form action={apagarResposta} className="mt-2">
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="slug" value={c.contents?.slug ?? ""} />
                      <button
                        type="submit"
                        className="text-xs font-semibold text-muted transition-colors hover:text-wine"
                      >
                        Apagar resposta
                      </button>
                    </form>
                  ) : null}
                </div>
              ))}

              {/* Responder é só de admin, e a policy do banco recusa de novo:
                  a tela some para editor, e nem por chamada direta ele passa. */}
              {perfil.role === "admin" && c.status !== "spam" ? (
                <CaixaDeResposta comentarioId={c.id} slug={c.contents?.slug ?? ""} />
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                {c.status !== "approved" ? (
                  <form action={moderar}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="status" value="approved" />
                    <input type="hidden" name="slug" value={c.contents?.slug ?? ""} />
                    <button type="submit" className={`${botao} hover:border-brand hover:text-brand-nav`}>
                      <Check size={12} /> Publicar
                    </button>
                  </form>
                ) : (
                  <form action={moderar}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="status" value="pending" />
                    <input type="hidden" name="slug" value={c.contents?.slug ?? ""} />
                    <button type="submit" className={`${botao} hover:border-brand/50`}>
                      Tirar do ar
                    </button>
                  </form>
                )}

                {c.status !== "rejected" ? (
                  <form action={moderar}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="status" value="rejected" />
                    <input type="hidden" name="slug" value={c.contents?.slug ?? ""} />
                    <button type="submit" className={`${botao} hover:border-wine/50 hover:text-wine`}>
                      <X size={12} /> Recusar
                    </button>
                  </form>
                ) : null}

                {c.status !== "spam" ? (
                  <form action={moderar}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="status" value="spam" />
                    <input type="hidden" name="slug" value={c.contents?.slug ?? ""} />
                    <button type="submit" className={`${botao} hover:border-wine/50 hover:text-wine`}>
                      <Ban size={12} /> Spam
                    </button>
                  </form>
                ) : perfil.role === "admin" ? (
                  <form action={apagarComentario}>
                    <input type="hidden" name="id" value={c.id} />
                    <button type="submit" className="flex items-center gap-1.5 rounded-full border border-wine/30 px-3 py-1.5 text-xs font-semibold text-wine transition-colors hover:bg-wine hover:text-white">
                      <Trash2 size={12} /> Apagar
                    </button>
                  </form>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
