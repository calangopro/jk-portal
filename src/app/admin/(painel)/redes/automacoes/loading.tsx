import { Skeleton } from "@/components/ui/states";

/** Esqueleto das automações das redes: o título e duas regras. */
export default function Carregando() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" data-painel-largo>
      <span className="sr-only">Carregando as automações</span>
      <Skeleton className="h-3 w-14" />
      <Skeleton className="mt-3 h-9 w-56" />
      {[0, 1].map((i) => (
        <div key={i} className="glass mt-4 rounded-[18px] p-5" style={{ opacity: 1 - i * 0.25 }}>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="mt-3 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-2/3" />
        </div>
      ))}
    </div>
  );
}
