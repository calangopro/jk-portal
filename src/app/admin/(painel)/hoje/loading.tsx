import { Skeleton } from "@/components/ui/states";

/** Esqueleto do Hoje, no formato dele: o título e os cartões em coluna. Também é o que liga o prefetch da rota. */
export default function Carregando() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="mx-auto w-full max-w-3xl">
      <span className="sr-only">Carregando o que espera por você</span>
      <Skeleton className="h-3 w-32" />
      <Skeleton className="mt-3 h-9 w-64 max-w-full" />
      <Skeleton className="mt-3 h-4 w-full max-w-md" />
      <div className="mt-6 grid grid-cols-1 gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-40 rounded-[18px]" />
        ))}
      </div>
    </div>
  );
}
