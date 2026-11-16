import { Skeleton } from "@/components/ui/states";

/** Esqueleto de "Contas ligadas": o título e um cartão por rede. */
export default function Carregando() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" data-painel-largo>
      <span className="sr-only">Carregando as contas ligadas</span>
      <Skeleton className="h-3 w-14" />
      <Skeleton className="mt-3 h-9 w-56" />
      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="glass rounded-[18px] p-5" style={{ opacity: 1 - i * 0.2 }}>
            <Skeleton className="h-8 w-52" />
            <Skeleton className="mt-4 h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
