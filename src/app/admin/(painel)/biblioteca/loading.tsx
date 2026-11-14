import { Skeleton } from "@/components/ui/states";

/** Esqueleto da biblioteca, no formato dela: a busca, as fichas de tema e os cartões de resposta. */
export default function Carregando() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" data-painel-largo>
      <span className="sr-only">Carregando a biblioteca</span>
      <Skeleton className="h-3 w-14" />
      <Skeleton className="mt-3 h-9 w-52" />
      <Skeleton className="mt-3 h-4 w-full max-w-md" />
      <Skeleton className="mt-5 h-12 w-full rounded-full" />
      <div className="mt-3 flex gap-1.5 overflow-hidden">
        {["w-16", "w-28", "w-20", "w-24", "w-32"].map((w, i) => (
          <Skeleton key={i} className={`h-9 shrink-0 rounded-full ${w}`} />
        ))}
      </div>
      <div className="mt-5 space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="glass rounded-[16px] p-4" style={{ opacity: 1 - i * 0.18 }}>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-2.5 h-5 w-4/5" />
            <Skeleton className="mt-3 h-3 w-full" />
            <Skeleton className="mt-1.5 h-3 w-11/12" />
            <Skeleton className="mt-3 h-16 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
