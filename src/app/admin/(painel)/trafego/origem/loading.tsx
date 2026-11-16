import { Skeleton } from "@/components/ui/states";

/** Espera da tela de origem, com a forma dela: título, os quatro números e a lista. */
export default function Carregando() {
  return (
    <div data-painel-largo role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Carregando a origem dos pedidos</span>
      <Skeleton className="h-3 w-16" />
      <Skeleton className="mt-3 h-9 w-64" />
      <Skeleton className="mt-4 h-4 w-full max-w-xl" />
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="glass h-28 animate-pulse rounded-[16px]" />
        ))}
      </div>
      <div className="glass mt-5 h-96 animate-pulse rounded-[18px]" />
    </div>
  );
}
