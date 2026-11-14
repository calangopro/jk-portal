import { ehAdmin } from "@/lib/auth/acessos";
import { requireArea } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { lerBiblioteca } from "@/lib/time/dados";
import { definirEstado, editar, sugerir } from "./actions";
import { TelaDaBiblioteca } from "./Tela";

export const metadata = { title: "Biblioteca JK" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A Biblioteca JK: as respostas da casa para quem atende cliente.
 *
 * Toda pessoa ativa lê e sugere (área `time`, de todos os níveis). Só
 * administrador, dono e GM confirmam, editam o que já foi confirmado e
 * arquivam: por isso a ação de mudar estado só desce para eles. O desenho mora
 * em `Tela.tsx`.
 *
 * `?r=<id>` é o link que uma conversa do chat deixa para a resposta que nasceu dela.
 */
export default async function BibliotecaPage({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  const perfil = await requireArea("time");
  const [respostas, sp] = await Promise.all([lerBiblioteca(await createClient()), searchParams]);
  const admin = ehAdmin(perfil.role);
  return (
    <TelaDaBiblioteca
      respostas={respostas}
      admin={admin}
      meuId={perfil.id}
      destaque={sp.r && UUID.test(sp.r) ? sp.r : undefined}
      sugerir={sugerir}
      editar={editar}
      definirEstado={admin ? definirEstado : undefined}
    />
  );
}
