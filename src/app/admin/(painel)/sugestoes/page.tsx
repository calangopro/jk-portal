import { ehAdmin } from "@/lib/auth/acessos";
import { requireArea } from "@/lib/auth/session";
import { lerRoadmapDaTela } from "@/lib/sugestoes/dados";
import { createClient } from "@/lib/supabase/server";
import { mudarSugestao } from "./actions";
import { TelaDeSugestoes } from "./Tela";

export const metadata = { title: "Sugestões de melhoria" };

/**
 * O roadmap de melhorias do painel, escrito pelo time pelo botão "Sugerir
 * melhoria" que fica no topo de toda tela.
 *
 * Toda pessoa ativa entra (área `time`) e vê as próprias sugestões; a
 * diretoria vê todas e muda o estado. Quem decide o que cada um recebe é o
 * banco (`sugestoes_lista`, 0140). O desenho mora em `Tela.tsx`.
 */
export default async function SugestoesPage() {
  const perfil = await requireArea("time");
  const roadmap = await lerRoadmapDaTela(await createClient());
  return <TelaDeSugestoes roadmap={roadmap} mudar={ehAdmin(perfil.role) ? mudarSugestao : undefined} />;
}
