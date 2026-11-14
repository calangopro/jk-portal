import { Skeleton } from "@/components/ui/states";

/** Esqueleto das avaliações: o título e um cartão por loja. */
export default function Carregando() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" data-painel-largo>
      <span className="sr-only">Carregando as avaliações</span>
      <Skeleton className="h-3 w-16" />
      <Skeleton className="mt-3 h-9 w-72" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="glass mt-4 rounded-[18px] p-5" style={{ opacity: 1 - i * 0.2 }}>
          <Skeleton className="h-5 w-64" />
          <Skeleton className="mt-3 h-4 w-40" />
          <Skeleton className="mt-4 h-20 w-full" />
        </div>
      ))}
    </div>
  );
}
