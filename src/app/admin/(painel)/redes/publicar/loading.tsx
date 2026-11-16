import { Skeleton } from "@/components/ui/states";

/** Esqueleto de "Posts e stories": o título, as abas e dois posts. */
export default function Carregando() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" data-painel-largo>
      <span className="sr-only">Carregando os posts das redes</span>
      <Skeleton className="h-3 w-14" />
      <Skeleton className="mt-3 h-9 w-72" />
      <Skeleton className="mt-6 h-9 w-80 max-w-full rounded-full" />
      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="glass rounded-[18px] p-5" style={{ opacity: 1 - i * 0.25 }}>
            <div className="flex gap-3">
              <Skeleton className="h-20 w-20" />
              <div className="flex-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="mt-3 h-4 w-full" />
                <Skeleton className="mt-2 h-4 w-2/3" />
              </div>
            </div>
            <Skeleton className="mt-4 h-10 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
