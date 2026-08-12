import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { requireStaff, ROLE_LABEL } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/admin/login/actions";
import { Navegacao } from "./Navegacao";

/**
 * Chrome da área protegida: barra lateral agrupada por finalidade e uma faixa
 * de topo enxuta. Fica num route group para NÃO envolver a página de login,
 * que precisa ser acessível sem sessão.
 */
export default async function PainelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireStaff();

  // Aviso na navegação quando há comentário esperando revisão.
  const supabase = await createClient();
  const { count } = await supabase
    .from("comments")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16rem_1fr]">
      {/* Barra lateral */}
      <aside className="border-b border-border/60 bg-white/40 backdrop-blur-sm lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <div className="px-5 py-5">
          <Link href="/admin" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="JK Alianças" width={104} height={35} className="h-6 w-auto" />
            <span className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-brand-nav">
              Painel
            </span>
          </Link>
        </div>

        <div className="px-3 pb-6">
          <Navegacao pendentes={count ?? 0} />
        </div>
      </aside>

      {/* Conteúdo */}
      <div className="min-w-0">
        <header className="glass-nav sticky top-0 z-40">
          <div className="flex items-center justify-between gap-4 px-5 py-3 sm:px-8">
            <Link
              href="/"
              target="_blank"
              className="flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-brand-nav"
            >
              Ver site <ExternalLink size={13} />
            </Link>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium leading-tight text-ink">
                  {profile.fullName ?? profile.email}
                </p>
                <p className="text-xs leading-tight text-muted">{ROLE_LABEL[profile.role]}</p>
              </div>
              <form action={signOut}>
                <button
                  type="submit"
                  className="rounded-full border border-ink/15 bg-white/50 px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-brand/50 hover:text-brand-nav"
                >
                  Sair
                </button>
              </form>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
