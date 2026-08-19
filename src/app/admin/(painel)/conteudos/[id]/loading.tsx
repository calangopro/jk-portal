import { Skeleton } from "@/components/ui/states";

/**
 * Tela de espera do editor.
 *
 * O editor é a rota mais pesada do painel: além do conteúdo, ele carrega
 * fatos, fontes, produtos e histórico. É onde a tela parada mais incomoda, e
 * por isso ele tem esqueleto próprio, na coluna dupla que o Editor usa
 * (`data-painel-largo`), senão a página nasceria estreita e alargaria sozinha
 * quando o conteúdo chegasse.
 */
export default function CarregandoEditor() {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Abrindo o editor</span>

      <div data-painel-largo className="grid gap-8 lg:grid-cols-[1fr_23rem]">
        <div>
          <Skeleton className="h-3 w-28" />
          <Skeleton className="mt-3 h-10 w-3/4" />

          <div className="glass mt-7 rounded-[20px] px-6 py-6">
            <div className="flex gap-2">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-7 w-7 rounded-[8px]" />
              ))}
            </div>
            <div className="mt-6 space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="mt-6 h-4 w-full" />
              <Skeleton className="h-4 w-10/12" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="glass rounded-[14px] px-5 py-5"
              style={{ opacity: 1 - i * 0.18 }}
            >
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-3 h-4 w-full" />
              <Skeleton className="mt-2 h-4 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
