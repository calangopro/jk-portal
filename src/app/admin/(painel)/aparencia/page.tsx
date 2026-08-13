import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/session";
import { lerTema } from "@/lib/tema/ler";
import { Aparencia } from "./Aparencia";

export const metadata: Metadata = { title: "Aparência" };

/**
 * Aparência do site: cor e forma, sem passar por desenvolvedor.
 *
 * Fica com `requireAdmin` porque muda o site inteiro de uma vez. Editor mexe em
 * conteúdo; trocar a cor da marca é decisão de quem responde pela marca.
 */
export default async function PaginaDeAparencia() {
  await requireAdmin();
  const tema = await lerTema();

  return (
    <div>
      <header className="mb-7">
        <h1 className="font-display text-2xl text-ink">Aparência</h1>
        <p className="mt-1.5 max-w-[62ch] text-sm leading-relaxed text-muted">
          Cor e forma do site público. O que você escolher aqui vale para todas as
          páginas na hora em que salvar, sem precisar de publicação nova.
        </p>
      </header>

      <Aparencia inicial={tema} />
    </div>
  );
}
