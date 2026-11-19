import { requireArea } from "@/lib/auth/session";
import { listarConteudos, paginasOrfas } from "@/lib/data/admin-contents";
import { ehAdmin } from "@/lib/auth/acessos";
import { TelaDosConteudos } from "./Tela";

export const metadata = { title: "Conteúdos" };

export default async function ConteudosPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const perfil = await requireArea("conteudo");
  const { erro } = await searchParams;
  const [itens, orfas] = await Promise.all([listarConteudos(), paginasOrfas()]);

  return <TelaDosConteudos itens={itens} orfas={orfas} erro={erro} souAdmin={ehAdmin(perfil.role)} />;
}
