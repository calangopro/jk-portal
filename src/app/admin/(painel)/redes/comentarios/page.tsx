import { requireArea } from "@/lib/auth/session";
import { contarComentarios, listarComentarios, type FiltroDeComentarios } from "@/lib/redes/comentarios";
import { ehRede } from "@/lib/redes/redes";
import { createAdminClient } from "@/lib/supabase/admin";
import { marcar, ocultar, responder } from "./actions";
import { TelaDeComentarios } from "./Tela";

export const metadata = { title: "Comentários das redes" };

// Responder fala com a rede na hora, e ela pode demorar.
export const maxDuration = 30;

const ABAS: FiltroDeComentarios[] = ["novos", "respondidos", "vistos"];

/**
 * Os comentários das redes num lugar só, com o que espera resposta na frente.
 * A página só lê o banco: quem busca os comentários é a rotina de leitura. O
 * desenho mora em `Tela.tsx`.
 *
 * A leitura usa a chave de serviço, depois de a área ser conferida, para
 * trazer o nome de quem respondeu.
 */
export default async function ComentariosDasRedesPage({ searchParams }: { searchParams: Promise<{ aba?: string; rede?: string }> }) {
  await requireArea("redes");
  const { aba: pedida, rede: redePedida } = await searchParams;
  const aba = ABAS.includes(pedida as FiltroDeComentarios) ? (pedida as FiltroDeComentarios) : "novos";
  const rede = ehRede(redePedida) ? redePedida : undefined;
  const admin = createAdminClient();
  const [comentarios, contagem] = await Promise.all([listarComentarios(admin, aba, { rede }), contarComentarios(admin)]);
  return <TelaDeComentarios aba={aba} rede={rede ?? null} comentarios={comentarios} contagem={contagem} agora={Date.now()} acoes={{ responder, marcar, ocultar }} />;
}
