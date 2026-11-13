import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type { Area } from "@/lib/auth/acessos";
import { comBasePath } from "@/lib/seo/base-path";
import { BotaoSair } from "./BotaoSair";
import { MenuDoCelular } from "./MenuDoCelular";
import { Navegacao } from "./Navegacao";

/**
 * A moldura da área protegida: barra lateral no computador, barra de topo com
 * gaveta no celular. Fica fora do `layout.tsx` para poder ser vista sem sessão
 * durante o desenvolvimento.
 *
 * No celular a barra lateral NÃO é desenhada: o menu abre pelo botão. A barra
 * de topo fica com o essencial (menu, marca e sair), e o nome de quem está
 * logado vai para dentro da gaveta, porque em 375 px ele empurrava o botão de
 * sair para fora.
 */
export function Moldura({
  nome, papel, areas, pendentes, sair, children,
}: {
  nome: string;
  papel: string;
  areas: Area[];
  pendentes: number;
  sair: () => Promise<void>;
  children: React.ReactNode;
}) {
  const marca = (
    <Link href="/admin" className="flex items-center gap-2.5">
      {/* `img` cru não recebe o basePath (só `next/image` recebe), então o
          caminho do arquivo em public/ é montado na mão. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={comBasePath("/logo.svg")} alt="JK Alianças" width={104} height={35} className="h-6 w-auto" />
      <span className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-brand-nav">Painel</span>
    </Link>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="hidden border-r border-border/60 bg-white/40 backdrop-blur-sm lg:sticky lg:top-0 lg:block lg:h-screen lg:overflow-y-auto">
        <div className="px-5 py-5">{marca}</div>
        <div className="px-3 pb-6">
          <Navegacao pendentes={pendentes} areas={areas} />
        </div>
      </aside>

      <div className="min-w-0">
        <header className="glass-nav sticky top-0 z-40">
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-8 sm:py-3">
            <div className="flex min-w-0 items-center gap-3">
              <MenuDoCelular pendentes={pendentes} areas={areas} nome={nome} papel={papel} />
              <span className="lg:hidden">{marca}</span>
              <Link
                href="/"
                target="_blank"
                className="hidden items-center gap-1.5 text-sm text-muted transition-colors hover:text-brand-nav lg:flex"
              >
                Ver site <ExternalLink size={13} />
              </Link>
            </div>

            <div className="flex shrink-0 items-center gap-4">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium leading-tight text-ink">{nome}</p>
                <p className="text-xs leading-tight text-muted">{papel}</p>
              </div>
              <form action={sair}>
                <BotaoSair />
              </form>
            </div>
          </div>
        </header>

        <main className="painel-conteudo mx-auto w-full max-w-5xl px-4 py-6 sm:px-8 sm:py-10">{children}</main>
      </div>
    </div>
  );
}
