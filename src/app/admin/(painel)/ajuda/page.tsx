import { requireArea } from "@/lib/auth/session";
import { TelaDaAjuda } from "./Tela";

export const metadata = { title: "Como usar" };

/**
 * Todos os tutoriais do painel, só das telas que a pessoa pode abrir. Fica no
 * setor Time, que todo nível tem. O desenho e a busca moram em `Tela.tsx`; os
 * tutoriais são dado puro em `lib/ajuda/` e baixam junto com a janela.
 */
export default async function AjudaPage() {
  const perfil = await requireArea("time");
  return <TelaDaAjuda papel={perfil.role} areas={perfil.areas} />;
}
