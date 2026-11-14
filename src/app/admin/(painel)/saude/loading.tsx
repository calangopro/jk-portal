import { Skeleton } from "@/components/ui/states";

/** Esqueleto da saúde das ligações: o título e as duas listas. */
export default function Carregando() {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Carregando a saúde das ligações</span>
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-3 h-9 w-72" />
      {[0, 1].map((i) => (
        <div key={i} className="glass mt-5 rounded-[18px] p-5">
          <Skeleton className="h-4 w-56" />
          <Skeleton className="mt-4 h-12 w-full" />
          <Skeleton className="mt-3 h-12 w-full" />
          <Skeleton className="mt-3 h-12 w-full" />
        </div>
      ))}
    </div>
  );
}
