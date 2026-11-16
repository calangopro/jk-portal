import { Skeleton } from "@/components/ui/states";

/** Esqueleto das ideias: o título, o campo de guardar e as colunas. */
export default function Carregando() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" data-painel-largo>
      <span className="sr-only">Carregando as ideias</span>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-9 w-36" />
      <Skeleton className="mt-6 h-24 w-full rounded-[18px]" />
      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="glass rounded-[18px] p-4" style={{ opacity: 1 - i * 0.2 }}>
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-4 h-16 w-full" />
            <Skeleton className="mt-3 h-16 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
