import { requireArea } from "@/lib/auth/session";
import { contarPosts, listarPosts, type FiltroDePosts } from "@/lib/redes/posts";
import { createAdminClient } from "@/lib/supabase/admin";
import { apagar, cancelar, liberar } from "./actions";
import { TelaDePublicar } from "./Tela";

export const metadata = { title: "Publicar e agendar" };

// "Publicar agora" e "Tentar de novo" rodam a fila do post logo depois da resposta.
export const maxDuration = 60;

const ABAS: FiltroDePosts[] = ["fila", "rascunhos", "publicados", "erros"];

/**
 * A fila das redes: o que está marcado para sair, os rascunhos, o que já saiu
 * e o que deu erro. Só lê o banco. O desenho mora em `Tela.tsx`.
 *
 * A leitura usa a chave de serviço, depois de a área ser conferida, para
 * trazer o nome de quem montou e de quem liberou cada post (`profiles` não é
 * de leitura de todo nível).
 */
export default async function PublicarPage({ searchParams }: { searchParams: Promise<{ aba?: string; saiu?: string }> }) {
  await requireArea("redes");
  const { aba: pedida, saiu } = await searchParams;
  const aba = ABAS.includes(pedida as FiltroDePosts) ? (pedida as FiltroDePosts) : "fila";
  const admin = createAdminClient();
  const [posts, contagem] = await Promise.all([listarPosts(admin, aba), contarPosts(admin)]);
  return <TelaDePublicar aba={aba} posts={posts} contagem={contagem} agora={Date.now()} saiu={saiu === "agora" || saiu === "agendado" ? saiu : null} acoes={{ liberar, cancelar, apagar }} />;
}
