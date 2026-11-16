import { Skeleton } from "@/components/ui/states";

/** Esqueleto do calendário: o título e a grade do mês. */
export default function Carregando() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" data-painel-largo>
      <span className="sr-only">Carregando o calendário</span>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-9 w-48" />
      <div className="glass mt-6 rounded-[20px] p-4">
        <Skeleton className="mx-auto h-6 w-40" />
        <div className="mt-4 grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }, (_, i) => (
            <Skeleton key={i} className="h-14 rounded-[10px] sm:h-20" />
          ))}
        </div>
      </div>
    </div>
  );
}
