import { Skeleton } from "@/components/ui/states";

/** Esqueleto do "Em alta": o título, os filtros e uma grade de capas. */
export default function Carregando() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" data-painel-largo>
      <span className="sr-only">Carregando as publicações</span>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-9 w-40" />
      <Skeleton className="mt-6 h-8 w-full max-w-xl" />
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} style={{ opacity: 1 - i * 0.08 }}>
            <Skeleton className="aspect-[4/5] w-full rounded-[14px]" />
            <Skeleton className="mt-2 h-5 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
