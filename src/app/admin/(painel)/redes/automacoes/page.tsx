import { ehAdmin } from "@/lib/auth/acessos";
import { requireArea } from "@/lib/auth/session";
import { listarAutomacoes } from "@/lib/redes/automacoes";
import { listarContas } from "@/lib/redes/contas";
import { modulo } from "@/lib/redes/plataformas";
import { createAdminClient } from "@/lib/supabase/admin";
import { apagar, desligar, ligar, salvar } from "./actions";
import { TelaDeAutomacoes } from "./Tela";

export const metadata = { title: "Automações das redes" };

/**
 * As automações das redes: resposta pronta a comentário, por palavra. A tela
 * abre para quem tem a área; LIGAR uma regra é de administrador, dono e GM, e
 * a conferência é feita na ação e no núcleo, não só aqui. O desenho mora em
 * `Tela.tsx`.
 */
export default async function AutomacoesPage() {
  const perfil = await requireArea("redes");
  const admin = createAdminClient();
  const [regras, contas] = await Promise.all([listarAutomacoes(admin), listarContas(admin)]);
  // Só entra conta de rede que sabe responder comentário.
  const respondem = contas.filter((c) => Boolean(modulo(c.rede)?.responderComentario)).map((c) => ({ id: c.id, rede: c.rede, nome: c.usuario || c.nome || "", ativa: c.status === "ativa" }));
  // As publicações recentes de cada conta, para a regra que vale num post só.
  const { data: pubs } = respondem.length
    ? await admin.from("redes_publicacoes").select("id, conta_id, legenda, publicado_em").in("conta_id", respondem.map((c) => c.id)).neq("formato", "story").order("publicado_em", { ascending: false }).limit(60)
    : { data: [] };
  const publicacoes = ((pubs ?? []) as { id: string; conta_id: string; legenda: string | null; publicado_em: string | null }[]).map((p) => ({ id: p.id, contaId: p.conta_id, legenda: (p.legenda ?? "").slice(0, 70) || "Publicação sem legenda", quando: p.publicado_em }));
  return <TelaDeAutomacoes regras={regras} contas={respondem} publicacoes={publicacoes} podeLigar={ehAdmin(perfil.role)} acoes={{ salvar, ligar, desligar, apagar }} />;
}
