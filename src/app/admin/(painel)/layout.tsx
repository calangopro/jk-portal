import { requireSessao, ROLE_LABEL } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/admin/login/actions";
import { avisosDoMenu } from "@/lib/time/chat";
import { lerResumoDoChat } from "@/lib/time/dados";
import { Moldura } from "./Moldura";

/**
 * Chrome da área protegida. Fica num route group para NÃO envolver a página de
 * login, que precisa ser acessível sem sessão. O desenho mora em `Moldura.tsx`.
 */
export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  // As leituras saem juntas: uma não precisa esperar a outra. Sem sessão,
  // `requireSessao` manda ao login e as contagens voltam vazias, sem expor nada.
  const supabase = await createClient();
  const [profile, { count }, chat] = await Promise.all([
    requireSessao(),
    // Aviso na navegação quando há comentário esperando revisão.
    supabase.from("comments").select("*", { count: "exact", head: true }).eq("status", "pending"),
    // E quando há mensagem do chat que a pessoa não leu, ou pedido esperando o setor dela.
    lerResumoDoChat(supabase),
  ]);

  return (
    <Moldura
      nome={profile.fullName ?? profile.email ?? "Equipe"}
      papel={ROLE_LABEL[profile.role]}
      areas={profile.areas}
      pendentes={count ?? 0}
      avisos={avisosDoMenu(chat)}
      meuId={profile.areas.includes("time") ? profile.id : null}
      sair={signOut}
    >
      {children}
    </Moldura>
  );
}
