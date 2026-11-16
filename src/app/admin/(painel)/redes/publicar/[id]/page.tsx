import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireArea } from "@/lib/auth/session";
import { lerPost } from "@/lib/redes/posts";
import { createAdminClient } from "@/lib/supabase/admin";
import { apagar, cancelar, confirmarSubida, liberar, prepararSubida, salvarELiberar, salvarRascunho } from "../actions";
import { CartaoDoPost } from "../CartaoDoPost";
import { Compositor } from "../Compositor";
import { lerParaCompor } from "../dados";

export const metadata = { title: "Post das redes" };

export const maxDuration = 60;

/** Estados em que o post ainda pode ser mexido. Publicado e saindo abrem só para ver. */
const EDITAVEL = ["rascunho", "agendado", "erro", "cancelado", "parcial"];

/**
 * Um post: abre no compositor enquanto ainda dá para mexer, e só para ver
 * depois que saiu. Editar um post agendado tira ele da fila (o núcleo faz
 * isso), e a tela avisa antes.
 */
export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  await requireArea("redes");
  const { id } = await params;
  const admin = createAdminClient();
  const post = await lerPost(admin, id);
  if (!post) notFound();
  const editavel = EDITAVEL.includes(post.status);
  const { contas, limite } = editavel ? await lerParaCompor(admin) : { contas: [], limite: 0 };

  return (
    <div data-painel-largo>
      <Link href="/admin/redes/publicar" className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--setor)]">
        <ArrowLeft size={13} aria-hidden="true" /> Posts e stories
      </Link>
      <h1 className="font-display mt-2 text-3xl text-ink sm:text-4xl">{editavel ? "Editar post" : "Post publicado"}</h1>
      {post.status === "agendado" ? (
        <p role="status" className="mt-3 max-w-2xl rounded-[12px] px-3.5 py-2.5 text-sm leading-relaxed" style={{ color: "#9a4a07", background: "#fcefd9" }}>
          Este post está agendado. Se você salvar uma mudança, ele sai da fila e precisa ser agendado de novo: o que foi aprovado para sair era a versão anterior.
        </p>
      ) : null}
      <div className="mt-5">
        {editavel ? (
          <>
            {post.envios.some((e) => e.status === "publicado" || e.status === "erro") ? (
              <div className="mb-4">
                <CartaoDoPost post={post} agora={Date.now()} acoes={{ liberar, cancelar, apagar }} semLink />
              </div>
            ) : null}
            <Compositor post={post} contas={contas} limite={limite} acoes={{ prepararSubida, confirmarSubida, salvarRascunho, salvarELiberar }} />
          </>
        ) : (
          <CartaoDoPost post={post} agora={Date.now()} acoes={{ liberar, cancelar, apagar }} semLink />
        )}
      </div>
    </div>
  );
}
