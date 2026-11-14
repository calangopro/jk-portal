import { Skeleton } from "@/components/ui/states";

/** Esqueleto dos chamados, no formato deles: o título, as fichas de filtro e os cartões. */
export default function Carregando() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" data-painel-largo>
      <span className="sr-only">Carregando os chamados</span>
      <Skeleton className="h-3 w-14" />
      <Skeleton className="mt-3 h-9 w-44" />
      <Skeleton className="mt-3 h-4 w-full max-w-md" />
      <div className="mt-5 flex gap-1.5 overflow-hidden">
        {["w-32", "w-36", "w-32", "w-24"].map((w, i) => (
          <Skeleton key={i} className={`h-9 shrink-0 rounded-full ${w}`} />
        ))}
      </div>
      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="glass rounded-[16px] p-4" style={{ opacity: 1 - i * 0.18 }}>
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-32 rounded-full" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="mt-3 h-3 w-48" />
            <Skeleton className="mt-2.5 h-4 w-full" />
            <Skeleton className="mt-1.5 h-4 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}
