import { ehAdmin } from "@/lib/auth/acessos";
import { requireArea } from "@/lib/auth/session";
import { lerLigacoes } from "@/lib/redes/painel";
import { absoluteUrl } from "@/lib/seo/site";
import { createAdminClient } from "@/lib/supabase/admin";
import { lerRedesAgora } from "../actions";
import { TelaDeContas } from "./Tela";

export const metadata = { title: "Contas ligadas" };

// "Ler agora" roda aqui: a leitura de todas as contas ligadas, uma vez.
export const maxDuration = 60;

/**
 * O estado de cada rede: o que está ligado, o que venceu e o que falta. A
 * equipe das redes VÊ; ligar e desligar é de administrador, dono e GM, na tela
 * de Integrações, onde ficam todas as chaves do painel.
 *
 * O aplicativo de cada rede mora em `integration_tokens`, sem policy: por isso
 * a leitura usa a chave de serviço, depois de a área ser conferida. Segredo
 * nenhum sai de `lerLigacoes`.
 */
export default async function ContasDasRedesPage() {
  const perfil = await requireArea("redes");
  const ligacoes = await lerLigacoes(createAdminClient());
  return <TelaDeContas ligacoes={ligacoes} agora={Date.now()} podeLigar={ehAdmin(perfil.role)} retornoBase={absoluteUrl("/")} lerAgora={lerRedesAgora} />;
}
