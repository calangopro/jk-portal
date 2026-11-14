import { Skeleton } from "@/components/ui/states";

/** Esqueleto da fila, no formato dela: as quatro etapas em cima e os cartões de pedido. */
export default function Carregando() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" data-painel-largo>
      <span className="sr-only">Carregando a fila da fábrica</span>
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-3 h-9 w-56" />
      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 rounded-[14px]" />
        ))}
      </div>
      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="glass rounded-[16px] p-4" style={{ opacity: 1 - i * 0.15 }}>
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-2 h-3 w-48" />
            <Skeleton className="mt-4 h-20 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
