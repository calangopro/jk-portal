import { Skeleton } from "@/components/ui/states";

/** Esqueleto das oportunidades, no formato delas: os três números, os filtros e os cartões. */
export default function Carregando() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" data-painel-largo>
      <span className="sr-only">Carregando as oportunidades</span>
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-3 h-9 w-60" />
      <Skeleton className="mt-3 h-4 w-full max-w-xl" />
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 rounded-[16px]" />
        ))}
      </div>
      <div className="mt-4 flex gap-1.5 overflow-hidden">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-9 w-32 shrink-0 rounded-full" />
        ))}
      </div>
      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="glass rounded-[16px] p-4" style={{ opacity: 1 - i * 0.15 }}>
            <Skeleton className="h-5 w-36" />
            <Skeleton className="mt-3 h-4 w-48" />
            <Skeleton className="mt-3 h-12 w-full" />
            <Skeleton className="mt-4 h-10 w-full rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
