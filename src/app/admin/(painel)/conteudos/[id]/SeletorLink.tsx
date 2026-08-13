"use client";

import { useEffect, useState, useTransition } from "react";
import { Search, Link2, X, Globe } from "lucide-react";
import { buscarAlvosDeLink, registrarLink, type AlvoDeLink } from "./actions";

/**
 * Escolhe o destino de um link.
 *
 * Antes era um prompt pedindo para digitar "/guia/algo", o que obrigava a
 * decorar slug e errava calado quando a página não existia. Aqui o destino é
 * escolhido de uma lista real e o link entra também no grafo, que é o que
 * alimenta os relacionados e o relatório de página órfã.
 */
export function SeletorLink({
  contentId,
  textoSelecionado,
  aoEscolher,
  aoFechar,
}: {
  contentId: string;
  textoSelecionado: string;
  aoEscolher: (href: string, rel?: string) => void;
  aoFechar: () => void;
}) {
  const [termo, setTermo] = useState("");
  const [itens, setItens] = useState<AlvoDeLink[]>([]);
  const [externo, setExterno] = useState("");
  const [carregando, iniciar] = useTransition();

  useEffect(() => {
    const t = setTimeout(() => {
      iniciar(async () => setItens(await buscarAlvosDeLink(termo, contentId)));
    }, 250);
    return () => clearTimeout(t);
  }, [termo, contentId]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") aoFechar(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [aoFechar]);

  const escolherInterno = (a: AlvoDeLink) => {
    registrarLink(contentId, { targetContentId: a.id, anchor: textoSelecionado || a.title });
    aoEscolher(`/guia/${a.slug}`);
    aoFechar();
  };

  const escolherExterno = () => {
    const url = externo.trim();
    if (!url) return;
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    // Link para fora sai com nofollow por padrão: a autoridade da página é da
    // JK, e sair distribuindo sem decidir é jogar sinal fora.
    registrarLink(contentId, { targetUrl: href, anchor: textoSelecionado || href, rel: "nofollow" });
    aoEscolher(href, "nofollow");
    aoFechar();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-ink/30 p-4 pt-20 backdrop-blur-sm">
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-[18px] border border-border bg-[#fbf8f2] p-5 shadow-[var(--jk-sombra-modal)]">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Link2 size={15} className="text-brand-nav" /> Para onde vai o link
          </p>
          <button type="button" onClick={aoFechar} aria-label="Fechar" className="rounded-[8px] p-1.5 text-muted hover:bg-ink/8 hover:text-ink">
            <X size={15} />
          </button>
        </div>

        {textoSelecionado ? (
          <p className="mt-2 text-xs text-muted">
            Texto do link: <span className="font-medium text-ink">{textoSelecionado}</span>
          </p>
        ) : (
          <p className="mt-2 text-xs text-wine">
            Selecione o texto no corpo antes de criar o link, senão ele não tem onde se prender.
          </p>
        )}

        <label className="relative mt-4 block">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            autoFocus
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Buscar guia por título ou consulta alvo"
            className="w-full rounded-full border border-border bg-white/80 py-2 pl-9 pr-4 text-sm text-ink outline-none focus:border-brand"
          />
        </label>

        <div className="mt-3 min-h-32 flex-1 overflow-y-auto">
          {itens.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">
              {carregando ? "Buscando…" : "Nenhum guia encontrado."}
            </p>
          ) : (
            <ul className="space-y-1">
              {itens.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => escolherInterno(a)}
                    className="block w-full rounded-[10px] px-3 py-2 text-left transition-colors hover:bg-brand/12"
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-medium text-ink">{a.title}</span>
                      {a.status !== "published" ? (
                        <span className="rounded-full bg-ink/8 px-1.5 py-0.5 text-[0.62rem] text-muted">rascunho</span>
                      ) : null}
                    </span>
                    <span className="block text-[0.7rem] text-muted">
                      /guia/{a.slug}
                      {a.targetQuery ? ` · alvo: ${a.targetQuery}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-3 border-t border-border pt-3">
          <p className="flex items-center gap-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted">
            <Globe size={11} /> Ou um endereço de fora
          </p>
          <div className="mt-2 flex gap-2">
            <input
              value={externo}
              onChange={(e) => setExterno(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); escolherExterno(); } }}
              placeholder="jkaliancas.com.br/produto"
              className="flex-1 rounded-full border border-border bg-white/80 px-4 py-2 text-sm text-ink outline-none focus:border-brand"
            />
            <button
              type="button"
              onClick={escolherExterno}
              disabled={!externo.trim()}
              className="rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
            >
              Usar
            </button>
          </div>
          <p className="mt-1.5 text-[0.68rem] text-muted">Link de fora sai com nofollow.</p>
        </div>
      </div>
    </div>
  );
}
