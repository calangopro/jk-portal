import { Skeleton } from "@/components/ui/states";

/** Espera da tela de tráfego, com a forma dela: quatro cartões, a tabela e o gráfico. */
export default function Carregando() {
  return (
    <div data-painel-largo role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Carregando o tráfego</span>
      <header>
        <Skeleton className="h-3 w-16" />
        <Skeleton className="mt-3 h-9 w-40" />
        <Skeleton className="mt-4 h-4 w-full max-w-xl" />
      </header>
      <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="glass h-[8.5rem] animate-pulse rounded-[18px]" />
        ))}
      </div>
      <div className="glass mt-6 h-56 animate-pulse rounded-[18px]" />
      <div className="glass mt-6 h-72 animate-pulse rounded-[18px]" />
    </div>
  );
}
