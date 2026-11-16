import { Skeleton } from "@/components/ui/states";

/** Esqueleto de "Todas as redes": o título, os quatro totais e duas contas. */
export default function Carregando() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" data-painel-largo>
      <span className="sr-only">Carregando os números das redes</span>
      <Skeleton className="h-3 w-14" />
      <Skeleton className="mt-3 h-9 w-64" />
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="glass rounded-[16px] p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-7 w-24" />
          </div>
        ))}
      </div>
      <div className="mt-8 grid gap-3 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="glass rounded-[18px] p-5" style={{ opacity: 1 - i * 0.25 }}>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="mt-4 h-10 w-32" />
            <Skeleton className="mt-4 h-12 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
