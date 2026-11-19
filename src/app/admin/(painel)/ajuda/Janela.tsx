"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CircleHelp, X } from "lucide-react";
import { Player } from "@/components/ajuda/Player";
import { grupoDoPapel, gruposComVersao, passosPara } from "@/lib/ajuda/grupos";
import { tutorialDaTela } from "@/lib/ajuda/indice";
import { NOME_DO_GRUPO, type GrupoDeNivel, type Tutorial } from "@/lib/ajuda/tipos";
import type { Area } from "@/lib/auth/acessos";
import { setoresDe, ondeEstou } from "@/lib/painel/setores";

/**
 * A janela do Como usar: o tutorial da tela aberta, na versão do nível de quem
 * está logado. É um `<dialog>` nativo aberto com `showModal()`, como o de
 * sugerir melhoria: fica na camada de cima do navegador, então passa por cima
 * do chat flutuante e de qualquer pilha da moldura, e o foco fica preso nela.
 *
 * Mostra um tutorial (`href`, na lista de todos) ou o da tela de `caminho`.
 */
export default function JanelaComoUsar({
  caminho, papel, areas, href, aoFechar,
}: {
  caminho?: string;
  papel: string;
  areas: readonly string[];
  /** Abrir o tutorial de uma tela específica, e não o da tela em que a pessoa está. */
  href?: string;
  aoFechar: () => void;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialogo.current;
    if (d && !d.open) d.showModal();
  }, []);

  const { itemHref, telaNome } = useMemo(() => {
    const setores = setoresDe(areas as Area[]);
    if (href) {
      const item = setores.flatMap((s) => s.itens).find((i) => i.href === href);
      return { itemHref: href, telaNome: item?.label ?? "Painel" };
    }
    const { item } = ondeEstou(setores, caminho ?? "/admin");
    return { itemHref: item?.href ?? null, telaNome: item?.label ?? "Painel" };
  }, [areas, caminho, href]);

  const tutorial: Tutorial | null = itemHref ? tutorialDaTela(itemHref) : null;
  const meuGrupo = grupoDoPapel(papel);
  // A diretoria pode ver como cada nível vê: é como ela confere o que o time recebe.
  const [grupo, setGrupo] = useState<GrupoDeNivel | "todos">(meuGrupo);
  const outros = tutorial && meuGrupo === "diretoria" ? gruposComVersao(tutorial) : [];

  return (
    <dialog
      ref={dialogo}
      aria-labelledby="como-usar-titulo"
      onClose={aoFechar}
      className="m-auto w-[calc(100%-1.5rem)] max-w-2xl rounded-[20px] border-0 bg-white p-0 text-ink shadow-2xl backdrop:bg-[rgb(23_21_18/0.45)]"
    >
      <div className="max-h-[calc(100dvh-1.5rem)] overflow-y-auto p-4 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-[#e5eefb] text-[#1c4e8c]" aria-hidden="true">
            <CircleHelp size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="como-usar-titulo" className="font-display text-xl leading-tight text-ink">Como usar: {telaNome}</h2>
            <p className="mt-0.5 text-xs text-muted [overflow-wrap:anywhere]">
              {tutorial ? tutorial.resumo : "Ainda não tem tutorial para esta tela."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => dialogo.current?.close()}
            aria-label="Fechar"
            className="painel-toque -mr-1 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted hover:bg-ink/[0.05] hover:text-ink"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {outros.length > 0 ? (
          <label className="mt-3 flex items-center gap-2 text-xs text-muted">
            Ver como
            <select value={grupo} onChange={(e) => setGrupo(e.target.value as GrupoDeNivel | "todos")} className="rounded-full border border-ink/15 bg-white px-2.5 py-1 text-xs font-semibold text-ink">
              <option value="diretoria">{NOME_DO_GRUPO.diretoria}</option>
              {outros.filter((g) => g !== "diretoria").map((g) => (
                <option key={g} value={g}>{NOME_DO_GRUPO[g]}</option>
              ))}
              <option value="todos">Quem não tem versão própria</option>
            </select>
          </label>
        ) : null}

        <div className="mt-4">
          {tutorial ? (
            <Player key={`${itemHref}-${grupo}`} passos={grupo === "todos" ? tutorial.versoes.todos : passosPara(tutorial, grupo)} tela={telaNome} />
          ) : (
            <p className="rounded-[14px] bg-ink/[0.04] p-4 text-sm leading-relaxed text-ink/80">
              Esta tela ainda não tem um passo a passo. Enquanto isso, a lista tem os que já estão prontos. Se faltou alguma coisa, use o botão Sugerir melhoria.
            </p>
          )}
        </div>

        <div className="mt-4 border-t border-ink/10 pt-3 text-sm">
          <Link href="/admin/ajuda" onClick={() => dialogo.current?.close()} className="font-semibold text-brand-nav hover:underline">
            Ver todos os tutoriais
          </Link>
        </div>
      </div>
    </dialog>
  );
}
