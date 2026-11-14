import { Skeleton } from "@/components/ui/states";

/** Esqueleto da tela de clientes, no formato dela: a caixa de busca e a lista de cartões. */
export default function Carregando() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" data-painel-largo>
      <span className="sr-only">Carregando os clientes</span>
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-3 h-9 w-44" />
      <Skeleton className="mt-3 h-4 w-full max-w-xl" />
      <Skeleton className="mt-6 h-13 w-full rounded-full" />
      <Skeleton className="mt-7 h-6 w-52" />
      <div className="mt-3 grid gap-2.5 lg:grid-cols-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="glass rounded-[16px] p-4" style={{ opacity: 1 - i * 0.12 }}>
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-2 h-3 w-56" />
            <Skeleton className="mt-2 h-3 w-32" />
          </div>
        ))}
      </div>
    </div>
  );
}
