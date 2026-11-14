import Link from "next/link";
import { PERIODOS, type ChaveDePeriodo } from "@/lib/vendas/periodo";

/**
 * Seletor de período das telas de resultado (vendas, vendedores, tráfego).
 *
 * No celular os quatro rótulos não cabem lado a lado: sem `whitespace-nowrap`
 * cada um quebrava em duas linhas dentro da pílula. Agora nenhum quebra, e se
 * faltar largura a faixa rola de lado, sozinha, sem empurrar a página.
 */
export function SeletorDePeriodo({ atual, extra = "" }: { atual: ChaveDePeriodo; extra?: string }) {
  return (
    <nav aria-label="Período" className="flex max-w-full gap-1 overflow-x-auto rounded-full border border-border bg-surface/60 p-1">
      {PERIODOS.map((p) => (
        <Link
          key={p.chave}
          href={`?periodo=${p.chave}${extra}`}
          scroll={false}
          aria-current={p.chave === atual ? "page" : undefined}
          className={
            "shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold sm:px-3.5 " +
            (p.chave === atual ? "painel-aba-ativa" : "text-muted hover:text-ink")
          }
        >
          {p.rotulo}
        </Link>
      ))}
    </nav>
  );
}
