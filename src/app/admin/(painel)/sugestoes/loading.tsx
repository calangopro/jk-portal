import { Skeleton } from "@/components/ui/states";

/** Esqueleto do roadmap: as abas por estado e os cartões das sugestões. */
export default function Carregando() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" data-painel-largo>
      <span className="sr-only">Carregando as sugestões</span>
      <Skeleton className="h-3 w-14" />
      <Skeleton className="mt-3 h-9 w-64" />
      <Skeleton className="mt-3 h-4 w-full max-w-md" />
      <div className="mt-5 flex gap-1.5 overflow-hidden">
        {["w-24", "w-20", "w-28", "w-28", "w-20"].map((w, i) => (
          <Skeleton key={i} className={`h-9 shrink-0 rounded-full ${w}`} />
        ))}
      </div>
      <div className="mt-5 space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="glass rounded-[16px] p-4" style={{ opacity: 1 - i * 0.2 }}>
            <Skeleton className="h-3 w-40" />
            <Skeleton className="mt-3 h-4 w-full" />
            <Skeleton className="mt-1.5 h-4 w-4/5" />
            <Skeleton className="mt-3 h-16 w-40" />
          </div>
        ))}
      </div>
    </div>
  );
}
