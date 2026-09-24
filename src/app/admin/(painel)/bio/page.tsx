import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth/session";
import { lerBio } from "@/lib/bio/ler";
import { getPublishedLocations } from "@/lib/data/locations";
import { categoriasDaLoja } from "@/lib/tray/publico";
import { hojeEmSaoPaulo } from "@/lib/tray/preco";
import { EditorDaBio } from "./EditorDaBio";

export const metadata: Metadata = { title: "Link da bio" };

/**
 * Edição do link da bio.
 *
 * `requireStaff`, como a home: montar a vitrine da semana e trocar o texto da
 * oferta é trabalho de quem cuida das redes, não só de administrador.
 */
export default async function PaginaDoEditorDaBio() {
  await requireStaff();
  const [bio, lojas, categorias] = await Promise.all([lerBio(), getPublishedLocations(), categoriasDaLoja()]);

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-2xl text-ink">Link da bio</h1>
        <p className="mt-1.5 max-w-[70ch] text-sm leading-relaxed text-muted">
          A página de jkaliancas.com.br/bio. Cada cartão é uma faixa da página, na ordem em que aparece: arraste pela alça
          para reordenar e abra para editar. A prévia ao lado muda enquanto você edita, e nada vai ao ar antes de
          Publicar. Preço e foto vêm da loja, sempre atualizados.
        </p>
      </header>

      <EditorDaBio
        inicial={bio}
        lojas={lojas}
        categorias={categorias.filter((c) => c.ativa)}
        hoje={hojeEmSaoPaulo()}
      />
    </div>
  );
}
