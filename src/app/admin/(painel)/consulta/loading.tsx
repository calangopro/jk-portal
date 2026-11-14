import { Skeleton } from "@/components/ui/states";

/** Esqueleto da consulta, no formato dela: a busca em cima e a lista de produtos. */
export default function Carregando() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" data-painel-largo>
      <span className="sr-only">Carregando a consulta</span>
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-3 h-9 w-44" />
      <Skeleton className="mt-6 h-12 w-full rounded-full" />
      <div className="mt-5 space-y-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="glass flex items-center gap-3 rounded-[14px] p-3" style={{ opacity: 1 - i * 0.12 }}>
            <Skeleton className="h-14 w-14 rounded-[10px]" />
            <div className="flex-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="mt-2 h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
