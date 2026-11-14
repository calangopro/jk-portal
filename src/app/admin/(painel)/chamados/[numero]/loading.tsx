import { Skeleton } from "@/components/ui/states";

/** Esqueleto de um chamado, no formato dele: o cabeçalho, as falas e a caixa de resposta. */
export default function Carregando() {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Carregando o chamado</span>
      <Skeleton className="h-10 w-44 rounded-full" />
      <Skeleton className="mt-5 h-3 w-40" />
      <Skeleton className="mt-3 h-8 w-56" />
      <Skeleton className="mt-3 h-5 w-36 rounded-full" />
      <div className="mt-5 space-y-3">
        {[0, 1].map((i) => (
          <div key={i} className="glass rounded-[16px] p-4" style={{ opacity: 1 - i * 0.3 }}>
            <Skeleton className="h-3 w-40" />
            <Skeleton className="mt-2.5 h-4 w-full" />
            <Skeleton className="mt-1.5 h-4 w-2/3" />
          </div>
        ))}
      </div>
      <Skeleton className="mt-4 h-36 w-full rounded-[18px]" />
    </div>
  );
}
