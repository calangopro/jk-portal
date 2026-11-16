import { Skeleton } from "@/components/ui/states";

/** Esqueleto dos comentários das redes: o título, as abas e três comentários. */
export default function Carregando() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" data-painel-largo>
      <span className="sr-only">Carregando os comentários das redes</span>
      <Skeleton className="h-3 w-14" />
      <Skeleton className="mt-3 h-9 w-64" />
      <Skeleton className="mt-6 h-9 w-72 max-w-full rounded-full" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="glass mt-3 rounded-[18px] p-5" style={{ opacity: 1 - i * 0.2 }}>
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-3 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-3/4" />
        </div>
      ))}
    </div>
  );
}
