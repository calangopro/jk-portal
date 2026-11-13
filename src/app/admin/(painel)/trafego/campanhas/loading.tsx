import { Skeleton } from "@/components/ui/states";

/** Espera da tela de campanhas, com a forma dela: título, abas e os blocos empilhados. */
export default function Carregando() {
  return (
    <div data-painel-largo role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Carregando as campanhas</span>
      <Skeleton className="h-3 w-16" />
      <Skeleton className="mt-3 h-9 w-48" />
      <Skeleton className="mt-4 h-4 w-full max-w-xl" />
      <div className="glass mt-6 h-32 animate-pulse rounded-[18px]" />
      <div className="glass mt-5 h-56 animate-pulse rounded-[18px]" />
      <div className="glass mt-5 h-72 animate-pulse rounded-[18px]" />
    </div>
  );
}
