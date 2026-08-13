import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth/session";
import { lerLayout } from "@/lib/blocos/ler";
import { EditorDaHome } from "./EditorDaHome";

export const metadata: Metadata = { title: "Home" };

/**
 * Edição da home.
 *
 * Fica em `requireStaff`, e não `requireAdmin`: reordenar seção e reescrever
 * headline é trabalho de editor. O que é irreversível ou vale para o site
 * inteiro (a paleta, em Aparência) continua restrito a admin.
 */
export default async function PaginaDaHome() {
  await requireStaff();
  const layout = await lerLayout("home");

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-2xl text-ink">Home</h1>
        <p className="mt-1.5 max-w-[62ch] text-sm leading-relaxed text-muted">
          Cada cartão abaixo é uma faixa da página inicial, na ordem em que aparece.
          Arraste pela alça para reordenar, use o olho para ocultar sem apagar, e
          salve. A home vai ao ar com a mudança na hora.
        </p>
      </header>

      <EditorDaHome inicial={layout} />
    </div>
  );
}
