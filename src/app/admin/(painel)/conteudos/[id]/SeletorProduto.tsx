"use client";

import { useEffect, useState, useTransition } from "react";
import { Search, Package, X, ExternalLink } from "lucide-react";
import { buscarProdutos, vincularProduto, type ProdutoResumo } from "./actions";

/**
 * Escolhe um produto já sincronizado da Tray. O link sai com UTM, e o produto
 * fica vinculado ao conteúdo para poder emitir dados estruturados reais.
 */
export function SeletorProduto({
  contentId,
  aoEscolher,
  aoFechar,
}: {
  contentId: string;
  aoEscolher: (p: ProdutoResumo, url: string) => void;
  aoFechar: () => void;
}) {
  const [termo, setTermo] = useState("");
  const [itens, setItens] = useState<ProdutoResumo[]>([]);
  const [carregando, iniciar] = useTransition();

  useEffect(() => {
    const t = setTimeout(() => {
      iniciar(async () => setItens(await buscarProdutos(termo)));
    }, 250);
    return () => clearTimeout(t);
  }, [termo]);

  const escolher = (p: ProdutoResumo) => {
    if (!p.url) return;
    const url = p.url.includes("?")
      ? `${p.url}&utm_source=portal&utm_medium=conteudo`
      : `${p.url}?utm_source=portal&utm_medium=conteudo`;
    vincularProduto(contentId, p.id);
    aoEscolher(p, url);
    aoFechar();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-ink/30 p-4 pt-24 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-[18px] border border-border bg-[#fbf8f2] p-5 shadow-[0_40px_80px_-30px_rgb(75_53_23/0.5)]">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Package size={15} className="text-brand-nav" /> Produto da loja
          </p>
          <button type="button" onClick={aoFechar} className="text-muted hover:text-ink">
            <X size={16} />
          </button>
        </div>

        <div className="relative mt-4">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            autoFocus
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Buscar pelo nome do produto"
            className="w-full rounded-[10px] border border-border bg-white py-2.5 pl-9 pr-3 text-sm text-ink outline-none focus:border-brand"
          />
        </div>

        <div className="mt-4 max-h-80 overflow-y-auto">
          {carregando ? (
            <p className="py-6 text-center text-xs text-muted">Buscando…</p>
          ) : itens.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-ink">Nenhum produto encontrado</p>
              <p className="mx-auto mt-1.5 max-w-xs text-xs leading-relaxed text-muted">
                Se o catálogo ainda não foi sincronizado, rode a sincronização na
                tela de Produtos e volte aqui.
              </p>
            </div>
          ) : (
            <ul className="space-y-1">
              {itens.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => escolher(p)}
                    disabled={!p.url}
                    className="flex w-full items-center gap-3 rounded-[10px] px-2.5 py-2 text-left transition-colors hover:bg-brand/12 disabled:opacity-50"
                  >
                    {p.imagem ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imagem} alt="" className="h-10 w-10 rounded-[8px] object-cover" loading="lazy" />
                    ) : (
                      <span className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-media text-muted">
                        <Package size={14} />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{p.nome}</span>
                      <span className="block text-xs text-muted">
                        {p.precoPromocional && p.preco && p.precoPromocional < p.preco ? (
                          <>
                            <s className="mr-1.5">{p.preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</s>
                            <strong className="text-brand-strong">
                              {p.precoPromocional.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                            </strong>
                          </>
                        ) : p.preco ? (
                          p.preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                        ) : null}
                        {p.disponivel ? "" : " · sem estoque"}
                      </span>
                    </span>
                    <ExternalLink size={12} className="shrink-0 text-muted" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
