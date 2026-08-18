import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Eye } from "lucide-react";
import { PaginaDoGuia } from "@/components/conteudo/PaginaDoGuia";
import { getConteudoPorId } from "@/lib/data/contents";
import { idDoToken } from "@/lib/editor/preview";

/**
 * Preview de rascunho.
 *
 * Mostra a página exatamente como ela vai ao ar, antes de publicar. Nunca é
 * indexável: sai com noindex, o robots.txt barra o caminho e a rota é sempre
 * dinâmica, para não guardar rascunho em cache.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Preview de rascunho",
  robots: { index: false, follow: false, nocache: true },
};

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const id = idDoToken(decodeURIComponent((await params).token));
  if (!id) notFound();

  const guia = await getConteudoPorId(id);
  if (!guia) notFound();

  return (
    <>
      <div className="border-b border-brand/30 bg-brand/12">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-3 text-apoio">
          <p className="flex items-center gap-2 font-semibold text-brand-strong">
            <Eye size={15} /> Preview de rascunho. Esta página não está no ar e não é indexada.
          </p>
          <Link
            href={`/admin/conteudos/${guia.id}`}
            className="rounded-full border border-brand/40 px-4 py-1.5 text-nota font-semibold text-brand-strong hover:bg-brand/15"
          >
            Abrir no editor
          </Link>
        </div>
      </div>
      <PaginaDoGuia guia={guia} />
    </>
  );
}
