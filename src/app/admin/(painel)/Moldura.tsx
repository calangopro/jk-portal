"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, ExternalLink } from "lucide-react";
import type { Area } from "@/lib/auth/acessos";
import { comBasePath } from "@/lib/seo/base-path";
import { nomeDoSetor, ondeEstou, setoresDe } from "@/lib/painel/setores";
import { BotaoSair } from "./BotaoSair";
import { AbasDoSetor, BarraDeBaixo, FolhaMais, Lateral, corDoSetor } from "./Navegacao";

/**
 * A moldura da área protegida: o escritório da JK, por setor.
 *
 * No computador, os setores ficam na barra lateral e o setor aberto mostra as
 * telas dele. No celular o painel se comporta como aplicativo: barra de topo
 * com o setor, abas com as telas do setor e barra de baixo com os setores. A
 * lista de setores é uma só (`lib/painel/setores.ts`).
 *
 * É componente de cliente porque precisa saber em que endereço a pessoa está
 * (para pintar o setor) e guardar se a folha "Mais" está aberta, que dois
 * botões diferentes abrem. A página em si continua vindo do servidor, por
 * `children`. Fica fora do `layout.tsx` para poder ser vista sem sessão
 * durante o desenvolvimento.
 */
export function Moldura({
  nome, papel, areas, pendentes, sair, children, caminhoDaPrevia,
}: {
  nome: string;
  papel: string;
  areas: Area[];
  pendentes: number;
  sair: () => Promise<void>;
  children: React.ReactNode;
  /** Só para a prévia de desenvolvimento: desenha como se a pessoa estivesse neste endereço. */
  caminhoDaPrevia?: string;
}) {
  const daBarra = usePathname();
  const caminho = caminhoDaPrevia ?? daBarra;
  const setores = useMemo(() => setoresDe(areas), [areas]);
  const { setor, item } = ondeEstou(setores, caminho);
  const [mais, setMais] = useState(false);
  const fecharMais = useCallback(() => setMais(false), []);
  useEffect(() => setMais(false), [caminho]);

  // A altura da barra de topo muda (no celular ela ganha a fila de abas), e as
  // telas que grudam uma barra própria logo abaixo dela precisam saber quanto:
  // leem `--painel-topo`. Medido, e não escrito à mão, para não desencontrar.
  const raiz = useRef<HTMLDivElement>(null);
  const topo = useRef<HTMLElement>(null);
  useEffect(() => {
    const barra = topo.current;
    const alvo = raiz.current;
    if (!barra || !alvo || typeof ResizeObserver === "undefined") return;
    const medir = () => alvo.style.setProperty("--painel-topo", `${barra.offsetHeight}px`);
    medir();
    const vigia = new ResizeObserver(medir);
    vigia.observe(barra);
    return () => vigia.disconnect();
  }, []);

  const iniciais = nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

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
    <div ref={raiz} className="painel-app min-h-dvh lg:grid lg:grid-cols-[17.5rem_1fr]" style={corDoSetor(setor)}>
      <aside className="hidden border-r border-ink/[0.07] bg-[rgb(var(--jk-bg-rgb))] lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
        <div className="px-5 pb-4 pt-5">{marca}</div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
          <Lateral setores={setores} atual={setor} item={item} pendentes={pendentes} />
        </div>
        <div className="flex items-center gap-3 border-t border-ink/[0.07] px-4 py-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink text-xs font-bold text-brand-light" aria-hidden="true">
            {iniciais}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium leading-tight text-ink">{nome}</p>
            <p className="truncate text-xs leading-tight text-muted">{papel}</p>
          </div>
          <form action={sair}>
            <BotaoSair />
          </form>
        </div>
      </aside>

      <div className="min-w-0">
        <header ref={topo} className="painel-topo sticky top-0 z-40">
          {/* Celular: o setor à esquerda, a conta à direita. */}
          <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-2.5 lg:hidden">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="painel-selo painel-selo-ativo grid h-9 w-9 shrink-0 place-items-center rounded-[11px]">
                {setor ? <setor.Icone size={17} aria-hidden="true" /> : null}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[1.02rem] font-bold leading-tight text-ink">{setor ? nomeDoSetor(setor) : "Painel JK"}</p>
                <p className="truncate text-[0.7rem] leading-tight text-muted">{item?.label ?? "JK Alianças"}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMais(true)}
              aria-label={`Conta de ${nome} e todos os setores`}
              aria-expanded={mais}
              aria-controls="folha-mais"
              className="painel-toque grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-xs font-bold text-brand-light"
            >
              {iniciais}
            </button>
          </div>
          {setor ? <AbasDoSetor setor={setor} item={item} pendentes={pendentes} /> : null}

          {/* Computador: onde a pessoa está, e a saída para o site. */}
          <div className="hidden items-center justify-between gap-4 px-8 py-3 lg:flex">
            <p className="flex min-w-0 items-center gap-2 text-sm">
              <span className="painel-ponto h-2.5 w-2.5 shrink-0 rounded-full" aria-hidden="true" />
              <span className="painel-cor font-semibold">{setor ? nomeDoSetor(setor) : "Painel"}</span>
              {item && setor && setor.itens.length > 1 ? (
                <>
                  <ChevronRight size={14} className="shrink-0 text-ink/30" aria-hidden="true" />
                  <span className="truncate text-ink/80">{item.label}</span>
                </>
              ) : null}
            </p>
            <a
              href={comBasePath("/")}
              target="_blank"
              rel="noopener"
              className="flex shrink-0 items-center gap-1.5 text-sm text-muted transition-colors hover:text-brand-nav"
            >
              Ver o site <ExternalLink size={13} aria-hidden="true" />
            </a>
          </div>
        </header>

        <main className="painel-conteudo mx-auto w-full max-w-5xl px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-5 sm:px-8 lg:pb-12 lg:pt-8">
          {children}
        </main>
      </div>

      <BarraDeBaixo
        setores={setores}
        atual={setor}
        item={item}
        pendentes={pendentes}
        maisAberto={mais}
        onMais={() => setMais((v) => !v)}
      />
      <FolhaMais
        aberta={mais}
        onFechar={fecharMais}
        setores={setores}
        atual={setor}
        item={item}
        pendentes={pendentes}
        nome={nome}
        papel={papel}
        sair={sair}
      />
    </div>
  );
}
