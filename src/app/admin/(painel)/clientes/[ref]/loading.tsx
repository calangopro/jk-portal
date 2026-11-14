import { Skeleton } from "@/components/ui/states";

/** Esqueleto da ficha, no formato dela: nome, botões de contato, os três números e os blocos. */
export default function Carregando() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" data-painel-largo>
      <span className="sr-only">Carregando a ficha do cliente</span>
      <Skeleton className="h-3 w-16" />
      <Skeleton className="mt-4 h-3 w-28" />
      <Skeleton className="mt-3 h-9 w-64 max-w-full" />
      <Skeleton className="mt-3 h-4 w-72 max-w-full" />
      <div className="mt-5 flex flex-wrap gap-2">
        <Skeleton className="h-11 w-full rounded-full sm:w-48" />
        <Skeleton className="h-11 flex-1 rounded-full sm:w-28 sm:flex-none" />
        <Skeleton className="h-11 flex-1 rounded-full sm:w-28 sm:flex-none" />
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 rounded-[16px]" />
        ))}
      </div>
      <Skeleton className="mt-9 h-80 rounded-[18px]" />
      <Skeleton className="mt-9 h-6 w-40" />
      <div className="mt-4 space-y-4">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-28 rounded-[14px]" />
        ))}
      </div>
    </div>
  );
}
