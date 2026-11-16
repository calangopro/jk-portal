import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireArea } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { confirmarSubida, prepararSubida, salvarELiberar, salvarRascunho } from "../actions";
import { ligarAoPost } from "../../ideias/actions";
import { lerIdeia } from "@/lib/redes/ideias";
import { Compositor } from "../Compositor";
import { lerParaCompor } from "../dados";

export const metadata = { title: "Novo post" };

// "Publicar agora" roda a fila deste post logo depois da resposta.
export const maxDuration = 60;

/** O compositor em branco. O desenho e a lógica moram em `Compositor.tsx`, que só carrega nesta rota e na de editar. */
export default async function NovoPostPage({ searchParams }: { searchParams: Promise<{ formato?: string; quando?: string; ideia?: string }> }) {
  await requireArea("redes");
  const { formato: pedido, quando, ideia: ideiaPedida } = await searchParams;
  // Vinda do calendário: "AAAA-MM-DDTHH:mm", no horário de Brasília, e só se ainda não passou.
  const quandoInicial = quando && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(quando) && Date.parse(`${quando}:00-03:00`) > Date.now() + 60_000 ? quando : undefined;
  const formatoInicial = pedido === "story" || pedido === "video_curto" || pedido === "post" || pedido === "video" || pedido === "texto" ? pedido : undefined;
  const admin = createAdminClient();
  const [{ contas, limite, horarios }, ideia] = await Promise.all([lerParaCompor(admin), ideiaPedida ? lerIdeia(admin, ideiaPedida) : Promise.resolve(null)]);
  return (
    <div data-painel-largo>
      <Link href={quandoInicial ? "/admin/redes/calendario" : "/admin/redes/publicar"} className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--setor)]">
        <ArrowLeft size={13} aria-hidden="true" /> {quandoInicial ? "Calendário" : "Posts e stories"}
      </Link>
      <h1 className="font-display mt-2 text-3xl text-ink sm:text-4xl">{formatoInicial === "story" ? "Novo story" : "Novo post"}</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">Monte uma vez e mande para as redes que quiser. Nada sai sem a confirmação do fim da página.</p>
      <div className="mt-5">
        <Compositor
          post={null}
          formatoInicial={formatoInicial}
          quandoInicial={quandoInicial}
          horarios={horarios}
          ideia={ideia && !ideia.postId ? { id: ideia.id, titulo: ideia.titulo, notas: ideia.notas } : null}
          contas={contas}
          limite={limite}
          acoes={{ prepararSubida, confirmarSubida, salvarRascunho, salvarELiberar, ligarIdeia: ligarAoPost }}
        />
      </div>
    </div>
  );
}
