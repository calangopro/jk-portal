import { Skeleton } from "@/components/ui/states";

/** Espera da tela de gargalos: título, o mapa em cartões e os blocos empilhados. */
export default function Carregando() {
  return (
    <div data-painel-largo role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Carregando os gargalos</span>
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-3 h-9 w-44" />
      <Skeleton className="mt-4 h-4 w-full max-w-xl" />
      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        {[0, 1, 2, 3].map((i) => <div key={i} className="glass h-28 animate-pulse rounded-[16px]" />)}
      </div>
      <div className="glass mt-6 h-72 animate-pulse rounded-[18px]" />
      <div className="glass mt-6 h-72 animate-pulse rounded-[18px]" />
    </div>
  );
}
