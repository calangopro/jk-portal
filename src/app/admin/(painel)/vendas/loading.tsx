import { Skeleton } from "@/components/ui/states";

/**
 * Espera da tela de vendas, com a forma dela: três cartões do topo, quatro do
 * período e o gráfico. A rota consulta o banco em toda visita, então o
 * esqueleto é o que aparece no clique (e é ele que liga o prefetch do link).
 */
export default function Carregando() {
  return (
    <div data-painel-largo role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Carregando as vendas</span>
      <header>
        <Skeleton className="h-3 w-16" />
        <Skeleton className="mt-3 h-9 w-40" />
        <Skeleton className="mt-4 h-4 w-full max-w-xl" />
      </header>
      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="glass h-[8.5rem] animate-pulse rounded-[18px]" />
        ))}
      </div>
      <div className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="glass h-[8.5rem] animate-pulse rounded-[18px]" />
        ))}
      </div>
      <div className="glass mt-6 h-72 animate-pulse rounded-[18px]" />
    </div>
  );
}
